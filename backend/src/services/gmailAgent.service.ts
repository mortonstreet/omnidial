/**
 * Gmail Agent Service
 * Handles Gmail OAuth and email sending for AI SDR agents
 * Reference pattern: googleSheets.service.ts
 */

import { google, gmail_v1 } from 'googleapis'
import { config } from '@/config'
import { encrypt, decrypt } from '@/lib/encryption'
import * as agentEmailConfigRepo from '@/repositories/agentEmailConfig.repository'
import * as agentRepo from '@/repositories/agent.repository'
import logger from '@/lib/logger'

// Gmail API scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

const oauth2Client = new google.auth.OAuth2(
  config.providers.google.clientId,
  config.providers.google.clientSecret,
)

/**
 * Generate OAuth URL for Gmail authorization
 */
export function getOAuthUrl(agentId: string, redirectUri: string): string {
  // Encode agentId in state parameter
  const state = Buffer.from(
    JSON.stringify({ agentId, timestamp: Date.now() }),
  ).toString('base64')

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_SCOPES,
    state,
    redirect_uri: redirectUri,
  })
}

/**
 * Parse state parameter from OAuth callback
 */
export function parseState(
  state: string,
): { agentId: string; timestamp: number } | null {
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8')
    return JSON.parse(decoded)
  } catch (error) {
    logger.error({ error }, 'Failed to parse Gmail OAuth state')
    return null
  }
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string
  refreshToken: string | null
  expiresAt: Date
  email: string
}> {
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: redirectUri,
  })

  if (!tokens.access_token) {
    throw new Error('Failed to get access token from Google')
  }

  oauth2Client.setCredentials(tokens)

  // Get the email address of the authenticated user
  const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
  const userInfo = await oauth2.userinfo.get()
  const email = userInfo.data.email

  if (!email) {
    throw new Error('Failed to get user email from Google')
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000)

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || null,
    expiresAt,
    email,
  }
}

/**
 * Refresh access token if expired
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  oauth2Client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await oauth2Client.refreshAccessToken()

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token')
  }

  const expiresAt = credentials.expiry_date
    ? new Date(credentials.expiry_date)
    : new Date(Date.now() + 3600 * 1000)

  return {
    accessToken: credentials.access_token,
    expiresAt,
  }
}

/**
 * Get authenticated Gmail client for an agent
 */
async function getAuthenticatedClient(
  agentId: string,
): Promise<gmail_v1.Gmail> {
  const emailConfig = await agentEmailConfigRepo.findByAgentId(agentId)

  if (!emailConfig || emailConfig.provider !== 'gmail') {
    throw new Error('Gmail not configured for this agent')
  }

  if (!emailConfig.accessTokenEncrypted) {
    throw new Error('Gmail access token not found')
  }

  let accessToken = decrypt(emailConfig.accessTokenEncrypted)

  // Check if token needs refresh (5 minute buffer)
  const tokenExpiresAt = emailConfig.tokenExpiresAt
    ? new Date(emailConfig.tokenExpiresAt).getTime()
    : 0
  const needsRefresh = tokenExpiresAt < Date.now() + 5 * 60 * 1000

  if (needsRefresh) {
    if (!emailConfig.refreshTokenEncrypted) {
      throw new Error(
        'Gmail token expired. Please disconnect and reconnect Gmail.',
      )
    }

    try {
      const refreshToken = decrypt(emailConfig.refreshTokenEncrypted)
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      // Update tokens in database
      await agentEmailConfigRepo.updateByAgentId(agentId, {
        accessTokenEncrypted: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
      })
    } catch (error) {
      logger.error({ error, agentId }, 'Failed to refresh Gmail token')
      throw new Error(
        'Failed to refresh Gmail token. Please disconnect and reconnect Gmail.',
      )
    }
  }

  oauth2Client.setCredentials({ access_token: accessToken })

  return google.gmail({ version: 'v1', auth: oauth2Client })
}

/**
 * Create a MIME message for sending via Gmail
 */
function createMimeMessage(
  to: string,
  subject: string,
  bodyHtml: string,
  from?: string,
): string {
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : '',
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
  ]
    .filter(Boolean)
    .join('\r\n')

  const message = `${headers}\r\n\r\n${bodyHtml}`

  // Encode to base64url format
  return Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Send an email via Gmail API
 */
export async function sendEmail(
  agentId: string,
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<string> {
  const gmail = await getAuthenticatedClient(agentId)
  const emailConfig = await agentEmailConfigRepo.findByAgentId(agentId)

  const fromEmail = emailConfig?.fromEmail
  const fromName = emailConfig?.fromName
  const from = fromName ? `${fromName} <${fromEmail}>` : fromEmail

  // Add signature if configured
  let finalBody = bodyHtml
  if (emailConfig?.signatureHtml) {
    finalBody += `<br><br>${emailConfig.signatureHtml}`
  }

  const message = createMimeMessage(to, subject, finalBody, from)

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: message },
  })

  if (!res.data.id) {
    throw new Error('Failed to send email via Gmail')
  }

  return res.data.id
}

/**
 * Test Gmail connection
 */
export async function testConnection(agentId: string): Promise<{
  success: boolean
  message: string
  email?: string
}> {
  try {
    const gmail = await getAuthenticatedClient(agentId)

    // Test by getting the user's profile
    const profile = await gmail.users.getProfile({ userId: 'me' })

    return {
      success: true,
      message: 'Gmail connection successful',
      email: profile.data.emailAddress || undefined,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return { success: false, message }
  }
}

/**
 * Save Gmail credentials for an agent
 */
export async function saveCredentials(
  agentId: string,
  organizationId: string,
  tokens: {
    accessToken: string
    refreshToken: string | null
    expiresAt: Date
    email: string
  },
): Promise<void> {
  // Verify agent belongs to organization
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  await agentEmailConfigRepo.upsertByAgentId(agentId, {
    provider: 'gmail',
    fromEmail: tokens.email,
    accessTokenEncrypted: encrypt(tokens.accessToken),
    refreshTokenEncrypted: tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : null,
    tokenExpiresAt: tokens.expiresAt,
    isVerified: true,
  })
}

/**
 * Disconnect Gmail for an agent
 */
export async function disconnect(
  agentId: string,
  organizationId: string,
): Promise<void> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const config = await agentEmailConfigRepo.findByAgentId(agentId)
  if (config?.provider !== 'gmail') {
    throw new Error('Gmail not connected for this agent')
  }

  await agentEmailConfigRepo.deleteByAgentId(agentId)
}

/**
 * Get Gmail status for an agent
 */
export async function getStatus(agentId: string): Promise<{
  connected: boolean
  email?: string
  verified?: boolean
}> {
  const config = await agentEmailConfigRepo.findByAgentId(agentId)

  if (!config || config.provider !== 'gmail') {
    return { connected: false }
  }

  return {
    connected: true,
    email: config.fromEmail,
    verified: config.isVerified,
  }
}

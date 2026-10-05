/**
 * Read-only Gmail access for pipeline scoring. Separate from the AI SDR
 * agent's Gmail (gmailAgent.service), which can send: this one only ever asks
 * for gmail.readonly.
 */
import { google, gmail_v1 } from 'googleapis'
import { config } from '@/config'
import { stripQuotedReply } from '@/lib/email-text'

export const GMAIL_READONLY_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
]

// A fresh client per use: OAuth2 clients hold credentials, so sharing one
// across orgs would leak tokens between concurrent requests.
const newOAuthClient = () =>
  new google.auth.OAuth2(
    config.providers.gmailReader.clientId,
    config.providers.gmailReader.clientSecret,
  )

export const getOAuthUrl = (state: string, redirectUri: string): string =>
  newOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GMAIL_READONLY_SCOPES,
    state,
    redirect_uri: redirectUri,
  })

export const exchangeCodeForTokens = async (
  code: string,
  redirectUri: string,
) => {
  const client = newOAuthClient()
  const { tokens } = await client.getToken({ code, redirect_uri: redirectUri })
  if (!tokens.access_token) {
    throw new Error('Failed to get access token from Google')
  }
  client.setCredentials(tokens)
  const { data } = await google
    .oauth2({ version: 'v2', auth: client })
    .userinfo.get()

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || '',
    expiresAt: tokens.expiry_date
      ? new Date(tokens.expiry_date)
      : new Date(Date.now() + 3600 * 1000),
    mailbox: data.email ?? null,
  }
}

export const refreshAccessToken = async (refreshToken: string) => {
  const client = newOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  const { credentials } = await client.refreshAccessToken()
  if (!credentials.access_token) {
    throw new Error('Failed to refresh Gmail access token')
  }
  return {
    accessToken: credentials.access_token,
    expiresAt: credentials.expiry_date
      ? new Date(credentials.expiry_date)
      : new Date(Date.now() + 3600 * 1000),
  }
}

export const createGmail = (accessToken: string): gmail_v1.Gmail => {
  const client = newOAuthClient()
  client.setCredentials({ access_token: accessToken })
  return google.gmail({ version: 'v1', auth: client })
}

const gmailDate = (date: Date) =>
  `${date.getUTCFullYear()}/${date.getUTCMonth() + 1}/${date.getUTCDate()}`

/** Thread ids exchanged with `email` since `after`, most recent first. */
export const listThreadIdsWithContact = async (
  gmail: gmail_v1.Gmail,
  email: string,
  after: Date,
  maxResults = 5,
): Promise<string[]> => {
  const { data } = await gmail.users.threads.list({
    userId: 'me',
    q: `{from:${email} to:${email} cc:${email}} after:${gmailDate(after)}`,
    maxResults,
  })
  return (data.threads ?? [])
    .map((t) => t.id)
    .filter((id): id is string => !!id)
}

/** Thread ids matching full name + after date (name lookup fallback). */
export const listThreadIdsByName = async (
  gmail: gmail_v1.Gmail,
  fullName: string,
  after: Date,
  maxResults = 10,
): Promise<string[]> => {
  const { data } = await gmail.users.threads.list({
    userId: 'me',
    q: `"${fullName.replace(/"/g, '')}" after:${gmailDate(after)}`,
    maxResults,
  })
  return (data.threads ?? [])
    .map((t) => t.id)
    .filter((id): id is string => !!id)
}

export interface ThreadMessage {
  id: string
  fromEmail: string | null
  /** Every address on From/To/Cc, lowercased. */
  addresses: string[]
  at: Date
}

export interface ThreadDigest {
  threadId: string
  subject: string
  participants: string[]
  lastMessageAt: Date
  firstMessageAt: Date
  text: string
  messages: ThreadMessage[]
}

const ADDRESS = /[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

const addressesIn = (value: string) =>
  (value.match(ADDRESS) ?? []).map((a) => a.toLowerCase())

const header = (message: gmail_v1.Schema$Message, name: string) =>
  message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase(),
  )?.value ?? ''

const decode = (data?: string | null) =>
  data ? Buffer.from(data, 'base64url').toString('utf8') : ''

const findPlainText = (part?: gmail_v1.Schema$MessagePart): string => {
  if (!part) return ''
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decode(part.body.data)
  }
  for (const child of part.parts ?? []) {
    const found = findPlainText(child)
    if (found) return found
  }
  return ''
}

export const getThreadDigest = async (
  gmail: gmail_v1.Gmail,
  threadId: string,
): Promise<ThreadDigest> => {
  const { data } = await gmail.users.threads.get({
    userId: 'me',
    id: threadId,
    format: 'full',
  })
  const messages = data.messages ?? []
  if (messages.length === 0) {
    throw new Error(`Gmail thread ${threadId} has no messages`)
  }
  const participants = new Set<string>()
  const parts: string[] = []
  const threadMessages: ThreadMessage[] = []

  for (const message of messages) {
    const from = header(message, 'From')
    participants.add(from)
    threadMessages.push({
      id: message.id ?? `${threadId}:${message.internalDate}`,
      fromEmail: addressesIn(from)[0] ?? null,
      addresses: addressesIn(
        `${from} ${header(message, 'To')} ${header(message, 'Cc')}`,
      ),
      at: new Date(Number(message.internalDate ?? 0)),
    })
    const sentAt = new Date(Number(message.internalDate ?? 0)).toISOString()
    parts.push(
      `--- ${sentAt} | From: ${from} | To: ${header(message, 'To')}\n${stripQuotedReply(findPlainText(message.payload) || message.snippet || '')}`,
    )
  }

  const times = messages.map((m) => Number(m.internalDate ?? 0))
  return {
    threadId,
    subject: messages[0] ? header(messages[0], 'Subject') : '',
    participants: [...participants],
    firstMessageAt: new Date(Math.min(...times)),
    lastMessageAt: new Date(Math.max(...times)),
    text: parts.join('\n\n'),
    messages: threadMessages,
  }
}

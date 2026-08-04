import * as integrationRepository from '@/repositories/integration.repository'
import * as userRepository from '@/repositories/user.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as leadListRepository from '@/repositories/leadList.repository'
import * as leadListEntryRepository from '@/repositories/leadListEntry.repository'
import * as googleSheetsService from '@/services/googleSheets.service'
import * as enrichEngineService from '@/services/enrichEngine.service'
import * as hubspotService from '@/services/hubspot.service'
import * as analyticsService from '@/services/analytics.service'
import { encrypt, decrypt } from '@/lib/encryption'
import { config } from '@/config'
import {
  IntegrationCategory,
  IntegrationConfig,
  ExportTarget,
  ExportToSheetResult,
} from '@shared/types/src/requests/integration'

/**
 * Encrypt an OAuth token before storing in DB.
 * Returns the token as-is if it's empty/undefined.
 */
function encryptToken(token: string | undefined): string | undefined {
  if (!token) return token
  return encrypt(token)
}

/**
 * Decrypt an OAuth token after reading from DB.
 * Handles both encrypted and plaintext tokens (backwards compatible).
 */
function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  // If it doesn't look like our encrypted format, return as-is
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) {
    return token
  }
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

// Integration metadata (static configuration)
// Note: EnrichEngine uses API key auth (separate flow), not OAuth
// Google Sheets uses OAuth flow
// Webhooks are simple configuration
const INTEGRATION_METADATA: Record<
  string,
  {
    name: string
    description: string
    category: IntegrationCategory
    authType: 'oauth' | 'api_key' | 'config'
  }
> = {
  google_sheets: {
    name: 'Google Sheets',
    description: 'Import/export leads from spreadsheets for easy data sharing',
    category: 'data',
    authType: 'oauth',
  },
  enrichengine: {
    name: 'EnrichEngine',
    description: 'Import enriched leads and lists from EnrichEngine',
    category: 'data',
    authType: 'api_key',
  },
  hubspot: {
    name: 'HubSpot',
    description: 'Import contacts from your HubSpot CRM',
    category: 'crm',
    authType: 'oauth',
  },
  webhook: {
    name: 'Webhooks',
    description: 'Push data to Slack, Zapier, and other services via HTTP',
    category: 'automation',
    authType: 'config',
  },
  salesforce: {
    name: 'Salesforce',
    description: 'Sync contacts, log calls, and update records in Salesforce',
    category: 'crm',
    authType: 'oauth',
  },
  pipedrive: {
    name: 'Pipedrive',
    description: 'Keep your Pipedrive pipeline in sync with every call',
    category: 'crm',
    authType: 'oauth',
  },
  monday: {
    name: 'Monday CRM',
    description: 'Connect your Monday CRM boards and manage contacts',
    category: 'crm',
    authType: 'oauth',
  },
  attio: {
    name: 'Attio',
    description: 'Sync contacts and log activities in Attio CRM',
    category: 'crm',
    authType: 'oauth',
  },
}

export const listIntegrations = async (organizationId: string) => {
  // Get OAuth-based integrations from integration table
  const connectedIntegrations =
    await integrationRepository.findByOrganizationId(organizationId)
  const connectedMap = new Map(
    connectedIntegrations.map((i) => [i.provider, i]),
  )

  // Get EnrichEngine status separately (API key auth)
  const enrichEngineStatus =
    await enrichEngineService.getConnectionStatus(organizationId)

  const integrations = await Promise.all(
    Object.entries(INTEGRATION_METADATA).map(async ([provider, meta]) => {
      // Handle EnrichEngine separately (API key auth)
      if (provider === 'enrichengine') {
        return {
          provider,
          name: meta.name,
          description: meta.description,
          category: meta.category,
          authType: meta.authType,
          isConnected: enrichEngineStatus.isConnected,
          connectedAt: enrichEngineStatus.connectedAt,
          connectedBy: enrichEngineStatus.connectedBy,
          lastSyncAt: enrichEngineStatus.lastSyncAt,
          config: undefined,
        }
      }

      // Handle OAuth-based integrations (Google Sheets, etc.)
      const connected = connectedMap.get(provider)
      let connectedBy = null

      if (connected) {
        const user = await userRepository.findById(connected.connectedById)
        connectedBy = user
          ? { id: user.id, name: user.name || '', email: user.email }
          : null
      }

      return {
        provider,
        name: meta.name,
        description: meta.description,
        category: meta.category,
        authType: meta.authType,
        isConnected: !!connected,
        connectedAt: connected?.createdAt?.toISOString(),
        connectedBy,
        lastSyncAt: connected?.lastSyncAt?.toISOString(),
        config: (connected?.config as IntegrationConfig) || undefined,
      }
    }),
  )

  return { data: integrations }
}

export const getIntegrationStatus = async (
  organizationId: string,
  provider: string,
) => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    provider,
  )

  const meta = INTEGRATION_METADATA[provider]
  if (!meta) {
    throw new Error('Unknown integration provider')
  }

  let connectedBy = null
  if (integration) {
    const user = await userRepository.findById(integration.connectedById)
    connectedBy = user
      ? { id: user.id, name: user.name || '', email: user.email }
      : null
  }

  return {
    provider,
    name: meta.name,
    description: meta.description,
    category: meta.category,
    isConnected: !!integration,
    connectedAt: integration?.createdAt?.toISOString(),
    connectedBy,
    lastSyncAt: integration?.lastSyncAt?.toISOString(),
    config: (integration?.config as IntegrationConfig) || undefined,
  }
}

export const initiateOAuthFlow = async (
  organizationId: string,
  provider: string,
  userId: string,
  redirectUrl?: string,
) => {
  // EnrichEngine uses API key auth, not OAuth
  if (provider === 'enrichengine') {
    throw new Error(
      'EnrichEngine uses API key authentication. Use the /enrichengine/connect endpoint.',
    )
  }

  // Generate state token for OAuth security (includes userId for callback)
  const state = Buffer.from(
    JSON.stringify({
      organizationId,
      provider,
      userId,
      redirectUrl: redirectUrl || '/dashboard/settings',
      timestamp: Date.now(),
    }),
  ).toString('base64url')

  // Build redirect URI for OAuth callback
  const callbackUri = `${config.backendUrl}/api/integrations/${provider}/callback`

  if (provider === 'google_sheets') {
    const url = googleSheetsService.getOAuthUrl(state, callbackUri)
    return { url, state }
  }

  if (provider === 'hubspot') {
    const url = hubspotService.getOAuthUrl(state, callbackUri)
    return { url, state }
  }

  if (provider === 'salesforce') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.salesforce.clientId || '',
      redirect_uri: callbackUri,
      state,
    })
    const url = `https://login.salesforce.com/services/oauth2/authorize?${params.toString()}`
    return { url, state }
  }

  if (provider === 'attio') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.attio.clientId || '',
      redirect_uri: callbackUri,
      state,
    })
    const url = `https://app.attio.com/authorize?${params.toString()}`
    return { url, state }
  }

  if (provider === 'pipedrive') {
    const params = new URLSearchParams({
      client_id: config.pipedrive.clientId || '',
      redirect_uri: callbackUri,
      state,
    })
    const url = `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`
    return { url, state }
  }

  if (provider === 'monday') {
    const params = new URLSearchParams({
      client_id: config.monday.clientId || '',
      redirect_uri: callbackUri,
      state,
      scope: 'boards:read boards:write users:read me:read',
    })
    const url = `https://auth.monday.com/oauth2/authorize?${params.toString()}`
    return { url, state }
  }

  if (provider === 'webhook') {
    // Webhooks don't require OAuth - just create the integration directly
    return { url: null, state }
  }

  throw new Error(`OAuth not supported for provider: ${provider}`)
}

export const handleOAuthCallback = async (
  organizationId: string,
  provider: string,
  userId: string,
  code: string,
) => {
  // EnrichEngine uses API key auth, not OAuth
  if (provider === 'enrichengine') {
    throw new Error(
      'EnrichEngine uses API key authentication. Use the /enrichengine/connect endpoint.',
    )
  }

  const callbackUri = `${config.backendUrl}/api/integrations/${provider}/callback`

  if (provider === 'google_sheets') {
    // Exchange code for real tokens
    const tokens = await googleSheetsService.exchangeCodeForTokens(
      code,
      callbackUri,
    )

    // Check if integration already exists (reconnecting)
    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )

    if (existing) {
      // Update existing integration with new tokens
      // Only update refresh token if a new one was provided (Google may not return one on re-auth)
      return integrationRepository.update(organizationId, provider, {
        accessToken: encryptToken(tokens.accessToken),
        ...(tokens.refreshToken && {
          refreshToken: encryptToken(tokens.refreshToken),
        }),
        tokenExpiresAt: tokens.expiresAt,
      })
    }

    // Create new integration
    return integrationRepository.create({
      organizationId,
      provider,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      connectedById: userId,
      config: {
        syncLeads: true,
        logCalls: true,
        syncDirection: 'two_way',
      },
    })
  }

  if (provider === 'hubspot') {
    const tokens = await hubspotService.exchangeCodeForTokens(code, callbackUri)

    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )

    if (existing) {
      return integrationRepository.update(organizationId, provider, {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
      })
    }

    return integrationRepository.create({
      organizationId,
      provider,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      connectedById: userId,
      config: {
        importContacts: true,
      },
    })
  }

  if (provider === 'salesforce') {
    const tokenResponse = await fetch(
      'https://login.salesforce.com/services/oauth2/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: config.salesforce.clientId || '',
          client_secret: config.salesforce.clientSecret || '',
          redirect_uri: callbackUri,
          code,
        }),
      },
    )
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error(
        'Salesforce token exchange failed:',
        tokenResponse.status,
        errorData,
      )
      throw new Error(
        `Salesforce token exchange failed (${tokenResponse.status}): ${errorData}`,
      )
    }
    const tokenData = await tokenResponse.json()
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + 7200 * 1000), // Salesforce tokens expire in ~2h
      instanceUrl: tokenData.instance_url,
    }

    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )
    if (existing) {
      return integrationRepository.update(organizationId, provider, {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        config: { instanceUrl: tokens.instanceUrl },
      })
    }
    return integrationRepository.create({
      organizationId,
      provider,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      connectedById: userId,
      config: { instanceUrl: tokens.instanceUrl },
    })
  }

  if (provider === 'attio') {
    const tokenResponse = await fetch('https://app.attio.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.attio.clientId || '',
        client_secret: config.attio.clientSecret || '',
        redirect_uri: callbackUri,
        code,
      }),
    })
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error(
        'Attio token exchange failed:',
        tokenResponse.status,
        errorData,
      )
      throw new Error(
        `Attio token exchange failed (${tokenResponse.status}): ${errorData}`,
      )
    }
    const tokenData = await tokenResponse.json()
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : new Date(Date.now() + 86400 * 1000),
    }

    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )
    if (existing) {
      return integrationRepository.update(organizationId, provider, {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
      })
    }
    return integrationRepository.create({
      organizationId,
      provider,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      connectedById: userId,
    })
  }

  if (provider === 'pipedrive') {
    const tokenResponse = await fetch(
      'https://oauth.pipedrive.com/oauth/token',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${config.pipedrive.clientId || ''}:${config.pipedrive.clientSecret || ''}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          redirect_uri: callbackUri,
          code,
        }),
      },
    )
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error(
        'Pipedrive token exchange failed:',
        tokenResponse.status,
        errorData,
      )
      throw new Error(
        `Pipedrive token exchange failed (${tokenResponse.status}): ${errorData}`,
      )
    }
    const tokenData = await tokenResponse.json()
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000),
      apiDomain: tokenData.api_domain || 'https://api.pipedrive.com',
    }

    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )
    if (existing) {
      return integrationRepository.update(organizationId, provider, {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
        config: { apiDomain: tokens.apiDomain },
      })
    }
    return integrationRepository.create({
      organizationId,
      provider,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      connectedById: userId,
      config: { apiDomain: tokens.apiDomain },
    })
  }

  if (provider === 'monday') {
    const tokenResponse = await fetch('https://auth.monday.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: config.monday.clientId || '',
        client_secret: config.monday.clientSecret || '',
        redirect_uri: callbackUri,
        code,
      }),
    })
    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text()
      console.error(
        'Monday token exchange failed:',
        tokenResponse.status,
        errorData,
      )
      throw new Error(
        `Monday token exchange failed (${tokenResponse.status}): ${errorData}`,
      )
    }
    const tokenData = await tokenResponse.json()
    const tokens = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : new Date(Date.now() + 86400 * 1000),
    }

    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )
    if (existing) {
      return integrationRepository.update(organizationId, provider, {
        accessToken: encryptToken(tokens.accessToken),
        refreshToken: encryptToken(tokens.refreshToken),
        tokenExpiresAt: tokens.expiresAt,
      })
    }
    return integrationRepository.create({
      organizationId,
      provider,
      accessToken: encryptToken(tokens.accessToken),
      refreshToken: encryptToken(tokens.refreshToken),
      tokenExpiresAt: tokens.expiresAt,
      connectedById: userId,
    })
  }

  // For webhook, just create the integration without tokens
  if (provider === 'webhook') {
    const existing = await integrationRepository.findByOrganizationAndProvider(
      organizationId,
      provider,
    )

    if (existing) {
      return existing
    }

    return integrationRepository.create({
      organizationId,
      provider,
      connectedById: userId,
      config: {
        webhookUrl: '',
        webhookEvents: [],
      },
    })
  }

  throw new Error(`OAuth callback not supported for provider: ${provider}`)
}

export const updateIntegrationConfig = async (
  organizationId: string,
  provider: string,
  config: IntegrationConfig,
) => {
  return integrationRepository.update(organizationId, provider, { config })
}

export const disconnectIntegration = async (
  organizationId: string,
  provider: string,
) => {
  return integrationRepository.deleteByOrganizationAndProvider(
    organizationId,
    provider,
  )
}

export const testConnection = async (
  organizationId: string,
  provider: string,
) => {
  // EnrichEngine uses separate API key-based connection
  if (provider === 'enrichengine') {
    return enrichEngineService.testConnection(organizationId)
  }

  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    provider,
  )

  if (!integration) {
    return { success: false, message: 'Integration not connected' }
  }

  if (provider === 'google_sheets') {
    return googleSheetsService.testConnection(organizationId)
  }

  if (provider === 'hubspot') {
    return hubspotService.testConnection(organizationId)
  }

  if (provider === 'webhook') {
    // For webhooks, just verify the URL is configured
    const webhookConfig = integration.config as IntegrationConfig | null
    if (webhookConfig?.webhookUrl) {
      return { success: true, message: 'Webhook URL configured' }
    }
    return { success: false, message: 'No webhook URL configured' }
  }

  return { success: true, message: 'Connection successful' }
}

// ===== Google Sheets specific functions =====

export const listGoogleSheets = async (organizationId: string) => {
  return googleSheetsService.listSpreadsheets(organizationId)
}

export const getGoogleSheetColumns = async (
  organizationId: string,
  spreadsheetId: string,
) => {
  return googleSheetsService.getSpreadsheetColumns(
    organizationId,
    spreadsheetId,
  )
}

export const getGoogleSheetData = async (
  organizationId: string,
  spreadsheetId: string,
) => {
  return googleSheetsService.readSpreadsheetData(organizationId, spreadsheetId)
}

export const getGoogleSheetName = async (
  organizationId: string,
  spreadsheetId: string,
) => {
  return googleSheetsService.getSpreadsheetName(organizationId, spreadsheetId)
}

// ===== HubSpot specific functions =====

export const getHubSpotContactsSummary = async (organizationId: string) => {
  return hubspotService.getContactsSummary(organizationId)
}

export const fetchHubSpotContacts = async (
  organizationId: string,
  maxContacts?: number,
) => {
  return hubspotService.fetchAllContacts(organizationId, maxContacts)
}

// ===== Google Sheets Export Functions =====

/**
 * Check if the current token has write scopes for export
 */
export const checkSheetsWriteAccess = async (
  organizationId: string,
): Promise<{ hasWriteAccess: boolean; needsReauth: boolean }> => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'google_sheets',
  )

  if (!integration) {
    return { hasWriteAccess: false, needsReauth: false }
  }

  const hasWriteAccess =
    await googleSheetsService.hasWriteScopes(organizationId)

  return {
    hasWriteAccess,
    needsReauth: !hasWriteAccess,
  }
}

/**
 * Export leads to Google Sheets
 */
export const exportLeadsToSheet = async (
  organizationId: string,
  leadIds: string[],
  target: ExportTarget,
  existingSheetId?: string,
  newSheetTitle?: string,
): Promise<ExportToSheetResult> => {
  // Get leads data
  const leads = await leadRepository.findByIds(leadIds, organizationId)

  if (leads.length === 0) {
    throw new Error('No leads found to export')
  }

  // Prepare headers and rows
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Title',
    'LinkedIn URL',
  ]

  const rows = leads.map((lead) => [
    lead.firstName || '',
    lead.lastName || '',
    lead.email || '',
    lead.phone || '',
    lead.company || '',
    lead.title || '',
    lead.linkedInUrl || '',
  ])

  return exportDataToSheet(
    organizationId,
    target,
    existingSheetId,
    newSheetTitle || 'Exported Leads',
    headers,
    rows,
  )
}

/**
 * Export a list to Google Sheets
 */
export const exportListToSheet = async (
  organizationId: string,
  listId: string,
  target: ExportTarget,
  existingSheetId?: string,
  newSheetTitle?: string,
): Promise<ExportToSheetResult> => {
  // Get list details
  const list = await leadListRepository.findById(listId, organizationId)
  if (!list) {
    throw new Error('List not found')
  }

  // Get all leads from the list
  const leads = await leadListEntryRepository.findAllByList(listId)

  if (leads.length === 0) {
    throw new Error('No leads in this list to export')
  }

  // Prepare headers and rows
  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Title',
    'LinkedIn URL',
    'Website',
  ]

  const rows = leads.map((lead) => [
    lead.firstName || '',
    lead.lastName || '',
    lead.email || '',
    lead.phone || '',
    lead.company || '',
    lead.title || '',
    lead.linkedInUrl || '',
    lead.website || '',
  ])

  const sheetTitle = newSheetTitle || list.name

  return exportDataToSheet(
    organizationId,
    target,
    existingSheetId,
    sheetTitle,
    headers,
    rows,
  )
}

/**
 * Export analytics data to Google Sheets
 */
export const exportAnalyticsToSheet = async (
  organizationId: string,
  dateRange: { start: string; end: string },
  target: ExportTarget,
  existingSheetId?: string,
  newSheetTitle?: string,
): Promise<ExportToSheetResult> => {
  // Get analytics data
  const analytics = await analyticsService.getCallAnalytics({
    organizationId,
    startDate: dateRange.start,
    endDate: dateRange.end,
  })

  // Prepare data for export
  const headers = ['Metric', 'Value']
  const rows: (string | null)[][] = [
    ['Total Calls', String(analytics.metrics.totalCalls)],
    ['Outbound Calls', String(analytics.metrics.outboundCalls)],
    ['Inbound Calls', String(analytics.metrics.inboundCalls)],
    ['Connected Calls', String(analytics.metrics.connectedCalls)],
    [
      'Connection Rate',
      `${(analytics.metrics.connectionRate * 100).toFixed(1)}%`,
    ],
    ['Total Talk Time', formatDuration(analytics.metrics.totalTalkTimeSeconds)],
    [
      'Avg Call Duration',
      formatDuration(analytics.metrics.avgCallDurationSeconds),
    ],
    ['', ''], // Empty row separator
    ['Disposition Breakdown', ''],
  ]

  // Add disposition breakdown
  for (const disposition of analytics.dispositionBreakdown) {
    rows.push([
      disposition.label || 'No Disposition',
      String(disposition.count),
    ])
  }

  // Add calls over time
  rows.push(['', ''])
  rows.push(['Calls Over Time', ''])
  rows.push(['Date', 'Outbound', 'Inbound', 'Connected'])
  for (const item of analytics.callsOverTime) {
    rows.push([
      item.date,
      String(item.outbound),
      String(item.inbound),
      String(item.connected),
    ])
  }

  const sheetTitle =
    newSheetTitle || `Analytics ${dateRange.start} to ${dateRange.end}`

  return exportDataToSheet(
    organizationId,
    target,
    existingSheetId,
    sheetTitle,
    headers,
    rows,
  )
}

/**
 * Helper: Export data to a new or existing sheet
 */
async function exportDataToSheet(
  organizationId: string,
  target: ExportTarget,
  existingSheetId: string | undefined,
  sheetTitle: string,
  headers: string[],
  rows: (string | null)[][],
): Promise<ExportToSheetResult> {
  let spreadsheetId: string
  let spreadsheetUrl: string
  let spreadsheetName: string

  if (target === 'new_sheet') {
    // Create new spreadsheet
    const created = await googleSheetsService.createSpreadsheet(
      organizationId,
      sheetTitle,
    )
    spreadsheetId = created.id
    spreadsheetUrl = created.url
    spreadsheetName = sheetTitle
  } else {
    // Use existing spreadsheet
    if (!existingSheetId) {
      throw new Error('Existing sheet ID required for existing_sheet target')
    }
    spreadsheetId = existingSheetId
    spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
    spreadsheetName = await googleSheetsService.getSpreadsheetName(
      organizationId,
      spreadsheetId,
    )
  }

  // Write data to the spreadsheet
  const result = await googleSheetsService.writeSpreadsheetData(
    organizationId,
    spreadsheetId,
    'Sheet1',
    headers,
    rows,
  )

  return {
    success: true,
    spreadsheetId,
    spreadsheetUrl,
    spreadsheetName,
    rowsExported: result.rowsWritten,
  }
}

/**
 * Helper: Format seconds as HH:MM:SS
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}

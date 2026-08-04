import { google, sheets_v4, drive_v3 } from 'googleapis'
import { config } from '@/config'
import { decrypt, encrypt } from '@/lib/encryption'
import * as integrationRepository from '@/repositories/integration.repository'

function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

const oauth2Client = new google.auth.OAuth2(
  config.providers.google.clientId,
  config.providers.google.clientSecret,
)

export interface Spreadsheet {
  id: string
  name: string
  modifiedTime: string
}

export interface SpreadsheetColumn {
  index: number
  name: string
}

export interface SpreadsheetRow {
  rowIndex: number
  values: (string | null)[]
}

// Scopes for read-only access (existing users may have these)
const READ_ONLY_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
]

// Scopes for read/write access (new connections)
const READ_WRITE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
]

// Get OAuth URL for Google Sheets authorization (now with write scopes)
export const getOAuthUrl = (state: string, redirectUri: string): string => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: READ_WRITE_SCOPES,
    state,
    redirect_uri: redirectUri,
  })
}

// Exchange authorization code for tokens
export const exchangeCodeForTokens = async (
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> => {
  const { tokens } = await oauth2Client.getToken({
    code,
    redirect_uri: redirectUri,
  })

  if (!tokens.access_token) {
    throw new Error('Failed to get access token from Google')
  }

  const expiresAt = tokens.expiry_date
    ? new Date(tokens.expiry_date)
    : new Date(Date.now() + 3600 * 1000) // Default 1 hour

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token || '',
    expiresAt,
  }
}

// Refresh access token if expired
export const refreshAccessToken = async (
  refreshToken: string,
): Promise<{
  accessToken: string
  expiresAt: Date
}> => {
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

// Get authenticated client with token refresh
const getAuthenticatedClient = async (
  organizationId: string,
): Promise<{ sheets: sheets_v4.Sheets; drive: drive_v3.Drive }> => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'google_sheets',
  )

  if (!integration || !integration.accessToken) {
    throw new Error(
      'Google Sheets not connected. Please reconnect the integration.',
    )
  }

  let accessToken =
    decryptToken(integration.accessToken) || integration.accessToken

  // Check if token needs refresh (5 minute buffer)
  const tokenExpiresAt = integration.tokenExpiresAt
    ? new Date(integration.tokenExpiresAt).getTime()
    : 0
  const needsRefresh = tokenExpiresAt < Date.now() + 5 * 60 * 1000

  if (needsRefresh) {
    const refreshToken = decryptToken(integration.refreshToken)
    // Check if we have a valid refresh token (not null, undefined, or empty string)
    if (!refreshToken || refreshToken.trim() === '') {
      throw new Error(
        'Google Sheets token expired. Please disconnect and reconnect the integration.',
      )
    }

    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      // Update tokens in database (encrypt before saving)
      await integrationRepository.update(organizationId, 'google_sheets', {
        accessToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
      })
    } catch (error) {
      throw new Error(
        'Failed to refresh Google Sheets token. Please disconnect and reconnect the integration.',
      )
    }
  }

  oauth2Client.setCredentials({ access_token: accessToken })

  return {
    sheets: google.sheets({ version: 'v4', auth: oauth2Client }),
    drive: google.drive({ version: 'v3', auth: oauth2Client }),
  }
}

// List user's Google Sheets spreadsheets
export const listSpreadsheets = async (
  organizationId: string,
): Promise<Spreadsheet[]> => {
  const { drive } = await getAuthenticatedClient(organizationId)

  try {
    const response = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id, name, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    })

    return (response.data.files || []).map((file) => ({
      id: file.id!,
      name: file.name!,
      modifiedTime: file.modifiedTime!,
    }))
  } catch (error: unknown) {
    // Extract meaningful error from Google API response
    const gaxiosError = error as {
      response?: { data?: { error?: { message?: string } } }
      message?: string
    }
    const googleMessage = gaxiosError.response?.data?.error?.message
    const message =
      googleMessage || gaxiosError.message || 'Failed to list spreadsheets'
    console.error('Google Drive API error:', message, error)
    throw new Error(message)
  }
}

// Get column headers from first row of spreadsheet
export const getSpreadsheetColumns = async (
  organizationId: string,
  spreadsheetId: string,
): Promise<SpreadsheetColumn[]> => {
  const { sheets } = await getAuthenticatedClient(organizationId)

  // Get spreadsheet metadata to find first sheet name
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })

  const firstSheetTitle =
    metadata.data.sheets?.[0]?.properties?.title || 'Sheet1'

  // Get first row (headers)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${firstSheetTitle}'!1:1`,
  })

  const headers = response.data.values?.[0] || []

  return headers.map((header, index) => ({
    index,
    name: String(header || `Column ${index + 1}`),
  }))
}

// Read all data from spreadsheet (excluding header row)
export const readSpreadsheetData = async (
  organizationId: string,
  spreadsheetId: string,
): Promise<SpreadsheetRow[]> => {
  const { sheets } = await getAuthenticatedClient(organizationId)

  // Get spreadsheet metadata to find first sheet name
  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  })

  const firstSheetTitle =
    metadata.data.sheets?.[0]?.properties?.title || 'Sheet1'

  // Get all data starting from row 2 (skip headers)
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${firstSheetTitle}'!A2:Z`,
  })

  const rows = response.data.values || []

  return rows.map((row, index) => ({
    rowIndex: index + 2, // Account for header row and 0-indexing
    values: row.map((cell) =>
      cell !== undefined && cell !== '' ? String(cell) : null,
    ),
  }))
}

// Get spreadsheet name by ID
export const getSpreadsheetName = async (
  organizationId: string,
  spreadsheetId: string,
): Promise<string> => {
  const { sheets } = await getAuthenticatedClient(organizationId)

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'properties.title',
  })

  return response.data.properties?.title || 'Imported Sheet'
}

// Test the connection by attempting to list spreadsheets
export const testConnection = async (
  organizationId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    await listSpreadsheets(organizationId)
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return { success: false, message }
  }
}

// Check if the current token has write scopes
export const hasWriteScopes = async (
  organizationId: string,
): Promise<boolean> => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'google_sheets',
  )

  if (!integration || !integration.accessToken) {
    return false
  }

  let accessToken =
    decryptToken(integration.accessToken) || integration.accessToken

  // Check if token needs refresh (5 minute buffer)
  const tokenExpiresAt = integration.tokenExpiresAt
    ? new Date(integration.tokenExpiresAt).getTime()
    : 0
  const needsRefresh = tokenExpiresAt < Date.now() + 5 * 60 * 1000

  if (needsRefresh) {
    const refreshToken = decryptToken(integration.refreshToken)
    // Check if we have a valid refresh token
    if (!refreshToken || refreshToken.trim() === '') {
      return false
    }

    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      // Update tokens in database (encrypt before saving)
      await integrationRepository.update(organizationId, 'google_sheets', {
        accessToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
      })
    } catch {
      // If refresh fails, we can't check scopes
      return false
    }
  }

  try {
    // Try to get token info to check scopes
    oauth2Client.setCredentials({ access_token: accessToken })
    const tokenInfo = await oauth2Client.getTokenInfo(accessToken)
    const scopes = tokenInfo.scopes || []

    // Check if we have the write scopes
    return (
      scopes.includes('https://www.googleapis.com/auth/spreadsheets') ||
      scopes.includes('https://www.googleapis.com/auth/drive.file')
    )
  } catch {
    // If we can't check, assume no write access
    return false
  }
}

// Create a new spreadsheet
export const createSpreadsheet = async (
  organizationId: string,
  title: string,
): Promise<{ id: string; url: string }> => {
  const { sheets } = await getAuthenticatedClient(organizationId)

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title,
      },
    },
  })

  const spreadsheetId = response.data.spreadsheetId
  if (!spreadsheetId) {
    throw new Error('Failed to create spreadsheet')
  }

  return {
    id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
  }
}

// Write data to a spreadsheet (replaces existing data in the sheet)
export const writeSpreadsheetData = async (
  organizationId: string,
  spreadsheetId: string,
  sheetName: string,
  headers: string[],
  rows: (string | null)[][],
): Promise<{ rowsWritten: number }> => {
  const { sheets } = await getAuthenticatedClient(organizationId)

  // Combine headers and rows
  const values = [headers, ...rows]

  // Clear existing data and write new data
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `'${sheetName}'!A:Z`,
  })

  const response = await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `'${sheetName}'!A1`,
    valueInputOption: 'RAW',
    requestBody: {
      values,
    },
  })

  return {
    rowsWritten: response.data.updatedRows || rows.length,
  }
}

// Append data to an existing spreadsheet (adds to the end)
export const appendSpreadsheetData = async (
  organizationId: string,
  spreadsheetId: string,
  sheetName: string,
  rows: (string | null)[][],
): Promise<{ rowsAppended: number }> => {
  const { sheets } = await getAuthenticatedClient(organizationId)

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `'${sheetName}'!A:A`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: rows,
    },
  })

  return {
    rowsAppended: response.data.updates?.updatedRows || rows.length,
  }
}

import { config } from '@/config'
import { encrypt, decrypt } from '@/lib/encryption'
import * as integrationRepository from '@/repositories/integration.repository'
import {
  HubSpotContact,
  HubSpotContactsSummary,
} from '@shared/types/src/requests/integration'

function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

const HUBSPOT_AUTH_URL = 'https://app.hubspot.com/oauth/authorize'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const HUBSPOT_API_BASE = 'https://api.hubapi.com'

const SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'oauth',
]

export const getOAuthUrl = (state: string, redirectUri: string): string => {
  const params = new URLSearchParams({
    client_id: config.hubspot.clientId || '',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    state,
  })
  return `${HUBSPOT_AUTH_URL}?${params.toString()}`
}

export const exchangeCodeForTokens = async (
  code: string,
  redirectUri: string,
): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> => {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.hubspot.clientId || '',
      client_secret: config.hubspot.clientSecret || '',
      redirect_uri: redirectUri,
      code,
    }),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('HubSpot token exchange failed:', response.status, errorData)
    throw new Error(
      `HubSpot token exchange failed (${response.status}): ${errorData}`,
    )
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

export const refreshAccessToken = async (
  refreshToken: string,
): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> => {
  const response = await fetch(HUBSPOT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.hubspot.clientId || '',
      client_secret: config.hubspot.clientSecret || '',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('HubSpot token refresh failed:', errorData)
    throw new Error('Failed to refresh HubSpot access token')
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

const getAuthenticatedHeaders = async (
  organizationId: string,
): Promise<Record<string, string>> => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'hubspot',
  )

  if (!integration || !integration.accessToken) {
    throw new Error(
      'HubSpot not connected. Please connect the integration first.',
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
    if (!refreshToken || refreshToken.trim() === '') {
      throw new Error(
        'HubSpot token expired. Please disconnect and reconnect the integration.',
      )
    }

    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      await integrationRepository.update(organizationId, 'hubspot', {
        accessToken: encrypt(refreshed.accessToken),
        refreshToken: encrypt(refreshed.refreshToken),
        tokenExpiresAt: refreshed.expiresAt,
      })
    } catch (error) {
      throw new Error(
        'Failed to refresh HubSpot token. Please disconnect and reconnect the integration.',
      )
    }
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const fetchAllContacts = async (
  organizationId: string,
  maxContacts?: number,
): Promise<HubSpotContact[]> => {
  const headers = await getAuthenticatedHeaders(organizationId)
  const contacts: HubSpotContact[] = []
  let after: string | undefined = undefined
  const limit = 100

  do {
    const params = new URLSearchParams({
      limit: String(limit),
      properties: 'firstname,lastname,email,phone,company,jobtitle',
    })
    if (after) {
      params.set('after', after)
    }

    const response = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?${params.toString()}`,
      { headers },
    )

    if (!response.ok) {
      const errorData = await response.text()
      console.error('HubSpot contacts API error:', errorData)
      throw new Error('Failed to fetch contacts from HubSpot')
    }

    const data = await response.json()

    for (const result of data.results || []) {
      contacts.push({
        id: result.id,
        firstName: result.properties?.firstname || null,
        lastName: result.properties?.lastname || null,
        email: result.properties?.email || null,
        phone: result.properties?.phone || null,
        company: result.properties?.company || null,
        jobTitle: result.properties?.jobtitle || null,
      })

      if (maxContacts && contacts.length >= maxContacts) {
        return contacts.slice(0, maxContacts)
      }
    }

    after = data.paging?.next?.after
    if (after) {
      await delay(120) // Rate limit: ~8 requests/sec
    }
  } while (after)

  return contacts
}

export const getContactsSummary = async (
  organizationId: string,
): Promise<HubSpotContactsSummary> => {
  const headers = await getAuthenticatedHeaders(organizationId)

  const params = new URLSearchParams({
    limit: '100',
    properties: 'firstname,lastname,email,phone,company,jobtitle',
  })

  const response = await fetch(
    `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?${params.toString()}`,
    { headers },
  )

  if (!response.ok) {
    throw new Error('Failed to fetch contacts summary from HubSpot')
  }

  const data = await response.json()
  const results = data.results || []

  const contacts: HubSpotContact[] = results.map(
    (result: { id: string; properties?: Record<string, string | null> }) => ({
      id: result.id,
      firstName: result.properties?.firstname || null,
      lastName: result.properties?.lastname || null,
      email: result.properties?.email || null,
      phone: result.properties?.phone || null,
      company: result.properties?.company || null,
      jobTitle: result.properties?.jobtitle || null,
    }),
  )

  // HubSpot doesn't give total count in list endpoint easily,
  // so estimate based on whether there's a next page
  const hasMore = !!data.paging?.next?.after
  const estimatedTotal = hasMore ? results.length + '+' : results.length

  return {
    totalContacts:
      typeof estimatedTotal === 'number'
        ? estimatedTotal
        : parseInt(estimatedTotal),
    contactsWithPhone: contacts.filter((c) => c.phone).length,
    contactsWithEmail: contacts.filter((c) => c.email).length,
    sampleContacts: contacts.slice(0, 5),
  }
}

export const testConnection = async (
  organizationId: string,
): Promise<{ success: boolean; message: string }> => {
  try {
    await getContactsSummary(organizationId)
    return { success: true, message: 'Connection successful' }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed'
    return { success: false, message }
  }
}

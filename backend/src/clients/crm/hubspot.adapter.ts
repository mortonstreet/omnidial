import { CrmAdapter, CrmContact, CrmPushResult, CrmSearchResult } from './types'
import { decrypt } from '@/lib/encryption'
import { config } from '@/config'
import * as integrationRepository from '@/repositories/integration.repository'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'

function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  refreshToken: string
  expiresAt: Date
}> {
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

async function getHubSpotHeaders(
  organizationId: string,
): Promise<Record<string, string>> {
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
      const { encrypt } = await import('@/lib/encryption')
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

export class HubSpotCrmAdapter implements CrmAdapter {
  readonly provider = 'hubspot'
  private organizationId: string

  constructor(organizationId: string) {
    this.organizationId = organizationId
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getHubSpotHeaders(this.organizationId)
      const response = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`,
        { headers },
      )

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, message: `HubSpot API error: ${errorText}` }
      }

      return { success: true, message: 'HubSpot connection successful' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  async pushContact(contact: CrmContact): Promise<CrmPushResult> {
    const headers = await getHubSpotHeaders(this.organizationId)

    const properties: Record<string, string> = {}
    if (contact.firstName) properties.firstname = contact.firstName
    if (contact.lastName) properties.lastname = contact.lastName
    if (contact.email) properties.email = contact.email
    if (contact.phone) properties.phone = contact.phone
    if (contact.company) properties.company = contact.company
    if (contact.title) properties.jobtitle = contact.title
    if (contact.linkedInUrl) properties.hs_linkedin_url = contact.linkedInUrl

    // Try to create the contact
    const createResponse = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties }),
      },
    )

    if (createResponse.ok) {
      const data = await createResponse.json()
      return {
        externalId: data.id,
        externalUrl: `https://app.hubspot.com/contacts/${data.id}`,
        success: true,
      }
    }

    // Handle 409 conflict (contact already exists) - search and update
    if (createResponse.status === 409) {
      if (!contact.email) {
        throw new Error(
          'Contact already exists in HubSpot but no email provided for lookup',
        )
      }

      const searchResults = await this.searchContact(contact.email)
      if (searchResults.length === 0) {
        throw new Error(
          'Contact conflict in HubSpot but could not find existing record',
        )
      }

      const existingId = searchResults[0].externalId

      // Update the existing contact
      const updateResponse = await fetch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${existingId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ properties }),
        },
      )

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        throw new Error(`Failed to update HubSpot contact: ${errorText}`)
      }

      return {
        externalId: existingId,
        externalUrl: `https://app.hubspot.com/contacts/${existingId}`,
        success: true,
      }
    }

    const errorText = await createResponse.text()
    throw new Error(`Failed to create HubSpot contact: ${errorText}`)
  }

  async searchContact(query: string): Promise<CrmSearchResult[]> {
    const headers = await getHubSpotHeaders(this.organizationId)

    const response = await fetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName: 'email',
                  operator: 'EQ',
                  value: query,
                },
              ],
            },
          ],
          properties: ['email'],
          limit: 10,
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HubSpot search failed: ${errorText}`)
    }

    const data = await response.json()
    return (data.results || []).map(
      (result: { id: string; properties?: { email?: string } }) => ({
        externalId: result.id,
        email: result.properties?.email,
      }),
    )
  }
}

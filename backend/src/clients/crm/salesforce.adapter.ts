import { CrmAdapter, CrmContact, CrmPushResult, CrmSearchResult } from './types'
import { decrypt, encrypt } from '@/lib/encryption'
import * as integrationRepository from '@/repositories/integration.repository'

const SF_API_VERSION = 'v59.0'

function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

interface SalesforceConfig {
  instanceUrl: string
  clientId?: string
  clientSecret?: string
}

async function getSalesforceAuth(organizationId: string): Promise<{
  headers: Record<string, string>
  instanceUrl: string
}> {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'salesforce',
  )

  if (!integration || !integration.accessToken) {
    throw new Error(
      'Salesforce not connected. Please connect the integration first.',
    )
  }

  const integrationConfig = (
    typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config
  ) as SalesforceConfig | null

  const instanceUrl = integrationConfig?.instanceUrl
  if (!instanceUrl) {
    throw new Error('Salesforce instance URL not configured')
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
        'Salesforce token expired. Please disconnect and reconnect the integration.',
      )
    }

    try {
      const refreshed = await refreshSalesforceToken(
        instanceUrl,
        refreshToken,
        integrationConfig?.clientId,
        integrationConfig?.clientSecret,
      )
      accessToken = refreshed.accessToken

      await integrationRepository.update(organizationId, 'salesforce', {
        accessToken: encrypt(refreshed.accessToken),
        ...(refreshed.refreshToken && {
          refreshToken: encrypt(refreshed.refreshToken),
        }),
        tokenExpiresAt: refreshed.expiresAt,
      })
    } catch (error) {
      throw new Error(
        'Failed to refresh Salesforce token. Please disconnect and reconnect the integration.',
      )
    }
  }

  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    instanceUrl,
  }
}

async function refreshSalesforceToken(
  instanceUrl: string,
  refreshToken: string,
  clientId?: string,
  clientSecret?: string,
): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt: Date
}> {
  const params: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }
  if (clientId) params.client_id = clientId
  if (clientSecret) params.client_secret = clientSecret

  const response = await fetch(`${instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('Salesforce token refresh failed:', errorData)
    throw new Error('Failed to refresh Salesforce access token')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    // Salesforce tokens typically last 2 hours
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
  }
}

export class SalesforceCrmAdapter implements CrmAdapter {
  readonly provider = 'salesforce'
  private organizationId: string

  constructor(organizationId: string) {
    this.organizationId = organizationId
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { headers, instanceUrl } = await getSalesforceAuth(
        this.organizationId,
      )
      const response = await fetch(
        `${instanceUrl}/services/data/${SF_API_VERSION}/limits`,
        { headers },
      )

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, message: `Salesforce API error: ${errorText}` }
      }

      return { success: true, message: 'Salesforce connection successful' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  async pushContact(contact: CrmContact): Promise<CrmPushResult> {
    const { headers, instanceUrl } = await getSalesforceAuth(
      this.organizationId,
    )

    if (!contact.email) {
      throw new Error('Email is required to push a contact to Salesforce')
    }

    const sfContact: Record<string, string> = {}
    if (contact.firstName) sfContact.FirstName = contact.firstName
    if (contact.lastName) sfContact.LastName = contact.lastName
    if (contact.email) sfContact.Email = contact.email
    if (contact.phone) sfContact.Phone = contact.phone
    if (contact.title) sfContact.Title = contact.title
    if (contact.linkedInUrl) sfContact.LinkedIn_Profile__c = contact.linkedInUrl
    // Note: Company maps to Account in Salesforce; for Contact upsert we use AccountName if available
    // The standard Contact object doesn't have a direct Company field; it's linked via AccountId
    // For simplicity, we skip company in direct Contact upsert

    // Upsert by email
    const encodedEmail = encodeURIComponent(contact.email)
    const response = await fetch(
      `${instanceUrl}/services/data/${SF_API_VERSION}/sobjects/Contact/Email/${encodedEmail}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify(sfContact),
      },
    )

    // 200 = updated, 201 = created, 204 = updated (no content)
    if (response.ok || response.status === 201 || response.status === 204) {
      let externalId: string

      if (response.status === 201) {
        const data = await response.json()
        externalId = data.id
      } else {
        // For updates, we need to search for the contact to get the ID
        const searchResults = await this.searchContact(contact.email)
        externalId = searchResults.length > 0 ? searchResults[0].externalId : ''
      }

      return {
        externalId,
        externalUrl: externalId ? `${instanceUrl}/${externalId}` : undefined,
        success: true,
      }
    }

    const errorText = await response.text()
    throw new Error(`Failed to upsert Salesforce contact: ${errorText}`)
  }

  async searchContact(query: string): Promise<CrmSearchResult[]> {
    const { headers, instanceUrl } = await getSalesforceAuth(
      this.organizationId,
    )

    const escapedQuery = query.replace(/'/g, "\\'")
    const soql = `SELECT Id,Email FROM Contact WHERE Email='${escapedQuery}'`
    const response = await fetch(
      `${instanceUrl}/services/data/${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`,
      { headers },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Salesforce search failed: ${errorText}`)
    }

    const data = await response.json()
    return (data.records || []).map(
      (record: { Id: string; Email?: string }) => ({
        externalId: record.Id,
        email: record.Email,
      }),
    )
  }
}

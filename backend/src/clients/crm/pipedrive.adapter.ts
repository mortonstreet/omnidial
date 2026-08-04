import { CrmAdapter, CrmContact, CrmPushResult, CrmSearchResult } from './types'
import { decrypt, encrypt } from '@/lib/encryption'
import { config } from '@/config'
import * as integrationRepository from '@/repositories/integration.repository'

const PIPEDRIVE_TOKEN_URL = 'https://oauth.pipedrive.com/oauth/token'

function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

interface PipedriveConfig {
  apiDomain?: string
}

async function getPipedriveAuth(organizationId: string): Promise<{
  headers: Record<string, string>
  apiDomain: string
}> {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'pipedrive',
  )

  if (!integration || !integration.accessToken) {
    throw new Error(
      'Pipedrive not connected. Please connect the integration first.',
    )
  }

  const integrationConfig = (
    typeof integration.config === 'string'
      ? JSON.parse(integration.config)
      : integration.config
  ) as PipedriveConfig | null

  const apiDomain = integrationConfig?.apiDomain || 'https://api.pipedrive.com'

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
        'Pipedrive token expired. Please disconnect and reconnect the integration.',
      )
    }

    try {
      const response = await fetch(PIPEDRIVE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(`${config.pipedrive.clientId || ''}:${config.pipedrive.clientSecret || ''}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!response.ok) {
        const errorData = await response.text()
        console.error('Pipedrive token refresh failed:', errorData)
        throw new Error('Failed to refresh Pipedrive access token')
      }

      const data = await response.json()
      accessToken = data.access_token

      await integrationRepository.update(organizationId, 'pipedrive', {
        accessToken: encrypt(data.access_token),
        refreshToken: encrypt(data.refresh_token),
        tokenExpiresAt: data.expires_in
          ? new Date(Date.now() + data.expires_in * 1000)
          : new Date(Date.now() + 3600 * 1000),
        ...(data.api_domain && {
          config: { apiDomain: data.api_domain },
        }),
      })
    } catch (error) {
      throw new Error(
        'Failed to refresh Pipedrive token. Please disconnect and reconnect the integration.',
      )
    }
  }

  return {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    apiDomain,
  }
}

export class PipedriveCrmAdapter implements CrmAdapter {
  readonly provider = 'pipedrive'
  private organizationId: string

  constructor(organizationId: string) {
    this.organizationId = organizationId
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { headers, apiDomain } = await getPipedriveAuth(this.organizationId)
      const response = await fetch(`${apiDomain}/v1/users/me`, { headers })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, message: `Pipedrive API error: ${errorText}` }
      }

      return { success: true, message: 'Pipedrive connection successful' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  async pushContact(contact: CrmContact): Promise<CrmPushResult> {
    const { headers, apiDomain } = await getPipedriveAuth(this.organizationId)

    if (!contact.email) {
      throw new Error('Email is required to push a contact to Pipedrive')
    }

    // Search for existing person by email first
    const existing = await this.searchContact(contact.email)

    const personData: Record<string, unknown> = {
      name:
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
        contact.email,
      email: [contact.email],
    }
    if (contact.phone) personData.phone = [contact.phone]
    if (contact.title) personData.job_title = contact.title

    if (existing.length > 0) {
      // Update existing person
      const personId = existing[0].externalId
      const response = await fetch(`${apiDomain}/v1/persons/${personId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(personData),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Failed to update Pipedrive person: ${errorText}`)
      }

      return {
        externalId: personId,
        externalUrl: `${apiDomain}/person/${personId}`,
        success: true,
      }
    }

    // Create new person
    const response = await fetch(`${apiDomain}/v1/persons`, {
      method: 'POST',
      headers,
      body: JSON.stringify(personData),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to create Pipedrive person: ${errorText}`)
    }

    const data = await response.json()
    const personId = String(data.data?.id || '')

    return {
      externalId: personId,
      externalUrl: personId ? `${apiDomain}/person/${personId}` : undefined,
      success: true,
    }
  }

  async searchContact(query: string): Promise<CrmSearchResult[]> {
    const { headers, apiDomain } = await getPipedriveAuth(this.organizationId)

    const params = new URLSearchParams({
      term: query,
      item_types: 'person',
      fields: 'email',
      limit: '10',
    })

    const response = await fetch(
      `${apiDomain}/v1/persons/search?${params.toString()}`,
      { headers },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Pipedrive search failed: ${errorText}`)
    }

    const data = await response.json()
    return (data.data?.items || []).map(
      (item: { item?: { id?: number; primary_email?: string } }) => ({
        externalId: String(item.item?.id || ''),
        email: item.item?.primary_email,
      }),
    )
  }
}

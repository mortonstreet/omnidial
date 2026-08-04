import { CrmAdapter, CrmContact, CrmPushResult, CrmSearchResult } from './types'
import { decrypt } from '@/lib/encryption'
import * as integrationRepository from '@/repositories/integration.repository'

const ATTIO_API_BASE = 'https://api.attio.com/v2'

function decryptToken(token: string | undefined | null): string | undefined {
  if (!token) return undefined
  if (token.length < 64 || !/^[0-9a-f]+$/i.test(token)) return token
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

async function getAttioHeaders(
  organizationId: string,
): Promise<Record<string, string>> {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'attio',
  )

  if (!integration || !integration.accessToken) {
    throw new Error(
      'Attio not connected. Please connect the integration first.',
    )
  }

  const accessToken =
    decryptToken(integration.accessToken) || integration.accessToken

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  }
}

export class AttioCrmAdapter implements CrmAdapter {
  readonly provider = 'attio'
  private organizationId: string

  constructor(organizationId: string) {
    this.organizationId = organizationId
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const headers = await getAttioHeaders(this.organizationId)
      const response = await fetch(`${ATTIO_API_BASE}/self`, { headers })

      if (!response.ok) {
        const errorText = await response.text()
        return { success: false, message: `Attio API error: ${errorText}` }
      }

      return { success: true, message: 'Attio connection successful' }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      }
    }
  }

  async pushContact(contact: CrmContact): Promise<CrmPushResult> {
    const headers = await getAttioHeaders(this.organizationId)

    if (!contact.email) {
      throw new Error('Email is required to push a contact to Attio')
    }

    const values: Record<string, unknown[]> = {
      email_addresses: [{ email_address: contact.email }],
    }

    if (contact.firstName || contact.lastName) {
      values.name = [
        {
          first_name: contact.firstName || '',
          last_name: contact.lastName || '',
        },
      ]
    }

    if (contact.phone) {
      values.phone_numbers = [{ phone_number: contact.phone }]
    }

    if (contact.title) {
      values.job_title = [{ job_title: contact.title }]
    }

    const response = await fetch(`${ATTIO_API_BASE}/objects/people/records`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        matching_attribute: 'email_addresses',
        data: { values },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to upsert Attio contact: ${errorText}`)
    }

    const data = await response.json()
    const recordId = data.data?.id?.record_id || data.data?.id || ''

    return {
      externalId: typeof recordId === 'string' ? recordId : String(recordId),
      externalUrl: recordId
        ? `https://app.attio.com/people/${recordId}`
        : undefined,
      success: true,
    }
  }

  async searchContact(query: string): Promise<CrmSearchResult[]> {
    const headers = await getAttioHeaders(this.organizationId)

    const response = await fetch(
      `${ATTIO_API_BASE}/objects/people/records/query`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filter: {
            email_addresses: {
              contains: query,
            },
          },
          limit: 10,
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Attio search failed: ${errorText}`)
    }

    const data = await response.json()
    return (data.data || []).map(
      (record: {
        id?: { record_id?: string }
        values?: { email_addresses?: Array<{ email_address?: string }> }
      }) => ({
        externalId: record.id?.record_id || '',
        email: record.values?.email_addresses?.[0]?.email_address,
      }),
    )
  }
}

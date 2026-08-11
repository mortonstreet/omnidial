import { CrmAdapter, CrmContact, CrmPushResult, CrmSearchResult } from './types'
import { hubspotFetch } from './hubspotFetch'
import { decrypt, encrypt } from '@/lib/encryption'
import { config } from '@/config'
import * as integrationRepository from '@/repositories/integration.repository'

const HUBSPOT_API_BASE = 'https://api.hubapi.com'
const HUBSPOT_TOKEN_URL = 'https://api.hubapi.com/oauth/v1/token'
const DEAL_TO_CONTACT_ASSOCIATION_TYPE_ID = 3
const CUSTOM_DEAL_STAGE_PROPERTY_NAME = 'deal_stage_2'
const CUSTOM_DEAL_STAGE_PROPERTY_LABEL = 'Deal Stage 2'

interface HubSpotPipelineStage {
  id: string
  label: string
  displayOrder?: number
  archived?: boolean
}

interface HubSpotPipeline {
  id: string
  label: string
  displayOrder?: number
  archived?: boolean
  stages?: HubSpotPipelineStage[]
}

interface HubSpotSearchResult {
  id: string
  properties?: Record<string, string | null>
}

interface HubSpotPropertyOption {
  label: string
  value: string
  hidden?: boolean
}

interface HubSpotDealProperty {
  name: string
  label: string
  options?: HubSpotPropertyOption[]
}

type HubSpotContactSearchProperty = 'email' | 'phone' | 'hs_linkedin_url'

const normalizeStageLabel = (label: string) =>
  label.trim().replace(/\s+/g, ' ').toLowerCase()

const getPhoneDigits = (phone: string) => phone.replace(/\D/g, '')

const phonesMatch = (a: string, b: string) => {
  const aDigits = getPhoneDigits(a)
  const bDigits = getPhoneDigits(b)
  if (!aDigits || !bDigits) return false
  return (
    aDigits === bDigits ||
    (aDigits.length >= 10 &&
      bDigits.length >= 10 &&
      aDigits.slice(-10) === bDigits.slice(-10))
  )
}

const getContactDisplayName = (contact: CrmContact): string => {
  const fullName = [contact.firstName, contact.lastName]
    .filter(Boolean)
    .join(' ')
    .trim()
  return (
    fullName ||
    contact.company ||
    contact.email ||
    contact.phone ||
    'OmniDial Lead'
  )
}

const getDealName = (contact: CrmContact): string => {
  const contactName = getContactDisplayName(contact)
  if (contact.company && contactName !== contact.company) {
    return `${contact.company} - ${contactName}`
  }
  return contactName
}

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
  const response = await hubspotFetch(HUBSPOT_TOKEN_URL, {
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
  const expiresIn = Number(data.expires_in) || 30 * 60
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  }
}

async function getHubSpotHeaders(
  organizationId: string,
  options: { forceRefresh?: boolean } = {},
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
  const needsRefresh =
    options.forceRefresh || tokenExpiresAt < Date.now() + 5 * 60 * 1000

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

const isExpiredHubSpotAuthError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  return /EXPIRED_AUTHENTICATION|OAuth token.*expired|expired.*OAuth token/i.test(
    message,
  )
}

export class HubSpotCrmAdapter implements CrmAdapter {
  readonly provider = 'hubspot'
  private organizationId: string

  constructor(organizationId: string) {
    this.organizationId = organizationId
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const checkConnection = async (forceRefresh = false) => {
        const headers = await getHubSpotHeaders(this.organizationId, {
          forceRefresh,
        })
        return hubspotFetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts?limit=1`, {
          headers,
        })
      }
      let response = await checkConnection()

      if (!response.ok) {
        const errorText = await response.text()
        if (
          response.status === 401 &&
          isExpiredHubSpotAuthError(new Error(errorText))
        ) {
          response = await checkConnection(true)
          if (response.ok) {
            return { success: true, message: 'HubSpot connection successful' }
          }
        }
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

    try {
      return await this.pushContactWithHeaders(headers, contact)
    } catch (error) {
      if (!isExpiredHubSpotAuthError(error)) {
        throw error
      }

      const refreshedHeaders = await getHubSpotHeaders(this.organizationId, {
        forceRefresh: true,
      })
      return this.pushContactWithHeaders(refreshedHeaders, contact)
    }
  }

  private async pushContactWithHeaders(
    headers: Record<string, string>,
    contact: CrmContact,
  ): Promise<CrmPushResult> {
    const properties: Record<string, string> = {}
    if (contact.firstName) properties.firstname = contact.firstName
    if (contact.lastName) properties.lastname = contact.lastName
    if (contact.email) properties.email = contact.email
    if (contact.phone) properties.phone = contact.phone
    if (contact.company) properties.company = contact.company
    if (contact.title) properties.jobtitle = contact.title
    if (contact.linkedInUrl) properties.hs_linkedin_url = contact.linkedInUrl

    const existingContactId = await this.findExistingContactId(headers, contact)
    if (existingContactId) {
      await this.updateContact(headers, existingContactId, properties)
      await this.syncDealIfStagePresent(headers, existingContactId, contact)

      return {
        externalId: existingContactId,
        externalUrl: `https://app.hubspot.com/contacts/${existingContactId}`,
        success: true,
      }
    }

    const createResponse = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ properties }),
      },
    )

    if (createResponse.ok) {
      const data = await createResponse.json()
      await this.syncDealIfStagePresent(headers, data.id, contact)

      return {
        externalId: data.id,
        externalUrl: `https://app.hubspot.com/contacts/${data.id}`,
        success: true,
      }
    }

    // Handle 409 conflict (contact already exists) - search and update
    if (createResponse.status === 409) {
      const existingId = await this.findExistingContactId(headers, contact)
      if (!existingId) {
        throw new Error(
          'Contact conflict in HubSpot but could not find existing record',
        )
      }

      await this.updateContact(headers, existingId, properties)
      await this.syncDealIfStagePresent(headers, existingId, contact)

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
    try {
      return await this.searchContactByProperty(headers, 'email', query)
    } catch (error) {
      if (!isExpiredHubSpotAuthError(error)) {
        throw error
      }

      const refreshedHeaders = await getHubSpotHeaders(this.organizationId, {
        forceRefresh: true,
      })
      return this.searchContactByProperty(refreshedHeaders, 'email', query)
    }
  }

  private async findExistingContactId(
    headers: Record<string, string>,
    contact: CrmContact,
  ): Promise<string | undefined> {
    if (contact.externalId) {
      return contact.externalId
    }

    if (contact.email) {
      const byEmail = await this.searchContactByProperty(
        headers,
        'email',
        contact.email,
      )
      if (byEmail[0]?.externalId) {
        return byEmail[0].externalId
      }
    }

    if (contact.phone) {
      const byPhone = await this.searchContactByProperty(
        headers,
        'phone',
        contact.phone,
      )
      if (byPhone[0]?.externalId) {
        return byPhone[0].externalId
      }

      const byPhoneQuery = await this.searchContactsByQuery(
        headers,
        getPhoneDigits(contact.phone).slice(-10),
      )
      const matchingPhone = byPhoneQuery.find(
        (result) => result.phone && phonesMatch(result.phone, contact.phone!),
      )
      if (matchingPhone?.externalId) {
        return matchingPhone.externalId
      }
    }

    if (contact.linkedInUrl) {
      const byLinkedIn = await this.searchContactByProperty(
        headers,
        'hs_linkedin_url',
        contact.linkedInUrl,
      )
      if (byLinkedIn[0]?.externalId) {
        return byLinkedIn[0].externalId
      }
    }

    return undefined
  }

  private async updateContact(
    headers: Record<string, string>,
    contactId: string,
    properties: Record<string, string>,
  ): Promise<void> {
    const updateResponse = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}`,
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
  }

  private async searchContactByProperty(
    headers: Record<string, string>,
    propertyName: HubSpotContactSearchProperty,
    value: string,
  ): Promise<CrmSearchResult[]> {
    const response = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filterGroups: [
            {
              filters: [
                {
                  propertyName,
                  operator: 'EQ',
                  value,
                },
              ],
            },
          ],
          properties: ['email', 'phone', 'hs_linkedin_url'],
          limit: 10,
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HubSpot search failed: ${errorText}`)
    }

    const data = await response.json()
    return (data.results || []).map((result: HubSpotSearchResult) => ({
      externalId: result.id,
      email: result.properties?.email ?? undefined,
      phone: result.properties?.phone ?? undefined,
      linkedInUrl: result.properties?.hs_linkedin_url ?? undefined,
    }))
  }

  private async searchContactsByQuery(
    headers: Record<string, string>,
    query: string,
  ): Promise<CrmSearchResult[]> {
    if (!query) return []

    const response = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query,
          properties: ['email', 'phone', 'hs_linkedin_url'],
          limit: 10,
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HubSpot search failed: ${errorText}`)
    }

    const data = await response.json()
    return (data.results || []).map((result: HubSpotSearchResult) => ({
      externalId: result.id,
      email: result.properties?.email ?? undefined,
      phone: result.properties?.phone ?? undefined,
      linkedInUrl: result.properties?.hs_linkedin_url ?? undefined,
    }))
  }

  private async syncDealIfStagePresent(
    headers: Record<string, string>,
    contactId: string,
    contact: CrmContact,
  ): Promise<void> {
    if (!contact.pipelineStageLabel) return

    const customStage = await this.findCustomDealStageOptionByLabel(
      headers,
      contact.pipelineStageLabel,
    )

    const properties: Record<string, string> = {
      dealname: getDealName(contact),
    }

    if (customStage) {
      properties[customStage.propertyName] = customStage.optionValue
    } else {
      const stage = await this.findDealStageByLabel(
        headers,
        contact.pipelineStageLabel,
      )
      properties.pipeline = stage.pipelineId
      properties.dealstage = stage.stageId
    }

    if (contact.dealValue !== undefined && contact.dealValue !== null) {
      properties.amount = String(contact.dealValue)
    }

    const existingDealId = await this.findAssociatedDealId(headers, contactId)
    if (existingDealId) {
      const updateResponse = await hubspotFetch(
        `${HUBSPOT_API_BASE}/crm/v3/objects/deals/${existingDealId}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ properties }),
        },
      )

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text()
        throw new Error(`Failed to update HubSpot deal: ${errorText}`)
      }

      return
    }

    const createResponse = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/deals`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          properties: customStage
            ? {
                ...(await this.getDefaultPipelineStageProperties(headers)),
                ...properties,
              }
            : properties,
          associations: [
            {
              to: { id: contactId },
              types: [
                {
                  associationCategory: 'HUBSPOT_DEFINED',
                  associationTypeId: DEAL_TO_CONTACT_ASSOCIATION_TYPE_ID,
                },
              ],
            },
          ],
        }),
      },
    )

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create HubSpot deal: ${errorText}`)
    }
  }

  private async findCustomDealStageOptionByLabel(
    headers: Record<string, string>,
    stageLabel: string,
  ): Promise<{ propertyName: string; optionValue: string } | undefined> {
    const response = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/properties/deals/${CUSTOM_DEAL_STAGE_PROPERTY_NAME}`,
      { headers },
    )

    if (response.status === 404) {
      return undefined
    }

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(
        `HubSpot ${CUSTOM_DEAL_STAGE_PROPERTY_LABEL} lookup failed: ${errorText}`,
      )
    }

    const property = (await response.json()) as HubSpotDealProperty
    const requested = normalizeStageLabel(stageLabel)
    const options = (property.options || []).filter((option) => !option.hidden)
    const match = options.find(
      (option) => normalizeStageLabel(option.label) === requested,
    )

    if (!match) {
      throw new Error(
        `No HubSpot ${CUSTOM_DEAL_STAGE_PROPERTY_LABEL} option named "${stageLabel}". HubSpot returned: ${options.map((option) => option.label).join(', ') || 'no active options'}. Create a matching option or rename the OmniDial stage.`,
      )
    }

    return {
      propertyName: property.name,
      optionValue: match.value,
    }
  }

  private async getDefaultPipelineStageProperties(
    headers: Record<string, string>,
  ): Promise<{ pipeline: string; dealstage: string }> {
    const response = await hubspotFetch(`${HUBSPOT_API_BASE}/crm/v3/pipelines/deals`, {
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HubSpot default deal stage lookup failed: ${errorText}`)
    }

    const data = await response.json()
    const pipelines = ((data.results || []) as HubSpotPipeline[])
      .filter((pipeline) => !pipeline.archived)
      .sort((a, b) => {
        const aOrder = a.id === 'default' ? -1 : (a.displayOrder ?? 0)
        const bOrder = b.id === 'default' ? -1 : (b.displayOrder ?? 0)
        return aOrder - bOrder
      })

    for (const pipeline of pipelines) {
      const stage = (pipeline.stages || [])
        .filter((candidate) => !candidate.archived)
        .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))[0]

      if (stage) {
        return { pipeline: pipeline.id, dealstage: stage.id }
      }
    }

    throw new Error('HubSpot returned no active default deal stage')
  }

  private async findDealStageByLabel(
    headers: Record<string, string>,
    stageLabel: string,
  ): Promise<{ pipelineId: string; stageId: string }> {
    const response = await hubspotFetch(`${HUBSPOT_API_BASE}/crm/v3/pipelines/deals`, {
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 403) {
        throw new Error(
          'HubSpot deal pipeline lookup failed. Reconnect HubSpot after enabling crm.schemas.deals.read, then try again.',
        )
      }
      throw new Error(`HubSpot deal pipeline lookup failed: ${errorText}`)
    }

    const data = await response.json()
    const requested = normalizeStageLabel(stageLabel)
    const matches: Array<{
      pipelineId: string
      pipelineLabel: string
      pipelineOrder: number
      stageId: string
      stageLabel: string
      stageOrder: number
    }> = []
    const availableStageLabels: string[] = []

    for (const pipeline of (data.results || []) as HubSpotPipeline[]) {
      if (pipeline.archived) continue

      for (const stage of pipeline.stages || []) {
        if (stage.archived) continue
        availableStageLabels.push(`${pipeline.label}: ${stage.label}`)
        if (normalizeStageLabel(stage.label) !== requested) continue

        matches.push({
          pipelineId: pipeline.id,
          pipelineLabel: pipeline.label,
          pipelineOrder:
            pipeline.id === 'default' ? -1 : (pipeline.displayOrder ?? 0),
          stageId: stage.id,
          stageLabel: stage.label,
          stageOrder: stage.displayOrder ?? 0,
        })
      }
    }

    matches.sort((a, b) => {
      if (a.pipelineOrder !== b.pipelineOrder) {
        return a.pipelineOrder - b.pipelineOrder
      }
      return a.stageOrder - b.stageOrder
    })

    const match = matches[0]
    if (!match) {
      throw new Error(
        `No HubSpot deal stage named "${stageLabel}". HubSpot returned: ${availableStageLabels.join(', ') || 'no active deal stages'}. Create a matching HubSpot deal stage, rename the OmniDial stage, or reconnect HubSpot if those stages do not match your HubSpot UI.`,
      )
    }

    if (matches.length > 1) {
      throw new Error(
        `HubSpot deal stage "${stageLabel}" is not 1-to-1. Matching stages exist in: ${matches.map((m) => m.pipelineLabel).join(', ')}. Rename duplicate HubSpot stages or keep one matching stage.`,
      )
    }

    return { pipelineId: match.pipelineId, stageId: match.stageId }
  }

  private async findAssociatedDealId(
    headers: Record<string, string>,
    contactId: string,
  ): Promise<string | undefined> {
    const response = await hubspotFetch(
      `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${contactId}?associations=deals`,
      { headers },
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to read HubSpot contact deals: ${errorText}`)
    }

    const data = await response.json()
    const deals = data.associations?.deals?.results || []
    return deals[0]?.id
  }
}

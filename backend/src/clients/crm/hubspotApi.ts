/**
 * Typed HubSpot CRM calls used by the two-way sync (hubspotSync.service).
 * Every call goes through hubspotFetch (429/5xx retry) and refreshes the
 * OAuth token once on an expired-token error.
 */
import { hubspotFetch } from './hubspotFetch'
import { getHubSpotHeaders, isExpiredHubSpotAuthError } from './hubspot.adapter'

const BASE = 'https://api.hubapi.com'

export class HubSpotApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
  }
}

const request = async <T>(
  organizationId: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> => {
  const run = async (headers: Record<string, string>) => {
    const response = await hubspotFetch(`${BASE}${path}`, {
      method: init.method ?? 'GET',
      headers,
      ...(init.body !== undefined && { body: JSON.stringify(init.body) }),
    })
    if (response.status === 204) return undefined as T
    const text = await response.text()
    if (!response.ok) {
      throw new HubSpotApiError(
        `HubSpot ${init.method ?? 'GET'} ${path.split('?')[0]} failed (${response.status}): ${text.slice(0, 500)}`,
        response.status,
      )
    }
    return (text ? JSON.parse(text) : undefined) as T
  }

  try {
    return await run(await getHubSpotHeaders(organizationId))
  } catch (error) {
    if (!isExpiredHubSpotAuthError(error)) throw error
    return run(await getHubSpotHeaders(organizationId, { forceRefresh: true }))
  }
}

export const isNotFound = (error: unknown) =>
  error instanceof HubSpotApiError && error.status === 404

// ------------------------------------------------------------ account

export interface TokenInfo {
  hub_id: number
  app_id: number
  scopes: string[]
  user?: string
}

export const getTokenInfo = async (
  organizationId: string,
): Promise<TokenInfo> => {
  const headers = await getHubSpotHeaders(organizationId)
  const token = headers.Authorization.replace(/^Bearer\s+/, '')
  const response = await hubspotFetch(`${BASE}/oauth/v1/access-tokens/${token}`)
  if (!response.ok) {
    throw new HubSpotApiError(
      `HubSpot token info failed: ${await response.text()}`,
      response.status,
    )
  }
  return (await response.json()) as TokenInfo
}

// ------------------------------------------------------------ objects

export interface HubSpotObject {
  id: string
  properties: Record<string, string | null>
  propertiesWithHistory?: Record<
    string,
    Array<{
      value: string
      timestamp: string
      sourceType?: string
      sourceId?: string
    }>
  >
  updatedAt?: string
  archived?: boolean
}

type ObjectType =
  | 'contacts'
  | 'deals'
  | 'calls'
  | 'tasks'
  | 'emails'
  | 'meetings'
  | 'notes'

export const getObject = (
  organizationId: string,
  type: ObjectType,
  id: string,
  properties: string[],
  propertiesWithHistory: string[] = [],
) => {
  const params = new URLSearchParams()
  if (properties.length) params.set('properties', properties.join(','))
  if (propertiesWithHistory.length) {
    params.set('propertiesWithHistory', propertiesWithHistory.join(','))
  }
  return request<HubSpotObject>(
    organizationId,
    `/crm/v3/objects/${type}/${encodeURIComponent(id)}?${params.toString()}`,
  )
}

export const batchRead = async (
  organizationId: string,
  type: ObjectType,
  ids: string[],
  properties: string[],
  propertiesWithHistory: string[] = [],
): Promise<HubSpotObject[]> => {
  const results: HubSpotObject[] = []
  // History reads are capped at 50 ids per batch; plain reads at 100.
  const size = propertiesWithHistory.length ? 50 : 100
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size)
    const body = await request<{ results: HubSpotObject[] }>(
      organizationId,
      `/crm/v3/objects/${type}/batch/read`,
      {
        method: 'POST',
        body: {
          inputs: chunk.map((id) => ({ id })),
          properties,
          ...(propertiesWithHistory.length && { propertiesWithHistory }),
        },
      },
    )
    results.push(...(body?.results ?? []))
  }
  return results
}

export const createObject = (
  organizationId: string,
  type: ObjectType,
  properties: Record<string, string>,
  associations: Array<{ toId: string; associationTypeId: number }> = [],
) =>
  request<HubSpotObject>(organizationId, `/crm/v3/objects/${type}`, {
    method: 'POST',
    body: {
      properties,
      associations: associations.map((a) => ({
        to: { id: a.toId },
        types: [
          {
            associationCategory: 'HUBSPOT_DEFINED',
            associationTypeId: a.associationTypeId,
          },
        ],
      })),
    },
  })

export const updateObject = (
  organizationId: string,
  type: ObjectType,
  id: string,
  properties: Record<string, string>,
) =>
  request<HubSpotObject>(
    organizationId,
    `/crm/v3/objects/${type}/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: { properties },
    },
  )

/** HubSpot-defined association type ids (v4). */
export const ASSOCIATION = {
  dealToContact: 3,
  callToContact: 194,
  callToDeal: 206,
  taskToContact: 204,
  taskToDeal: 216,
  meetingToContact: 200,
  meetingToDeal: 212,
  noteToContact: 202,
  noteToDeal: 214,
} as const

export const listAssociatedIds = async (
  organizationId: string,
  fromType: ObjectType,
  fromId: string,
  toType: ObjectType,
): Promise<string[]> => {
  const ids: string[] = []
  let after: string | undefined
  do {
    const body = await request<{
      results: Array<{ toObjectId: number | string }>
      paging?: { next?: { after: string } }
    }>(
      organizationId,
      `/crm/v4/objects/${fromType}/${encodeURIComponent(fromId)}/associations/${toType}?limit=500${after ? `&after=${after}` : ''}`,
    )
    ids.push(...(body?.results ?? []).map((r) => String(r.toObjectId)))
    after = body?.paging?.next?.after
  } while (after && ids.length < 2000)
  return ids
}

export const searchObjects = async (
  organizationId: string,
  type: ObjectType,
  filters: Array<{ propertyName: string; operator: string; value?: string }>,
  properties: string[],
  max = 1000,
): Promise<HubSpotObject[]> => {
  const results: HubSpotObject[] = []
  let after: string | undefined
  do {
    const body = await request<{
      results: HubSpotObject[]
      paging?: { next?: { after: string } }
    }>(organizationId, `/crm/v3/objects/${type}/search`, {
      method: 'POST',
      body: {
        filterGroups: [{ filters }],
        properties,
        limit: 100,
        ...(after && { after }),
      },
    })
    results.push(...(body?.results ?? []))
    after = body?.paging?.next?.after
  } while (after && results.length < max)
  return results
}

// ------------------------------------------------------------ schema

export interface HubSpotPipeline {
  id: string
  label: string
  archived?: boolean
  stages: Array<{
    id: string
    label: string
    displayOrder: number
    archived?: boolean
    metadata?: { probability?: string; isClosed?: string }
  }>
}

export const listDealPipelines = async (organizationId: string) =>
  (
    await request<{ results: HubSpotPipeline[] }>(
      organizationId,
      '/crm/v3/pipelines/deals',
    )
  )?.results ?? []

export interface HubSpotProperty {
  name: string
  label: string
  type: string
  fieldType: string
  groupName?: string
  options?: Array<{ label: string; value: string; hidden?: boolean }>
}

export const getDealProperty = (organizationId: string, name: string) =>
  request<HubSpotProperty>(
    organizationId,
    `/crm/v3/properties/deals/${encodeURIComponent(name)}`,
  )

/** Replace a deal property's dropdown options (needs crm.schemas.deals.write). */
export const updateDealPropertyOptions = (
  organizationId: string,
  name: string,
  options: Array<{
    label: string
    value: string
    displayOrder?: number
    hidden?: boolean
  }>,
) =>
  request<HubSpotProperty>(
    organizationId,
    `/crm/v3/properties/deals/${encodeURIComponent(name)}`,
    {
      method: 'PATCH',
      body: { options },
    },
  )

export const createPropertyGroup = (
  organizationId: string,
  objectType: 'deals' | 'contacts',
  group: { name: string; label: string },
) =>
  request(organizationId, `/crm/v3/properties/${objectType}/groups`, {
    method: 'POST',
    body: { ...group, displayOrder: -1 },
  })

export const createProperty = (
  organizationId: string,
  objectType: 'deals' | 'contacts',
  property: HubSpotProperty & { description?: string },
) =>
  request(organizationId, `/crm/v3/properties/${objectType}`, {
    method: 'POST',
    body: property,
  })

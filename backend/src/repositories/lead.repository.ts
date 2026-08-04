import { db } from '@/lib/db'
import { sql, type SqlBool } from 'kysely'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { Decimal } from '@prisma/client/runtime/library'
import {
  normalizePhone,
  getLastNDigits,
  validateAndNormalizePhone,
} from '@/lib/phone'

export interface CreateLeadInput {
  organizationId: string
  firstName?: string
  lastName?: string
  email?: string
  phone: string
  normalizedPhone?: string | null
  company?: string
  title?: string
  linkedInUrl?: string
  website?: string
  customFields?: Record<string, string>
  pipelineStageId?: string
  dealValue?: number
  createdById?: string
}

export interface UpdateLeadInput {
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  linkedInUrl?: string | null
  website?: string | null
  customFields?: Record<string, string>
  pipelineStageId?: string | null
  dealValue?: number | null
  clientId?: string | null
  lastModifiedById?: string
}

export interface SmartFilter {
  operator:
    | 'eq'
    | 'ne'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
  value: string | number | boolean | null
}

export interface LeadFilters {
  organizationId: string
  search?: string
  campaignId?: string
  clientId?: string
  pipelineStageId?: string
  inPipeline?: boolean
  includeDeleted?: boolean
  includeClient?: boolean
  // Smart query filters
  titleFilter?: SmartFilter
  emailFilter?: SmartFilter
  companyFilter?: SmartFilter
  createdAtFilter?: SmartFilter
}

export interface LeadWithClient {
  id: string
  organizationId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  normalizedPhone: string | null
  company: string | null
  title: string | null
  linkedInUrl: string | null
  website: string | null
  customFields: string
  pipelineStageId: string | null
  dealValue: string | null
  aiCompanySummary: string | null
  clientId: string | null
  createdById: string | null
  lastModifiedById: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
  client?: {
    id: string
    name: string
    color: string | null
  } | null
  isInCampaign?: boolean
}

export const create = async (data: CreateLeadInput) => {
  // Auto-calculate normalized phone if not provided
  const normalizedPhone =
    data.normalizedPhone !== undefined
      ? data.normalizedPhone
      : validateAndNormalizePhone(data.phone)

  const lead = await db
    .insertInto('lead')
    .values({
      ...withId(
        withTimestamps(
          {
            organizationId: data.organizationId,
            firstName: data.firstName ?? null,
            lastName: data.lastName ?? null,
            email: data.email ?? null,
            phone: data.phone,
            normalizedPhone,
            company: data.company ?? null,
            title: data.title ?? null,
            linkedInUrl: data.linkedInUrl ?? null,
            website: data.website ?? null,
            customFields: JSON.stringify(data.customFields ?? {}),
            pipelineStageId: data.pipelineStageId ?? null,
            dealValue: data.dealValue
              ? new Decimal(data.dealValue).toString()
              : null,
            createdById: data.createdById ?? null,
            lastModifiedById: data.createdById ?? null, // Initially same as creator
          },
          true,
        ),
      ),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return lead
}

export const createMany = async (
  organizationId: string,
  leads: Omit<CreateLeadInput, 'organizationId'>[],
) => {
  if (leads.length === 0) return []

  const values = leads.map((lead) => {
    // Auto-calculate normalized phone if not provided
    const normalizedPhone =
      lead.normalizedPhone !== undefined
        ? lead.normalizedPhone
        : validateAndNormalizePhone(lead.phone)

    return {
      ...withId(
        withTimestamps(
          {
            organizationId,
            firstName: lead.firstName ?? null,
            lastName: lead.lastName ?? null,
            email: lead.email ?? null,
            phone: lead.phone,
            normalizedPhone,
            company: lead.company ?? null,
            title: lead.title ?? null,
            linkedInUrl: lead.linkedInUrl ?? null,
            website: (lead as CreateLeadInput).website ?? null,
            customFields: JSON.stringify(lead.customFields ?? {}),
            pipelineStageId: lead.pipelineStageId ?? null,
            dealValue: lead.dealValue
              ? new Decimal(lead.dealValue).toString()
              : null,
          },
          true,
        ),
      ),
    }
  })

  const result = await db
    .insertInto('lead')
    .values(values)
    .returningAll()
    .execute()

  return result
}

export const findById = async (id: string, organizationId: string) => {
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()
  return lead
}

// Find lead by ID with client info and isInCampaign flag
export const findByIdWithClient = async (
  id: string,
  organizationId: string,
): Promise<LeadWithClient | null> => {
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!lead) return null

  // Check if lead is in any campaign
  const campaignCount = await db
    .selectFrom('campaign_lead')
    .where('leadId', '=', id)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()
  const isInCampaign = Number(campaignCount.count) > 0

  // Get client info - prioritize direct clientId, then campaign-based
  let client = null

  if (lead.clientId) {
    // Direct client assignment
    const directClient = await db
      .selectFrom('client')
      .where('id', '=', lead.clientId)
      .select(['id', 'name', 'color'])
      .executeTakeFirst()
    if (directClient) {
      client = {
        id: directClient.id,
        name: directClient.name,
        color: directClient.color,
      }
    }
  } else if (isInCampaign) {
    // Get client from campaign
    const campaignClient = await db
      .selectFrom('campaign_lead')
      .innerJoin('campaign', 'campaign.id', 'campaign_lead.campaignId')
      .innerJoin('client', 'client.id', 'campaign.clientId')
      .where('campaign_lead.leadId', '=', id)
      .select([
        'client.id as clientId',
        'client.name as clientName',
        'client.color as clientColor',
      ])
      .executeTakeFirst()
    if (campaignClient) {
      client = {
        id: campaignClient.clientId,
        name: campaignClient.clientName,
        color: campaignClient.clientColor,
      }
    }
  }

  return {
    ...lead,
    website: lead.website ?? null,
    customFields: lead.customFields as string,
    aiCompanySummary: lead.aiCompanySummary ?? null,
    clientId: lead.clientId ?? null,
    client,
    isInCampaign,
  }
}

export const findByPhone = async (organizationId: string, phone: string) => {
  // Normalize the input phone number
  const normalizedPhone = normalizePhone(phone)
  const last10Digits = getLastNDigits(phone, 10)

  if (!normalizedPhone) return null

  // Try multiple matching strategies for phone number lookup:
  // 1. Exact match on normalized digits (stripping formatting)
  // 2. Match on last 10 digits (ignores country code differences)
  // This handles cases like "+15551234567" matching "5551234567" or "(555) 123-4567"

  // Use a raw SQL query that normalizes phone numbers in the database for comparison
  // This strips all non-digit characters from the stored phone and compares
  const lead = await db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where((eb) =>
      eb.or([
        // Direct match on normalizedPhone (E.164 format, e.g. "+15551234567")
        eb('normalizedPhone', '=', phone),
        // Match on full normalized phone (all digits)
        sql<boolean>`regexp_replace(phone, '[^0-9]', '', 'g') = ${normalizedPhone}`,
        // Match on last 10 digits (handles +1 prefix differences)
        sql<boolean>`RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = ${last10Digits}`,
      ]),
    )
    .selectAll()
    .executeTakeFirst()

  return lead
}

// Helper to apply smart filter operators
const applySmartFilter = <T>(
  query: T,
  column: string,
  filter: SmartFilter,
): T => {
  const { operator, value } = filter
  const q = query as any

  switch (operator) {
    case 'eq':
      return q.where(column, '=', value)
    case 'ne':
      return q.where(column, '!=', value)
    case 'contains':
      return q.where(column, 'ilike', `%${value}%`)
    case 'startsWith':
      return q.where(column, 'ilike', `${value}%`)
    case 'endsWith':
      return q.where(column, 'ilike', `%${value}`)
    case 'gt':
      return q.where(column, '>', value)
    case 'gte':
      return q.where(column, '>=', value)
    case 'lt':
      return q.where(column, '<', value)
    case 'lte':
      return q.where(column, '<=', value)
    default:
      return query
  }
}

// Helper function to build consistent base query for both count and fetch
const buildBaseQuery = (filters: LeadFilters) => {
  let query = db
    .selectFrom('lead')
    .where('lead.organizationId', '=', filters.organizationId)

  if (!filters.includeDeleted) {
    query = query.where('lead.deletedAt', 'is', null)
  }

  if (filters.pipelineStageId) {
    query = query.where('lead.pipelineStageId', '=', filters.pipelineStageId)
  }

  if (filters.inPipeline) {
    query = query.where('lead.pipelineStageId', 'is not', null)
  }

  if (filters.search) {
    query = query.where((eb) =>
      eb.or([
        eb('lead.firstName', 'ilike', `%${filters.search}%`),
        eb('lead.lastName', 'ilike', `%${filters.search}%`),
        eb('lead.email', 'ilike', `%${filters.search}%`),
        eb('lead.phone', 'ilike', `%${filters.search}%`),
        eb('lead.company', 'ilike', `%${filters.search}%`),
      ]),
    )
  }

  if (filters.campaignId) {
    query = query
      .innerJoin('campaign_lead', 'campaign_lead.leadId', 'lead.id')
      .where('campaign_lead.campaignId', '=', filters.campaignId)
  }

  // Filter by client (through campaign relationship) - INNER JOIN is intentional here
  // This filters to only leads that ARE in a campaign for the specified client
  if (filters.clientId) {
    query = query
      .innerJoin('campaign_lead as cl_client', 'cl_client.leadId', 'lead.id')
      .innerJoin('campaign as c_client', 'c_client.id', 'cl_client.campaignId')
      .where('c_client.clientId', '=', filters.clientId)
  }

  // Smart query filters
  if (filters.titleFilter) {
    query = applySmartFilter(query, 'lead.title', filters.titleFilter)
  }
  if (filters.emailFilter) {
    query = applySmartFilter(query, 'lead.email', filters.emailFilter)
  }
  if (filters.companyFilter) {
    query = applySmartFilter(query, 'lead.company', filters.companyFilter)
  }
  if (filters.createdAtFilter) {
    query = applySmartFilter(query, 'lead.createdAt', filters.createdAtFilter)
  }

  return query
}

export const findMany = async (
  filters: LeadFilters,
  pagination: DBPagination,
): Promise<{ data: LeadWithClient[]; total: number }> => {
  // Build base query consistently for both count and fetch
  const baseQuery = buildBaseQuery(filters)

  // Include client info via a cleaner two-step approach:
  // 1. First fetch leads using simple query (no duplicates)
  // 2. Then fetch client info for those leads separately
  // This avoids DISTINCT ON complexity which can cause issues
  if (filters.includeClient) {
    // Step 1: Get leads count and data using simple query (same as non-includeClient path)
    const countResult = await baseQuery
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirstOrThrow()

    const leads = await withPagination(pagination, baseQuery.selectAll('lead'))
      .orderBy('lead.createdAt', 'desc')
      .execute()

    // DEBUG: Log query results to diagnose CRM leads not displaying
    console.log(
      '[Lead Repository DEBUG] includeClient query returned:',
      leads.length,
      'leads',
    )
    console.log(
      '[Lead Repository DEBUG] Count result:',
      Number(countResult.count),
    )
    if (leads.length > 0) {
      console.log(
        '[Lead Repository DEBUG] First lead pipelineStageId:',
        leads[0].pipelineStageId,
      )
    }

    if (leads.length === 0) {
      return {
        data: [],
        total: Number(countResult.count),
      }
    }

    // Step 2: Fetch client info for these leads
    // Priority: 1) Direct clientId on lead, 2) Campaign-based client
    const leadIds = leads.map((l) => l.id)

    // Get direct client assignments for leads with clientId
    const leadsWithDirectClient = leads.filter((l) => l.clientId)
    const directClientIds = [
      ...new Set(leadsWithDirectClient.map((l) => l.clientId!)),
    ]
    const directClients =
      directClientIds.length > 0
        ? await db
            .selectFrom('client')
            .where('id', 'in', directClientIds)
            .select(['id', 'name', 'color'])
            .execute()
        : []
    const directClientById = new Map(directClients.map((c) => [c.id, c]))

    // Get campaign-based client info for leads WITHOUT direct clientId
    const leadsNeedingCampaignClient = leads
      .filter((l) => !l.clientId)
      .map((l) => l.id)
    const campaignClientInfo =
      leadsNeedingCampaignClient.length > 0
        ? await db
            .selectFrom('campaign_lead')
            .innerJoin('campaign', 'campaign.id', 'campaign_lead.campaignId')
            .innerJoin('client', 'client.id', 'campaign.clientId')
            .where('campaign_lead.leadId', 'in', leadsNeedingCampaignClient)
            .select([
              'campaign_lead.leadId',
              'client.id as clientId',
              'client.name as clientName',
              'client.color as clientColor',
            ])
            .distinctOn('campaign_lead.leadId')
            .orderBy('campaign_lead.leadId')
            .execute()
        : []

    // Build a map of leadId -> client from campaign
    const campaignClientByLeadId = new Map(
      campaignClientInfo.map((c) => [
        c.leadId,
        { id: c.clientId, name: c.clientName, color: c.clientColor },
      ]),
    )

    // Check which leads are in any campaign (for isInCampaign flag)
    const leadsInCampaign = await db
      .selectFrom('campaign_lead')
      .where('leadId', 'in', leadIds)
      .select('leadId')
      .distinct()
      .execute()
    const leadsInCampaignSet = new Set(leadsInCampaign.map((l) => l.leadId))

    // Transform leads to include client info
    // Priority: direct clientId > campaign-based client
    const transformedLeads: LeadWithClient[] = leads.map((lead) => {
      let client = null
      if (lead.clientId) {
        const directClient = directClientById.get(lead.clientId)
        if (directClient) {
          client = {
            id: directClient.id,
            name: directClient.name,
            color: directClient.color,
          }
        }
      } else {
        client = campaignClientByLeadId.get(lead.id) || null
      }

      return {
        ...lead,
        website: lead.website ?? null,
        customFields: lead.customFields as string,
        aiCompanySummary: lead.aiCompanySummary ?? null,
        clientId: lead.clientId ?? null,
        client,
        isInCampaign: leadsInCampaignSet.has(lead.id),
      }
    })

    return {
      data: transformedLeads,
      total: Number(countResult.count),
    }
  }

  // No client info needed - simpler query
  const countResult = await baseQuery
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const leads = await withPagination(pagination, baseQuery.selectAll('lead'))
    .orderBy('lead.createdAt', 'desc')
    .execute()

  // Transform to LeadWithClient without client
  const transformedLeads: LeadWithClient[] = leads.map((lead) => ({
    ...lead,
    website: lead.website ?? null,
    customFields: lead.customFields as string,
    aiCompanySummary: lead.aiCompanySummary ?? null,
    clientId: lead.clientId ?? null,
    client: null,
  }))

  return {
    data: transformedLeads,
    total: Number(countResult.count),
  }
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateLeadInput,
) => {
  const updateData: Record<string, unknown> = {
    ...withTimestamps({}),
  }

  if (data.firstName !== undefined) updateData.firstName = data.firstName
  if (data.lastName !== undefined) updateData.lastName = data.lastName
  if (data.email !== undefined) updateData.email = data.email
  if (data.phone !== undefined) updateData.phone = data.phone
  if (data.company !== undefined) updateData.company = data.company
  if (data.title !== undefined) updateData.title = data.title
  if (data.linkedInUrl !== undefined) updateData.linkedInUrl = data.linkedInUrl
  if (data.website !== undefined) updateData.website = data.website
  if (data.customFields !== undefined)
    updateData.customFields = JSON.stringify(data.customFields)
  if (data.pipelineStageId !== undefined)
    updateData.pipelineStageId = data.pipelineStageId
  if (data.dealValue !== undefined) {
    updateData.dealValue = data.dealValue
      ? new Decimal(data.dealValue).toString()
      : null
  }
  if (data.clientId !== undefined) updateData.clientId = data.clientId
  if (data.lastModifiedById !== undefined)
    updateData.lastModifiedById = data.lastModifiedById

  const lead = await db
    .updateTable('lead')
    .set(updateData)
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .returningAll()
    .executeTakeFirst()

  return lead
}

export const softDelete = async (id: string, organizationId: string) => {
  const result = await db
    .updateTable('lead')
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()

  return Number(result.numUpdatedRows) > 0
}

// SUPERADMIN ONLY — do not call from regular service code
export const hardDelete = async (id: string, organizationId: string) => {
  const result = await db
    .deleteFrom('lead')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  return Number(result.numDeletedRows) > 0
}

// SUPERADMIN ONLY — Bulk hard delete leads by IDs
// CASCADE deletes campaign_lead and lead_list_entry
// Call records are preserved (no FK constraint) for historical data
export const bulkHardDelete = async (
  organizationId: string,
  leadIds: string[],
): Promise<number> => {
  if (leadIds.length === 0) return 0

  const result = await db
    .deleteFrom('lead')
    .where('id', 'in', leadIds)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  return Number(result.numDeletedRows)
}

// Find leads by custom field key (for cleanup of bad imports)
export const findByCustomFieldKey = async (
  organizationId: string,
  customFieldKey: string,
): Promise<{ id: string; phone: string; customFields: string }[]> => {
  const leads = await db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where(sql<SqlBool>`"customFields"::jsonb ? ${customFieldKey}`)
    .select(['id', 'phone', 'customFields'])
    .execute()

  return leads as { id: string; phone: string; customFields: string }[]
}

// Find leads by IDs (for bulk operations)
export const findByIds = async (ids: string[], organizationId: string) => {
  if (ids.length === 0) return []

  const leads = await db
    .selectFrom('lead')
    .where('id', 'in', ids)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .execute()

  return leads
}

// Find leads by IDs with basic info only (for schedule/activity lookups)
export const findByIdsBasic = async (ids: string[]) => {
  if (ids.length === 0) return []

  const leads = await db
    .selectFrom('lead')
    .select(['id', 'firstName', 'lastName', 'company'])
    .where('id', 'in', ids)
    .execute()

  return leads
}

// Count leads matching filters (for smart query preview)
export const countByFilters = async (filters: LeadFilters): Promise<number> => {
  let query = db
    .selectFrom('lead')
    .where('organizationId', '=', filters.organizationId)

  if (!filters.includeDeleted) {
    query = query.where('deletedAt', 'is', null)
  }

  if (filters.pipelineStageId) {
    query = query.where('pipelineStageId', '=', filters.pipelineStageId)
  }

  if (filters.inPipeline) {
    query = query.where('pipelineStageId', 'is not', null)
  }

  if (filters.search) {
    query = query.where((eb) =>
      eb.or([
        eb('firstName', 'ilike', `%${filters.search}%`),
        eb('lastName', 'ilike', `%${filters.search}%`),
        eb('email', 'ilike', `%${filters.search}%`),
        eb('phone', 'ilike', `%${filters.search}%`),
        eb('company', 'ilike', `%${filters.search}%`),
      ]),
    )
  }

  // Smart query filters
  if (filters.titleFilter) {
    query = applySmartFilter(query, 'title', filters.titleFilter)
  }
  if (filters.emailFilter) {
    query = applySmartFilter(query, 'email', filters.emailFilter)
  }
  if (filters.companyFilter) {
    query = applySmartFilter(query, 'company', filters.companyFilter)
  }
  if (filters.createdAtFilter) {
    query = applySmartFilter(query, 'createdAt', filters.createdAtFilter)
  }

  const result = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  return Number(result.count)
}

// CRM-specific: count leads by pipeline stage
export const countByPipelineStage = async (
  organizationId: string,
): Promise<Map<string | null, number>> => {
  const results = await db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .groupBy('pipelineStageId')
    .select(['pipelineStageId', sql<number>`count(*)::int`.as('count')])
    .execute()

  const countMap = new Map<string | null, number>()
  for (const row of results) {
    countMap.set(row.pipelineStageId, row.count)
  }
  return countMap
}

// CRM-specific: get lead counts and total deal values by pipeline stage
export const getStageStats = async (
  organizationId: string,
): Promise<Map<string | null, { count: number; totalValue: number }>> => {
  const results = await db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .groupBy('pipelineStageId')
    .select([
      'pipelineStageId',
      sql<number>`count(*)::int`.as('count'),
      sql<string>`coalesce(sum("dealValue"), 0)`.as('totalValue'),
    ])
    .execute()

  const statsMap = new Map<
    string | null,
    { count: number; totalValue: number }
  >()
  for (const row of results) {
    statsMap.set(row.pipelineStageId, {
      count: row.count,
      totalValue: parseFloat(row.totalValue) || 0,
    })
  }
  return statsMap
}

// Bulk create leads for CSV import, ignoring conflicts (duplicates)
// Pre-generates IDs so caller knows which leads were attempted
export interface BulkCreateLeadInput {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone: string
  normalizedPhone?: string | null
  company?: string | null
  title?: string | null
  linkedInUrl?: string | null
  website?: string | null
  customFields?: Record<string, string>
}

export const bulkCreateIgnoreConflicts = async (
  organizationId: string,
  leads: BulkCreateLeadInput[],
): Promise<string[]> => {
  if (leads.length === 0) return []

  const values = leads.map((lead) => {
    // Auto-calculate normalized phone if not provided
    const normalizedPhone =
      lead.normalizedPhone !== undefined
        ? lead.normalizedPhone
        : validateAndNormalizePhone(lead.phone)

    return {
      ...withId(
        withTimestamps(
          {
            organizationId,
            firstName: lead.firstName ?? null,
            lastName: lead.lastName ?? null,
            email: lead.email ?? null,
            phone: lead.phone,
            normalizedPhone,
            company: lead.company ?? null,
            title: lead.title ?? null,
            linkedInUrl: lead.linkedInUrl ?? null,
            website: lead.website ?? null,
            customFields: JSON.stringify(lead.customFields || {}),
          },
          true,
        ),
      ),
    }
  })

  // Use ON CONFLICT on the unique partial index for normalized phone
  // This prevents duplicate leads with the same normalized phone in the same org
  const insertedRows = await db
    .insertInto('lead')
    .values(values)
    .onConflict((oc) =>
      oc
        .column('organizationId')
        .column('normalizedPhone')
        .where('normalizedPhone', 'is not', null)
        .where('deletedAt', 'is', null)
        .doNothing(),
    )
    .returning(['id', 'normalizedPhone'])
    .execute()

  const insertedIds = insertedRows.map((row) => row.id)

  // Look up actual lead IDs by normalized phone, since ON CONFLICT DO NOTHING
  // means some pre-generated IDs may not have been inserted (duplicates).
  // We need to return the real IDs (whether newly created or already existing).
  const normalizedPhones = values
    .map((v) => v.normalizedPhone)
    .filter((p): p is string => p !== null)

  if (normalizedPhones.length === 0) return insertedIds

  const existingLeads = await db
    .selectFrom('lead')
    .select(['id', 'normalizedPhone'])
    .where('organizationId', '=', organizationId)
    .where('normalizedPhone', 'in', normalizedPhones)
    .where('deletedAt', 'is', null)
    .execute()

  const allIds = new Set<string>(insertedIds)
  for (const lead of existingLeads) {
    allIds.add(lead.id)
  }
  return Array.from(allIds)
}

// Bulk update pipeline stage for multiple leads
export const bulkUpdatePipelineStage = async (
  organizationId: string,
  leadIds: string[],
  pipelineStageId: string,
): Promise<{ updated: number; alreadyInPipeline: number }> => {
  if (leadIds.length === 0) return { updated: 0, alreadyInPipeline: 0 }

  // Count leads already in this pipeline stage
  const alreadyInStageResult = await db
    .selectFrom('lead')
    .where('id', 'in', leadIds)
    .where('organizationId', '=', organizationId)
    .where('pipelineStageId', '=', pipelineStageId)
    .where('deletedAt', 'is', null)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const alreadyInPipeline = Number(alreadyInStageResult.count)

  // Update leads not already in this stage
  const result = await db
    .updateTable('lead')
    .set({
      pipelineStageId,
      updatedAt: new Date(),
    })
    .where('id', 'in', leadIds)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where((eb) =>
      eb.or([
        eb('pipelineStageId', 'is', null),
        eb('pipelineStageId', '!=', pipelineStageId),
      ]),
    )
    .executeTakeFirst()

  return {
    updated: Number(result.numUpdatedRows),
    alreadyInPipeline,
  }
}

// Find duplicate leads grouped by normalized phone
export interface DuplicateLeadData {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  normalizedPhone: string | null
  company: string | null
  title: string | null
  linkedInUrl: string | null
  website: string | null
  createdAt: Date
}

export const findDuplicates = async (
  organizationId: string,
): Promise<Map<string, DuplicateLeadData[]>> => {
  // First, find all normalized phones that have duplicates
  const duplicatePhones = await db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where('normalizedPhone', 'is not', null)
    .groupBy('normalizedPhone')
    .having((eb) => eb(eb.fn.count('id'), '>', 1))
    .select(['normalizedPhone'])
    .execute()

  if (duplicatePhones.length === 0) {
    return new Map()
  }

  const normalizedPhonesList = duplicatePhones
    .map((r) => r.normalizedPhone)
    .filter((p): p is string => p !== null)

  // Get all leads that have these duplicate phones
  const duplicateLeads = await db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where('normalizedPhone', 'in', normalizedPhonesList)
    .select([
      'id',
      'firstName',
      'lastName',
      'email',
      'phone',
      'normalizedPhone',
      'company',
      'title',
      'linkedInUrl',
      'website',
      'createdAt',
    ])
    .orderBy('normalizedPhone')
    .orderBy('createdAt', 'asc')
    .execute()

  // Group by normalized phone
  const groupedDuplicates = new Map<string, DuplicateLeadData[]>()
  for (const lead of duplicateLeads) {
    if (!lead.normalizedPhone) continue
    const existing = groupedDuplicates.get(lead.normalizedPhone) || []
    existing.push(lead)
    groupedDuplicates.set(lead.normalizedPhone, existing)
  }

  return groupedDuplicates
}

// Update personal voicemail status for a lead
// If isPersonal is true, always set (upgrade from any previous state)
// If isPersonal is false, only set when currently null (never downgrade from true)
export const updatePersonalVoicemailStatus = async (
  leadId: string,
  isPersonal: boolean,
): Promise<void> => {
  if (isPersonal) {
    // Always upgrade to true
    await db
      .updateTable('lead')
      .set({ hasPersonalVoicemail: true, updatedAt: new Date() })
      .where('id', '=', leadId)
      .where('deletedAt', 'is', null)
      .execute()
  } else {
    // Only set false when currently null (never downgrade from true)
    await db
      .updateTable('lead')
      .set({ hasPersonalVoicemail: false, updatedAt: new Date() })
      .where('id', '=', leadId)
      .where('deletedAt', 'is', null)
      .where('hasPersonalVoicemail', 'is', null)
      .execute()
  }
}

// Merge data from source leads into target lead (fill empty fields)
export const mergeLeadData = async (
  targetLeadId: string,
  sourceLeadIds: string[],
  organizationId: string,
): Promise<void> => {
  // Get target lead
  const targetLead = await findById(targetLeadId, organizationId)
  if (!targetLead) return

  // Get source leads
  const sourceLeads = await findByIds(sourceLeadIds, organizationId)
  if (sourceLeads.length === 0) return

  // Determine what fields to fill from source leads
  const updates: Partial<UpdateLeadInput> = {}

  for (const source of sourceLeads) {
    // Fill in empty fields from source
    if (!targetLead.firstName && source.firstName && !updates.firstName) {
      updates.firstName = source.firstName
    }
    if (!targetLead.lastName && source.lastName && !updates.lastName) {
      updates.lastName = source.lastName
    }
    if (!targetLead.email && source.email && !updates.email) {
      updates.email = source.email
    }
    if (!targetLead.company && source.company && !updates.company) {
      updates.company = source.company
    }
    if (!targetLead.title && source.title && !updates.title) {
      updates.title = source.title
    }
    if (!targetLead.linkedInUrl && source.linkedInUrl && !updates.linkedInUrl) {
      updates.linkedInUrl = source.linkedInUrl
    }
    if (!targetLead.website && source.website && !updates.website) {
      updates.website = source.website
    }
  }

  // Only update if there are fields to merge
  if (Object.keys(updates).length > 0) {
    await update(targetLeadId, organizationId, updates)
  }
}

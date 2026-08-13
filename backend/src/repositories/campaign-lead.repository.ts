import { db } from '@/lib/db'
import { withId } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { withPagination } from './utils'
import type { PowerDialerTimezonePriority } from '@shared/types/src'
import {
  TIMEZONE_GROUPS,
  TIMEZONE_PRIORITY_ORDER,
} from '@shared/types/src/constants/timezones'
import { sql } from 'kysely'

const timezoneInSql = (timezones: string[]) =>
  sql<boolean>`lead.timezone in (${sql.join(timezones)})`

const timezonePriorityRankSql = (priority: PowerDialerTimezonePriority) => {
  const order = TIMEZONE_PRIORITY_ORDER[priority]

  return sql<number>`case
    when ${timezoneInSql(TIMEZONE_GROUPS[order[0]])} then 0
    when ${timezoneInSql(TIMEZONE_GROUPS[order[1]])} then 1
    when ${timezoneInSql(TIMEZONE_GROUPS[order[2]])} then 2
    when ${timezoneInSql(TIMEZONE_GROUPS[order[3]])} then 3
    else 4
  end`
}

const dialableLeadWhereSql = sql<boolean>`(
  btrim(coalesce(lead.phone, '')) <> ''
  and (
    btrim(coalesce(lead."firstName", '')) <> ''
    or btrim(coalesce(lead."lastName", '')) <> ''
    or btrim(coalesce(lead.company, '')) <> ''
  )
)`

export interface CreateCampaignLeadInput {
  campaignId: string
  leadId: string
  assignedUserId?: string
  dialOrder?: number
}

export const create = async (data: CreateCampaignLeadInput) => {
  const campaignLead = await db
    .insertInto('campaign_lead')
    .values({
      ...withId(data),
      createdAt: new Date(),
    })
    .onConflict((oc) => oc.columns(['campaignId', 'leadId']).doNothing())
    .returningAll()
    .executeTakeFirst()
  return campaignLead
}

export const createMany = async (
  campaignId: string,
  leadIds: string[],
  startOrder: number = 0,
) => {
  if (leadIds.length === 0) return []

  const values = leadIds.map((leadId, index) => ({
    ...withId({ campaignId, leadId }),
    dialOrder: startOrder + index,
    status: 'pending' as const,
    createdAt: new Date(),
  }))

  await db
    .insertInto('campaign_lead')
    .values(values)
    .onConflict((oc) => oc.columns(['campaignId', 'leadId']).doNothing())
    .execute()

  return values.length
}

export const findByCampaign = async (
  campaignId: string,
  filters: {
    status?: 'pending' | 'dialed' | 'completed'
    assignedUserId?: string
  },
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('campaign_lead')
    .innerJoin('lead', 'lead.id', 'campaign_lead.leadId')
    .where('campaign_lead.campaignId', '=', campaignId)
    .where('lead.deletedAt', 'is', null)

  if (filters.status) {
    query = query.where('campaign_lead.status', '=', filters.status)
  }

  if (filters.assignedUserId) {
    query = query.where(
      'campaign_lead.assignedUserId',
      '=',
      filters.assignedUserId,
    )
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const leads = await withPagination(
    pagination,
    query.select([
      'campaign_lead.id',
      'campaign_lead.campaignId',
      'campaign_lead.leadId',
      'campaign_lead.assignedUserId',
      'campaign_lead.status',
      'campaign_lead.dialOrder',
      'campaign_lead.createdAt',
      'lead.firstName',
      'lead.lastName',
      'lead.email',
      'lead.phone',
      'lead.company',
      'lead.title',
      'lead.linkedInUrl',
      'lead.customFields',
    ]),
  )
    .orderBy('campaign_lead.dialOrder', 'asc')
    .execute()

  return {
    data: leads,
    total: Number(countResult.count),
  }
}

export const findAllByCampaign = async (campaignId: string) => {
  return db
    .selectFrom('campaign_lead')
    .innerJoin('lead', 'lead.id', 'campaign_lead.leadId')
    .where('campaign_lead.campaignId', '=', campaignId)
    .where('lead.deletedAt', 'is', null)
    .select([
      'campaign_lead.status',
      'campaign_lead.dialOrder',
      'lead.firstName',
      'lead.lastName',
      'lead.email',
      'lead.phone',
      'lead.company',
      'lead.title',
      'lead.linkedInUrl',
    ])
    .orderBy('campaign_lead.dialOrder', 'asc')
    .execute()
}

export const countDialableByCampaign = async (
  campaignId: string,
  options: { assignedUserId?: string } = {},
): Promise<number> => {
  let query = db
    .selectFrom('campaign_lead')
    .innerJoin('lead', 'lead.id', 'campaign_lead.leadId')
    .where('campaign_lead.campaignId', '=', campaignId)
    .where('lead.deletedAt', 'is', null)
    .where(dialableLeadWhereSql)

  if (options.assignedUserId) {
    query = query.where(
      'campaign_lead.assignedUserId',
      '=',
      options.assignedUserId,
    )
  }

  const result = await query
    .select(sql<number>`count(distinct lead.id)::int`.as('count'))
    .executeTakeFirst()

  return Number(result?.count ?? 0)
}

export const findDialableByCampaignWithOffset = async (
  campaignId: string,
  offset: number,
  limit: number = 1,
  options: {
    timezonePriority?: PowerDialerTimezonePriority
    assignedUserId?: string
  } = {},
) => {
  let query = db
    .selectFrom('campaign_lead')
    .innerJoin('lead', 'lead.id', 'campaign_lead.leadId')
    .where('campaign_lead.campaignId', '=', campaignId)
    .where('lead.deletedAt', 'is', null)
    .where(dialableLeadWhereSql)
    .select([
      'lead.id',
      'lead.firstName',
      'lead.lastName',
      'lead.email',
      'lead.phone',
      'lead.company',
      'lead.title',
      'lead.linkedInUrl',
      'lead.website',
      'lead.customFields',
      'lead.aiCompanySummary',
      'lead.aiCompanyOverview',
      'lead.aiSalesTalkingPoints',
      'lead.aiBusinessContext',
      'lead.timezone',
      'lead.timezoneResolvedAt',
      'lead.createdAt',
    ])

  if (options.assignedUserId) {
    query = query.where(
      'campaign_lead.assignedUserId',
      '=',
      options.assignedUserId,
    )
  }

  if (options.timezonePriority) {
    query = query.orderBy(
      timezonePriorityRankSql(options.timezonePriority),
      'asc',
    )
  }

  const leads = await query
    .orderBy('campaign_lead.dialOrder', 'asc')
    .orderBy('campaign_lead.createdAt', 'asc')
    .offset(offset)
    .limit(limit)
    .execute()

  return leads
}

export const getUnassignedLeads = async (campaignId: string) => {
  const leads = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', campaignId)
    .where('assignedUserId', 'is', null)
    .select(['id', 'leadId'])
    .orderBy('dialOrder', 'asc')
    .execute()
  return leads
}

export const countAssignedLeads = async (campaignId: string) => {
  const result = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', campaignId)
    .where('assignedUserId', 'is not', null)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirst()

  return Number(result?.count ?? 0)
}

export const assignUser = async (campaignLeadId: string, userId: string) => {
  await db
    .updateTable('campaign_lead')
    .set({ assignedUserId: userId })
    .where('id', '=', campaignLeadId)
    .execute()
}

export const updateStatus = async (
  campaignLeadId: string,
  status: 'pending' | 'dialed' | 'completed',
) => {
  await db
    .updateTable('campaign_lead')
    .set({ status })
    .where('id', '=', campaignLeadId)
    .execute()
}

// Update status by campaignId and leadId (used after call completion)
export const updateStatusByLeadAndCampaign = async (
  campaignId: string,
  leadId: string,
  status: 'pending' | 'dialed' | 'completed',
): Promise<boolean> => {
  const result = await db
    .updateTable('campaign_lead')
    .set({ status })
    .where('campaignId', '=', campaignId)
    .where('leadId', '=', leadId)
    .executeTakeFirst()

  return Number(result.numUpdatedRows) > 0
}

export const remove = async (campaignId: string, leadId: string) => {
  const result = await db
    .deleteFrom('campaign_lead')
    .where('campaignId', '=', campaignId)
    .where('leadId', '=', leadId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

/** Drop several leads from a campaign at once; the lead records survive. */
export const removeMany = async (campaignId: string, leadIds: string[]) => {
  if (leadIds.length === 0) return 0

  const result = await db
    .deleteFrom('campaign_lead')
    .where('campaignId', '=', campaignId)
    .where('leadId', 'in', leadIds)
    .executeTakeFirst()

  return Number(result.numDeletedRows ?? 0)
}

export const getMaxDialOrder = async (campaignId: string): Promise<number> => {
  const result = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', campaignId)
    .select((eb) => eb.fn.max('dialOrder').as('maxOrder'))
    .executeTakeFirst()
  return result?.maxOrder ?? -1
}

// Check which leads are already in a campaign
export const findExistingLeadIds = async (
  campaignId: string,
  leadIds: string[],
): Promise<string[]> => {
  if (leadIds.length === 0) return []

  const results = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', campaignId)
    .where('leadId', 'in', leadIds)
    .select('leadId')
    .execute()

  return results.map((r) => r.leadId)
}

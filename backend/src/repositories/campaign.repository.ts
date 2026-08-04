import { db } from '@/lib/db'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { sql } from 'kysely'

export interface CreateCampaignInput {
  organizationId: string
  createdById: string
  name: string
  clientId?: string
}

export interface UpdateCampaignInput {
  name?: string
  clientId?: string | null
}

export interface CampaignFilters {
  organizationId: string
  clientId?: string
  status?: 'active' | 'inactive' // calculated based on lastCalledAt
  search?: string
  createdById?: string
}

// Status is determined by whether there was a call in the last 7 days
const ACTIVE_THRESHOLD_DAYS = 7

export const create = async (data: CreateCampaignInput) => {
  const campaign = await db
    .insertInto('campaign')
    .values(withId(withTimestamps(data, true)))
    .returningAll()
    .executeTakeFirstOrThrow()
  return campaign
}

export const findById = async (id: string, organizationId: string) => {
  const campaign = await db
    .selectFrom('campaign')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
  return campaign
}

export const findMany = async (
  filters: CampaignFilters,
  pagination: DBPagination,
) => {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - ACTIVE_THRESHOLD_DAYS)

  let query = db
    .selectFrom('campaign')
    .leftJoin('client', 'client.id', 'campaign.clientId')
    .where('campaign.organizationId', '=', filters.organizationId)

  if (filters.clientId) {
    query = query.where('campaign.clientId', '=', filters.clientId)
  }

  if (filters.createdById) {
    query = query.where('campaign.createdById', '=', filters.createdById)
  }

  if (filters.search) {
    query = query.where('campaign.name', 'ilike', `%${filters.search}%`)
  }

  // Filter by calculated status
  if (filters.status === 'active') {
    query = query.where('campaign.lastCalledAt', '>=', sevenDaysAgo)
  } else if (filters.status === 'inactive') {
    query = query.where((eb) =>
      eb.or([
        eb('campaign.lastCalledAt', '<', sevenDaysAgo),
        eb('campaign.lastCalledAt', 'is', null),
      ]),
    )
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const campaigns = await withPagination(
    pagination,
    query.select([
      'campaign.id',
      'campaign.organizationId',
      'campaign.createdById',
      'campaign.clientId',
      'campaign.name',
      'campaign.leadCount',
      'campaign.dialedCount',
      'campaign.connectedCount',
      'campaign.lastCalledAt',
      'campaign.createdAt',
      'campaign.updatedAt',
      'client.name as clientName',
      'client.color as clientColor',
    ]),
  )
    .orderBy('campaign.createdAt', 'desc')
    .execute()

  // Calculate status for each campaign
  const campaignsWithStatus = campaigns.map((campaign) => {
    const isActive =
      campaign.lastCalledAt && new Date(campaign.lastCalledAt) >= sevenDaysAgo
    return {
      ...campaign,
      status: isActive ? ('active' as const) : ('inactive' as const),
      client: campaign.clientId
        ? {
            id: campaign.clientId,
            name: campaign.clientName,
            color: campaign.clientColor,
          }
        : null,
    }
  })

  return {
    data: campaignsWithStatus,
    total: Number(countResult.count),
  }
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateCampaignInput,
) => {
  const campaign = await db
    .updateTable('campaign')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
  return campaign
}

export const remove = async (id: string, organizationId: string) => {
  const result = await db
    .deleteFrom('campaign')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const updateCounts = async (id: string, organizationId: string) => {
  const leadCount = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', id)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const dialedCount = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', id)
    .where('status', 'in', ['dialed', 'completed'])
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const connectedCount = await db
    .selectFrom('campaign_lead')
    .where('campaignId', '=', id)
    .where('status', '=', 'completed')
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  await db
    .updateTable('campaign')
    .set({
      leadCount: Number(leadCount.count),
      dialedCount: Number(dialedCount.count),
      connectedCount: Number(connectedCount.count),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .execute()
}

// Campaign Users (for team campaigns)
export const addUsers = async (campaignId: string, userIds: string[]) => {
  if (userIds.length === 0) return

  await db
    .insertInto('campaign_user')
    .values(userIds.map((userId) => ({ campaignId, userId })))
    .onConflict((oc) => oc.doNothing())
    .execute()
}

export const removeUsers = async (campaignId: string) => {
  await db
    .deleteFrom('campaign_user')
    .where('campaignId', '=', campaignId)
    .execute()
}

export const getCampaignUsers = async (campaignId: string) => {
  const users = await db
    .selectFrom('campaign_user')
    .innerJoin('user', 'user.id', 'campaign_user.userId')
    .where('campaign_user.campaignId', '=', campaignId)
    .select(['user.id', 'user.name', 'user.email'])
    .execute()
  return users
}

// Update lastCalledAt when a call is made for this campaign
export const updateLastCalledAt = async (id: string) => {
  await db
    .updateTable('campaign')
    .set({
      lastCalledAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

import { db } from '@/lib/db'
import { withId } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { withPagination } from './utils'

export interface CreateSmsCampaignInput {
  organizationId: string
  name: string
  description?: string | null
  sendWindowStart?: string
  sendWindowEnd?: string
  sendDays?: number[]
  defaultTimezone?: string
  aiEnabled?: boolean
  aiModel?: string | null
  aiSystemPrompt?: string | null
  valueProposition?: string | null
  dailySendLimit?: number
  createdById: string
}

export interface UpdateSmsCampaignInput {
  name?: string
  description?: string | null
  status?: string
  sendWindowStart?: string
  sendWindowEnd?: string
  sendDays?: number[]
  defaultTimezone?: string
  aiEnabled?: boolean
  aiModel?: string | null
  aiSystemPrompt?: string | null
  valueProposition?: string | null
  dailySendLimit?: number
  activatedAt?: Date | null
  completedAt?: Date | null
  totalEnrolled?: number
  totalSent?: number
  totalDelivered?: number
  totalReplied?: number
  totalUnsubscribed?: number
}

export const create = async (data: CreateSmsCampaignInput) => {
  const record = {
    ...withId(data),
    status: 'draft',
    sendWindowStart: data.sendWindowStart ?? '09:00',
    sendWindowEnd: data.sendWindowEnd ?? '18:00',
    sendDays: data.sendDays ?? [1, 2, 3, 4, 5],
    defaultTimezone: data.defaultTimezone ?? 'America/New_York',
    aiEnabled: data.aiEnabled ?? false,
    dailySendLimit: data.dailySendLimit ?? 100,
    totalEnrolled: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalReplied: 0,
    totalUnsubscribed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return db
    .insertInto('sms_campaign')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string, organizationId: string) => {
  return db
    .selectFrom('sms_campaign')
    .selectAll()
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

export const findByIdWithSteps = async (id: string, organizationId: string) => {
  const campaign = await findById(id, organizationId)
  if (!campaign) return null

  const steps = await db
    .selectFrom('sms_campaign_step')
    .selectAll()
    .where('campaignId', '=', id)
    .orderBy('stepNumber', 'asc')
    .execute()

  return { ...campaign, steps }
}

export interface ListSmsCampaignsParams {
  organizationId: string
  status?: string
  search?: string
  pagination: DBPagination
}

export const list = async (params: ListSmsCampaignsParams) => {
  const { organizationId, status, search, pagination } = params

  let query = db
    .selectFrom('sms_campaign')
    .selectAll()
    .where('organizationId', '=', organizationId)

  if (status) {
    query = query.where('status', '=', status)
  }

  if (search) {
    query = query.where('name', 'ilike', `%${search}%`)
  }

  // Get total count
  const countResult = await db
    .selectFrom('sms_campaign')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .$if(!!status, (qb) => qb.where('status', '=', status!))
    .$if(!!search, (qb) => qb.where('name', 'ilike', `%${search}%`))
    .executeTakeFirst()

  const total = countResult?.count ?? 0

  // Get paginated data
  query = query.orderBy('createdAt', 'desc')
  query = withPagination(pagination, query)

  const data = await query.execute()

  return { data, total }
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateSmsCampaignInput,
) => {
  return db
    .updateTable('sms_campaign')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string, organizationId: string) => {
  return db
    .deleteFrom('sms_campaign')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .execute()
}

export const activate = async (id: string, organizationId: string) => {
  return db
    .updateTable('sms_campaign')
    .set({
      status: 'active',
      activatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const pause = async (id: string, organizationId: string) => {
  return db
    .updateTable('sms_campaign')
    .set({
      status: 'paused',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const complete = async (id: string, organizationId: string) => {
  return db
    .updateTable('sms_campaign')
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const incrementStat = async (
  id: string,
  stat:
    | 'totalEnrolled'
    | 'totalSent'
    | 'totalDelivered'
    | 'totalReplied'
    | 'totalUnsubscribed',
  increment: number = 1,
) => {
  return db
    .updateTable('sms_campaign')
    .set((eb) => ({
      [stat]: eb(stat, '+', increment),
      updatedAt: new Date(),
    }))
    .where('id', '=', id)
    .execute()
}

export const countTodayMessagesByCampaignId = async (campaignId: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db
    .selectFrom('sms_campaign_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .where('sentAt', '>=', today)
    .executeTakeFirst()

  return result?.count ?? 0
}

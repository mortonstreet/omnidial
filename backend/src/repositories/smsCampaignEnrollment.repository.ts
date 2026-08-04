import { db } from '@/lib/db'
import { withId } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { withPagination } from './utils'
import { sql } from 'kysely'

export interface CreateSmsCampaignEnrollmentInput {
  campaignId: string
  leadId: string
  timezone?: string | null
  researchData?: object | null
}

export interface UpdateSmsCampaignEnrollmentInput {
  status?: string
  currentStep?: number
  nextSendAt?: Date | null
  timezone?: string | null
  researchData?: object | null
  lastSentAt?: Date | null
  repliedAt?: Date | null
  unsubscribedAt?: Date | null
  completedAt?: Date | null
}

export const create = async (data: CreateSmsCampaignEnrollmentInput) => {
  const record = {
    ...withId(data),
    status: 'active',
    currentStep: 1,
    enrolledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return db
    .insertInto('sms_campaign_enrollment')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const createMany = async (
  data: CreateSmsCampaignEnrollmentInput[],
): Promise<number> => {
  if (data.length === 0) return 0

  const records = data.map((d) => ({
    ...withId(d),
    status: 'active',
    currentStep: 1,
    enrolledAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const result = await db
    .insertInto('sms_campaign_enrollment')
    .values(records)
    .onConflict((oc) => oc.columns(['campaignId', 'leadId']).doNothing())
    .execute()

  return Number(result[0]?.numInsertedOrUpdatedRows ?? 0)
}

export const findById = async (id: string) => {
  return db
    .selectFrom('sms_campaign_enrollment')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByCampaignAndLead = async (
  campaignId: string,
  leadId: string,
) => {
  return db
    .selectFrom('sms_campaign_enrollment')
    .selectAll()
    .where('campaignId', '=', campaignId)
    .where('leadId', '=', leadId)
    .executeTakeFirst()
}

export interface ListEnrollmentsParams {
  campaignId: string
  status?: string
  pagination: DBPagination
}

export const listByCampaignId = async (params: ListEnrollmentsParams) => {
  const { campaignId, status, pagination } = params

  let query = db
    .selectFrom('sms_campaign_enrollment')
    .selectAll()
    .where('campaignId', '=', campaignId)

  if (status) {
    query = query.where('status', '=', status)
  }

  // Get total count
  const countResult = await db
    .selectFrom('sms_campaign_enrollment')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .$if(!!status, (qb) => qb.where('status', '=', status!))
    .executeTakeFirst()

  const total = countResult?.count ?? 0

  // Get paginated data
  query = query.orderBy('enrolledAt', 'desc')
  query = withPagination(pagination, query)

  const data = await query.execute()

  return { data, total }
}

export const listByCampaignIdWithLead = async (
  params: ListEnrollmentsParams,
) => {
  const { campaignId, status, pagination } = params

  let baseQuery = db
    .selectFrom('sms_campaign_enrollment as e')
    .leftJoin('lead as l', 'l.id', 'e.leadId')
    .where('e.campaignId', '=', campaignId)
    .$if(!!status, (qb) => qb.where('e.status', '=', status!))

  // Get total count
  const countResult = await db
    .selectFrom('sms_campaign_enrollment')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .$if(!!status, (qb) => qb.where('status', '=', status!))
    .executeTakeFirst()

  const total = countResult?.count ?? 0

  // Get paginated data with lead info
  let query = baseQuery
    .select([
      'e.id',
      'e.campaignId',
      'e.leadId',
      'e.status',
      'e.currentStep',
      'e.nextSendAt',
      'e.timezone',
      'e.lastSentAt',
      'e.repliedAt',
      'e.unsubscribedAt',
      'e.enrolledAt',
      'e.completedAt',
      'l.firstName',
      'l.lastName',
      'l.phone',
      'l.normalizedPhone',
      'l.company',
    ])
    .orderBy('e.enrolledAt', 'desc')

  query = withPagination(pagination, query)

  const data = await query.execute()

  return { data, total }
}

export const update = async (
  id: string,
  data: UpdateSmsCampaignEnrollmentInput,
) => {
  return db
    .updateTable('sms_campaign_enrollment')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('sms_campaign_enrollment').where('id', '=', id).execute()
}

export const deleteByCampaignId = async (campaignId: string) => {
  return db
    .deleteFrom('sms_campaign_enrollment')
    .where('campaignId', '=', campaignId)
    .execute()
}

/**
 * Find enrollments ready to send
 * - status = 'active'
 * - nextSendAt <= now
 * - campaign is active
 */
export const findReadyToSend = async (limit: number = 100) => {
  const now = new Date()

  return db
    .selectFrom('sms_campaign_enrollment as e')
    .innerJoin('sms_campaign as c', 'c.id', 'e.campaignId')
    .innerJoin('lead as l', 'l.id', 'e.leadId')
    .select([
      'e.id',
      'e.campaignId',
      'e.leadId',
      'e.status',
      'e.currentStep',
      'e.nextSendAt',
      'e.timezone',
      'e.researchData',
      'c.organizationId',
      'c.sendWindowStart',
      'c.sendWindowEnd',
      'c.sendDays',
      'c.defaultTimezone',
      'c.aiEnabled',
      'c.aiModel',
      'c.aiSystemPrompt',
      'c.valueProposition',
      'c.dailySendLimit',
      'l.firstName',
      'l.lastName',
      'l.phone',
      'l.normalizedPhone',
      'l.company',
      'l.title',
      'l.timezone as leadTimezone',
    ])
    .where('e.status', '=', 'active')
    .where('e.nextSendAt', '<=', now)
    .where('c.status', '=', 'active')
    .where((eb) =>
      eb.or([
        eb('l.normalizedPhone', 'is not', null),
        eb('l.phone', 'is not', null),
      ]),
    )
    .orderBy('e.nextSendAt', 'asc')
    .limit(limit)
    .execute()
}

export const markReplied = async (id: string) => {
  return db
    .updateTable('sms_campaign_enrollment')
    .set({
      status: 'replied',
      repliedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const markUnsubscribed = async (id: string) => {
  return db
    .updateTable('sms_campaign_enrollment')
    .set({
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const markCompleted = async (id: string) => {
  return db
    .updateTable('sms_campaign_enrollment')
    .set({
      status: 'completed',
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const markFailed = async (id: string) => {
  return db
    .updateTable('sms_campaign_enrollment')
    .set({
      status: 'failed',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const advanceToNextStep = async (
  id: string,
  nextStep: number,
  nextSendAt: Date | null,
) => {
  return db
    .updateTable('sms_campaign_enrollment')
    .set({
      currentStep: nextStep,
      nextSendAt,
      lastSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const countByCampaignId = async (campaignId: string) => {
  const result = await db
    .selectFrom('sms_campaign_enrollment')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countByCampaignIdAndStatus = async (
  campaignId: string,
  status: string,
) => {
  const result = await db
    .selectFrom('sms_campaign_enrollment')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .where('status', '=', status)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const getStatusCounts = async (campaignId: string) => {
  const results = await db
    .selectFrom('sms_campaign_enrollment')
    .select(['status', (eb) => eb.fn.countAll<number>().as('count')])
    .where('campaignId', '=', campaignId)
    .groupBy('status')
    .execute()

  const counts: Record<string, number> = {
    active: 0,
    paused: 0,
    completed: 0,
    replied: 0,
    unsubscribed: 0,
    failed: 0,
  }

  for (const row of results) {
    counts[row.status] = row.count
  }

  return counts
}

/**
 * Find enrollment by lead phone number (for inbound reply handling)
 */
export const findActiveByPhone = async (
  phone: string,
  organizationId: string,
) => {
  return db
    .selectFrom('sms_campaign_enrollment as e')
    .innerJoin('sms_campaign as c', 'c.id', 'e.campaignId')
    .innerJoin('lead as l', 'l.id', 'e.leadId')
    .select([
      'e.id',
      'e.campaignId',
      'e.leadId',
      'e.status',
      'c.organizationId',
    ])
    .where('c.organizationId', '=', organizationId)
    .where('e.status', '=', 'active')
    .where((eb) =>
      eb.or([eb('l.normalizedPhone', '=', phone), eb('l.phone', '=', phone)]),
    )
    .orderBy('e.enrolledAt', 'desc')
    .executeTakeFirst()
}

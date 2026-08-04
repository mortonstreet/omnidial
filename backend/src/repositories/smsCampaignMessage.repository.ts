import { db } from '@/lib/db'
import { withId } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { withPagination } from './utils'

export interface CreateSmsCampaignMessageInput {
  campaignId: string
  enrollmentId: string
  stepId: string
  leadId: string
  toPhone: string
  messageBody: string
  originalTemplate: string
  aiPersonalized?: boolean
  scheduledAt?: Date | null
}

export interface UpdateSmsCampaignMessageInput {
  status?: string
  twilioMessageSid?: string | null
  sentAt?: Date | null
  deliveredAt?: Date | null
  failureReason?: string | null
}

export const create = async (data: CreateSmsCampaignMessageInput) => {
  const record = {
    ...withId(data),
    status: 'queued',
    aiPersonalized: data.aiPersonalized ?? false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return db
    .insertInto('sms_campaign_message')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('sms_campaign_message')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByTwilioMessageSid = async (twilioMessageSid: string) => {
  return db
    .selectFrom('sms_campaign_message')
    .selectAll()
    .where('twilioMessageSid', '=', twilioMessageSid)
    .executeTakeFirst()
}

export const findByEnrollmentId = async (
  enrollmentId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('sms_campaign_message')
    .selectAll()
    .where('enrollmentId', '=', enrollmentId)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByCampaignId = async (
  campaignId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('sms_campaign_message')
    .selectAll()
    .where('campaignId', '=', campaignId)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByLeadId = async (leadId: string) => {
  return db
    .selectFrom('sms_campaign_message')
    .selectAll()
    .where('leadId', '=', leadId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const update = async (
  id: string,
  data: UpdateSmsCampaignMessageInput,
) => {
  return db
    .updateTable('sms_campaign_message')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const updateByTwilioMessageSid = async (
  twilioMessageSid: string,
  data: UpdateSmsCampaignMessageInput,
) => {
  return db
    .updateTable('sms_campaign_message')
    .set({ ...data, updatedAt: new Date() })
    .where('twilioMessageSid', '=', twilioMessageSid)
    .returningAll()
    .executeTakeFirst()
}

export const markSending = async (id: string) => {
  return db
    .updateTable('sms_campaign_message')
    .set({
      status: 'sending',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markSent = async (id: string, twilioMessageSid: string) => {
  return db
    .updateTable('sms_campaign_message')
    .set({
      status: 'sent',
      twilioMessageSid,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const markDelivered = async (id: string) => {
  return db
    .updateTable('sms_campaign_message')
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markFailed = async (id: string, failureReason: string) => {
  return db
    .updateTable('sms_campaign_message')
    .set({
      status: 'failed',
      failureReason,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markUndelivered = async (id: string, failureReason?: string) => {
  return db
    .updateTable('sms_campaign_message')
    .set({
      status: 'undelivered',
      failureReason: failureReason ?? 'Message undelivered',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('sms_campaign_message').where('id', '=', id).execute()
}

export const deleteByCampaignId = async (campaignId: string) => {
  return db
    .deleteFrom('sms_campaign_message')
    .where('campaignId', '=', campaignId)
    .execute()
}

export const countByCampaignId = async (campaignId: string) => {
  const result = await db
    .selectFrom('sms_campaign_message')
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
    .selectFrom('sms_campaign_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .where('status', '=', status)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countTodayByCampaignId = async (campaignId: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db
    .selectFrom('sms_campaign_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .where('sentAt', '>=', today)
    .where('status', 'in', ['sent', 'delivered'])
    .executeTakeFirst()

  return result?.count ?? 0
}

export const getStepStats = async (campaignId: string) => {
  return db
    .selectFrom('sms_campaign_message as m')
    .innerJoin('sms_campaign_step as s', 's.id', 'm.stepId')
    .select([
      's.stepNumber',
      's.dayOffset',
      (eb) =>
        eb.fn
          .countAll()
          .filterWhere('m.status', 'in', ['sent', 'delivered'])
          .as('totalSent'),
      (eb) =>
        eb.fn
          .countAll()
          .filterWhere('m.status', '=', 'delivered')
          .as('totalDelivered'),
      (eb) =>
        eb.fn
          .countAll()
          .filterWhere('m.status', 'in', ['failed', 'undelivered'])
          .as('totalFailed'),
    ])
    .where('m.campaignId', '=', campaignId)
    .groupBy(['s.stepNumber', 's.dayOffset'])
    .orderBy('s.stepNumber', 'asc')
    .execute()
}

import { db } from '@/lib/db'
import { withId } from './utils'

export interface CreateSmsCampaignStepInput {
  campaignId: string
  stepNumber: number
  dayOffset: number
  messageTemplate: string
  aiEnabled?: boolean | null
  aiPromptOverride?: string | null
  skipIfReplied?: boolean
}

export interface UpdateSmsCampaignStepInput {
  stepNumber?: number
  dayOffset?: number
  messageTemplate?: string
  aiEnabled?: boolean | null
  aiPromptOverride?: string | null
  skipIfReplied?: boolean
  totalSent?: number
  totalDelivered?: number
  totalFailed?: number
}

export const create = async (data: CreateSmsCampaignStepInput) => {
  const record = {
    ...withId(data),
    skipIfReplied: data.skipIfReplied ?? true,
    totalSent: 0,
    totalDelivered: 0,
    totalFailed: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return db
    .insertInto('sms_campaign_step')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('sms_campaign_step')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByCampaignId = async (campaignId: string) => {
  return db
    .selectFrom('sms_campaign_step')
    .selectAll()
    .where('campaignId', '=', campaignId)
    .orderBy('stepNumber', 'asc')
    .execute()
}

export const findByCampaignIdAndStepNumber = async (
  campaignId: string,
  stepNumber: number,
) => {
  return db
    .selectFrom('sms_campaign_step')
    .selectAll()
    .where('campaignId', '=', campaignId)
    .where('stepNumber', '=', stepNumber)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateSmsCampaignStepInput) => {
  return db
    .updateTable('sms_campaign_step')
    .set({ ...data, updatedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('sms_campaign_step').where('id', '=', id).execute()
}

export const deleteByCampaignId = async (campaignId: string) => {
  return db
    .deleteFrom('sms_campaign_step')
    .where('campaignId', '=', campaignId)
    .execute()
}

export const incrementStat = async (
  id: string,
  stat: 'totalSent' | 'totalDelivered' | 'totalFailed',
  increment: number = 1,
) => {
  return db
    .updateTable('sms_campaign_step')
    .set((eb) => ({
      [stat]: eb(stat, '+', increment),
      updatedAt: new Date(),
    }))
    .where('id', '=', id)
    .execute()
}

export const countByCampaignId = async (campaignId: string) => {
  const result = await db
    .selectFrom('sms_campaign_step')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const getMaxStepNumber = async (campaignId: string) => {
  const result = await db
    .selectFrom('sms_campaign_step')
    .select((eb) => eb.fn.max('stepNumber').as('maxStep'))
    .where('campaignId', '=', campaignId)
    .executeTakeFirst()
  return (result?.maxStep as number) ?? 0
}

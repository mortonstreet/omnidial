import { db } from '@/lib/db'
import { withId } from './utils'

export interface CreateSmsCampaignListInput {
  campaignId: string
  listId: string
}

export const create = async (data: CreateSmsCampaignListInput) => {
  const record = {
    ...withId(data),
    addedAt: new Date(),
  }
  return db
    .insertInto('sms_campaign_list')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('sms_campaign_list')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByCampaignAndList = async (
  campaignId: string,
  listId: string,
) => {
  return db
    .selectFrom('sms_campaign_list')
    .selectAll()
    .where('campaignId', '=', campaignId)
    .where('listId', '=', listId)
    .executeTakeFirst()
}

export const findByCampaignId = async (campaignId: string) => {
  return db
    .selectFrom('sms_campaign_list')
    .selectAll()
    .where('campaignId', '=', campaignId)
    .orderBy('addedAt', 'desc')
    .execute()
}

export const findByCampaignIdWithList = async (campaignId: string) => {
  return db
    .selectFrom('sms_campaign_list as scl')
    .innerJoin('lead_list as ll', 'll.id', 'scl.listId')
    .select([
      'scl.id',
      'scl.campaignId',
      'scl.listId',
      'scl.addedAt',
      'll.name as listName',
      'll.leadCount',
    ])
    .where('scl.campaignId', '=', campaignId)
    .orderBy('scl.addedAt', 'desc')
    .execute()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('sms_campaign_list').where('id', '=', id).execute()
}

export const deleteByCampaignAndList = async (
  campaignId: string,
  listId: string,
) => {
  return db
    .deleteFrom('sms_campaign_list')
    .where('campaignId', '=', campaignId)
    .where('listId', '=', listId)
    .execute()
}

export const deleteByCampaignId = async (campaignId: string) => {
  return db
    .deleteFrom('sms_campaign_list')
    .where('campaignId', '=', campaignId)
    .execute()
}

export const countByCampaignId = async (campaignId: string) => {
  const result = await db
    .selectFrom('sms_campaign_list')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('campaignId', '=', campaignId)
    .executeTakeFirst()
  return result?.count ?? 0
}

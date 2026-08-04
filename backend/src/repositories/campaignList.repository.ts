import { db } from '@/lib/db'
import { withId } from './utils'

export const addListToCampaign = async (campaignId: string, listId: string) => {
  return db
    .insertInto('campaign_list')
    .values({
      ...withId({ campaignId, listId }),
      addedAt: new Date(),
    })
    .onConflict((oc) => oc.columns(['campaignId', 'listId']).doNothing())
    .returningAll()
    .executeTakeFirst()
}

export const removeListFromCampaign = async (
  campaignId: string,
  listId: string,
) => {
  const result = await db
    .deleteFrom('campaign_list')
    .where('campaignId', '=', campaignId)
    .where('listId', '=', listId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const findByCampaign = async (campaignId: string) => {
  return db
    .selectFrom('campaign_list')
    .innerJoin('lead_list', 'lead_list.id', 'campaign_list.listId')
    .where('campaign_list.campaignId', '=', campaignId)
    .select([
      'campaign_list.id',
      'campaign_list.addedAt',
      'lead_list.id as listId',
      'lead_list.name',
      'lead_list.leadCount',
    ])
    .orderBy('campaign_list.addedAt', 'desc')
    .execute()
}

export const findByList = async (listId: string) => {
  return db
    .selectFrom('campaign_list')
    .innerJoin('campaign', 'campaign.id', 'campaign_list.campaignId')
    .where('campaign_list.listId', '=', listId)
    .select([
      'campaign_list.id',
      'campaign.id as campaignId',
      'campaign.name',
      'campaign.lastCalledAt',
    ])
    .execute()
}

export const create = addListToCampaign

// Get all lead IDs from all lists linked to a campaign
export const getLeadIdsForCampaign = async (
  campaignId: string,
): Promise<string[]> => {
  const results = await db
    .selectFrom('campaign_list')
    .innerJoin(
      'lead_list_entry',
      'lead_list_entry.listId',
      'campaign_list.listId',
    )
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('campaign_list.campaignId', '=', campaignId)
    .where('lead.deletedAt', 'is', null)
    .select('lead.id')
    .distinct()
    .execute()

  return results.map((r) => r.id)
}

// Get count of active leads across all lists in a campaign
export const getActiveCampaignLeadCount = async (
  campaignId: string,
): Promise<number> => {
  const result = await db
    .selectFrom('campaign_list')
    .innerJoin(
      'lead_list_entry',
      'lead_list_entry.listId',
      'campaign_list.listId',
    )
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('campaign_list.campaignId', '=', campaignId)
    .where('lead_list_entry.removedAt', 'is', null)
    .where('lead.deletedAt', 'is', null)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirst()

  return Number(result?.count ?? 0)
}

// Get leads from all lists in a campaign with offset pagination
export const findCampaignLeadsWithOffset = async (
  campaignId: string,
  offset: number,
  limit: number = 1,
) => {
  const leads = await db
    .selectFrom('campaign_list')
    .innerJoin(
      'lead_list_entry',
      'lead_list_entry.listId',
      'campaign_list.listId',
    )
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('campaign_list.campaignId', '=', campaignId)
    .where('lead_list_entry.removedAt', 'is', null)
    .where('lead.deletedAt', 'is', null)
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
      'lead_list_entry.listId',
    ])
    .orderBy('campaign_list.addedAt', 'asc')
    .orderBy('lead_list_entry.sortOrder', 'asc')
    .offset(offset)
    .limit(limit)
    .execute()

  return leads
}

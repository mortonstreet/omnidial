import { db } from '@/lib/db'
import { withId, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export const addLeads = async (listId: string, leadIds: string[]) => {
  if (leadIds.length === 0) return 0

  const maxOrder = await db
    .selectFrom('lead_list_entry')
    .where('listId', '=', listId)
    .where('removedAt', 'is', null)
    .select((eb) => eb.fn.max('sortOrder').as('maxOrder'))
    .executeTakeFirst()

  const startOrder = (maxOrder?.maxOrder ?? -1) + 1

  const values = leadIds.map((leadId, index) => ({
    ...withId({ listId, leadId }),
    sortOrder: startOrder + index,
    createdAt: new Date(),
    removedAt: null,
  }))

  // On conflict (lead already in list), restore it by clearing removedAt
  await db
    .insertInto('lead_list_entry')
    .values(values)
    .onConflict((oc) =>
      oc.columns(['listId', 'leadId']).doUpdateSet({
        removedAt: null,
        sortOrder: (eb) => eb.ref('excluded.sortOrder'),
      }),
    )
    .execute()

  return values.length
}

export const removeLeads = async (listId: string, leadIds: string[]) => {
  if (leadIds.length === 0) return 0

  const result = await db
    .deleteFrom('lead_list_entry')
    .where('listId', '=', listId)
    .where('leadId', 'in', leadIds)
    .executeTakeFirst()

  return Number(result.numDeletedRows)
}

// Soft remove leads from list - sets removedAt timestamp instead of deleting
export const softRemoveLeads = async (listId: string, leadIds: string[]) => {
  if (leadIds.length === 0) return 0

  const result = await db
    .updateTable('lead_list_entry')
    .set({ removedAt: new Date() })
    .where('listId', '=', listId)
    .where('leadId', 'in', leadIds)
    .where('removedAt', 'is', null)
    .executeTakeFirst()

  return Number(result.numUpdatedRows)
}

// Restore soft-removed leads back to list
export const restoreLeads = async (listId: string, leadIds: string[]) => {
  if (leadIds.length === 0) return 0

  const result = await db
    .updateTable('lead_list_entry')
    .set({ removedAt: null })
    .where('listId', '=', listId)
    .where('leadId', 'in', leadIds)
    .where('removedAt', 'is not', null)
    .executeTakeFirst()

  return Number(result.numUpdatedRows)
}

export const findByList = async (
  listId: string,
  filters: { search?: string },
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead_list_entry.removedAt', 'is', null) // Exclude soft-removed entries
    .where('lead.deletedAt', 'is', null)

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

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const leads = await withPagination(
    pagination,
    query.select([
      'lead_list_entry.id as entryId',
      'lead_list_entry.sortOrder',
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
    ]),
  )
    .orderBy('lead_list_entry.sortOrder', 'asc')
    .execute()

  return { data: leads, total: Number(countResult.count) }
}

export const getLeadIdsByList = async (listId: string): Promise<string[]> => {
  const results = await db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead_list_entry.removedAt', 'is', null) // Exclude soft-removed entries
    .where('lead.deletedAt', 'is', null)
    .select('lead.id')
    .execute()

  return results.map((r) => r.id)
}

export const findAllByList = async (listId: string) => {
  const leads = await db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead_list_entry.removedAt', 'is', null) // Exclude soft-removed entries
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
    ])
    .orderBy('lead_list_entry.sortOrder', 'asc')
    .execute()

  return leads
}

// Get next leads to dial from a list (for parallel dialer)
export const findNextToDialFromList = async (
  listId: string,
  limit: number,
  sessionId: string,
) => {
  const leads = await db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead_list_entry.removedAt', 'is', null)
    .where('lead.deletedAt', 'is', null)
    .where('lead.phone', 'is not', null)
    // Exclude leads already attempted in this session
    .where(
      'lead_list_entry.leadId',
      'not in',
      db
        .selectFrom('parallel_dial_attempt')
        .where('parallel_dial_attempt.sessionId', '=', sessionId)
        .select('parallel_dial_attempt.leadId'),
    )
    .select(['lead_list_entry.leadId', 'lead.phone'])
    .orderBy('lead_list_entry.sortOrder', 'asc')
    .limit(limit)
    .execute()

  return leads
}

/**
 * Get count of active (non-removed) leads in a list
 * Used for power dialer snaking to calculate modulo wrapping
 */
export const getActiveLeadCount = async (listId: string): Promise<number> => {
  const result = await db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead_list_entry.removedAt', 'is', null)
    .where('lead.deletedAt', 'is', null)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirst()

  return Number(result?.count ?? 0)
}

/**
 * Get all lead list entries for a list (used for SMS campaign enrollment)
 */
export const findByListId = async (listId: string, organizationId: string) => {
  return db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead.organizationId', '=', organizationId)
    .where('lead.deletedAt', 'is', null)
    .select([
      'lead_list_entry.id',
      'lead_list_entry.leadId',
      'lead_list_entry.listId',
      'lead_list_entry.removedAt',
    ])
    .execute()
}

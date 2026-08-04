import { db } from '@/lib/db'
import { withIdAndTimestamps, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateScriptInput {
  organizationId: string
  name: string
  content: string
  campaignId?: string
  isDefault?: boolean
}

export interface UpdateScriptInput {
  name?: string
  content?: string
  campaignId?: string | null
  isDefault?: boolean
}

export interface ScriptFilters {
  organizationId: string
  campaignId?: string
}

export const findById = async (id: string) => {
  return db
    .selectFrom('script')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByIdAndOrg = async (id: string, organizationId: string) => {
  return db
    .selectFrom('script')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
}

export const findMany = async (
  filters: ScriptFilters,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('script')
    .where('organizationId', '=', filters.organizationId)

  if (filters.campaignId) {
    query = query.where('campaignId', '=', filters.campaignId)
  }

  const countResult = await query
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  const total = Number(countResult?.count || 0)

  const data = await withPagination(
    pagination,
    db
      .selectFrom('script')
      .where('organizationId', '=', filters.organizationId)
      .$if(!!filters.campaignId, (qb) =>
        qb.where('campaignId', '=', filters.campaignId!),
      )
      .selectAll()
      .orderBy('createdAt', 'desc'),
  ).execute()

  return { data, total }
}

export const findByCampaignId = async (campaignId: string) => {
  return db
    .selectFrom('script')
    .where('campaignId', '=', campaignId)
    .selectAll()
    .orderBy('isDefault', 'desc')
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findDefaultForOrg = async (organizationId: string) => {
  return db
    .selectFrom('script')
    .where('organizationId', '=', organizationId)
    .where('isDefault', '=', true)
    .where('campaignId', 'is', null)
    .selectAll()
    .executeTakeFirst()
}

export const create = async (data: CreateScriptInput) => {
  const record = withIdAndTimestamps(
    {
      ...data,
      isDefault: data.isDefault || false,
    },
    true,
  )

  return db
    .insertInto('script')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateScriptInput,
) => {
  const record = withTimestamps(data)

  return db
    .updateTable('script')
    .set(record)
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
}

export const deleteById = async (id: string, organizationId: string) => {
  return db
    .deleteFrom('script')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
}

import { db } from '@/lib/db'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateApiKeyInput {
  organizationId: string
  name: string
  keyHash: string
  keyPrefix: string
  scopes: string[]
  expiresAt?: Date | null
  createdById: string
}

export interface ApiKeyFilters {
  organizationId: string
  includeRevoked?: boolean
}

export const create = async (data: CreateApiKeyInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('api_key')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('api_key')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByKeyHash = async (keyHash: string) => {
  return db
    .selectFrom('api_key')
    .where('keyHash', '=', keyHash)
    .where('revokedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()
}

export const findMany = async (
  filters: ApiKeyFilters,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('api_key')
    .where('organizationId', '=', filters.organizationId)

  if (!filters.includeRevoked) {
    query = query.where('revokedAt', 'is', null)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const data = await withPagination(pagination, query.selectAll())
    .orderBy('createdAt', 'desc')
    .execute()

  return {
    data,
    total: Number(countResult.count),
  }
}

export const findAllActive = async () => {
  return db
    .selectFrom('api_key')
    .where('revokedAt', 'is', null)
    .where((eb) =>
      eb.or([eb('expiresAt', 'is', null), eb('expiresAt', '>', new Date())]),
    )
    .selectAll()
    .execute()
}

export const revoke = async (id: string) => {
  return db
    .updateTable('api_key')
    .set({ revokedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const updateLastUsed = async (id: string) => {
  return db
    .updateTable('api_key')
    .set({ lastUsedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

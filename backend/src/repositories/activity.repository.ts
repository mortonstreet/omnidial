import { db } from '@/lib/db'
import { withId } from './utils'

export interface CreateActivityInput {
  type: string
  userId: string
  organizationId: string
  description: string
  metadata?: Record<string, unknown>
}

export interface GetActivityFilters {
  organizationId: string
  types?: string[]
  userId?: string
  limit: number
  cursor?: string
}

export const create = async (data: CreateActivityInput) => {
  return db
    .insertInto('activity')
    .values(
      withId({
        ...data,
        metadata: JSON.stringify(data.metadata ?? {}),
        createdAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findByOrganization = async (filters: GetActivityFilters) => {
  let query = db
    .selectFrom('activity')
    .selectAll()
    .where('organizationId', '=', filters.organizationId)
    .orderBy('createdAt', 'desc')
    .limit(filters.limit + 1)

  if (filters.types && filters.types.length > 0) {
    query = query.where('type', 'in', filters.types)
  }

  if (filters.userId) {
    query = query.where('userId', '=', filters.userId)
  }

  if (filters.cursor) {
    query = query.where('createdAt', '<', new Date(filters.cursor))
  }

  const items = await query.execute()

  // Check if there are more items
  let nextCursor: string | undefined
  if (items.length > filters.limit) {
    const lastItem = items[filters.limit - 1]
    nextCursor = new Date(lastItem.createdAt as unknown as string).toISOString()
    items.pop() // Remove the extra item
  }

  return { items: items.slice(0, filters.limit), nextCursor }
}

export const findById = async (id: string) => {
  return db
    .selectFrom('activity')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const deleteById = async (id: string): Promise<void> => {
  await db.deleteFrom('activity').where('id', '=', id).execute()
}

import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withId } from './utils'
import { DBNote, InsertDBNote, UpdateDBNote } from '@shared/db/src/types'

export type FindNotesOptions = {
  leadId: string
  page: number
  limit: number
}

export type PaginatedNotesResult = {
  data: DBNote[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const findByLeadId = async (
  options: FindNotesOptions,
): Promise<PaginatedNotesResult> => {
  const query = db.selectFrom('note').where('leadId', '=', options.leadId)

  const countResult = await query
    .select(sql<number>`count(*)::int`.as('count'))
    .executeTakeFirst()

  const total = countResult?.count ?? 0

  const data = await query
    .orderBy('createdAt', 'desc')
    .limit(options.limit)
    .offset((options.page - 1) * options.limit)
    .selectAll()
    .execute()

  return {
    data,
    total,
    page: options.page,
    limit: options.limit,
    totalPages: Math.ceil(total / options.limit),
  }
}

export const findById = async (id: string): Promise<DBNote | undefined> => {
  return db
    .selectFrom('note')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const create = async (
  data: Omit<InsertDBNote, 'id' | 'createdAt'>,
): Promise<DBNote | undefined> => {
  return db
    .insertInto('note')
    .values({
      ...withId(data),
      createdAt: new Date(),
    })
    .returningAll()
    .executeTakeFirst()
}

export const update = async (
  id: string,
  data: { content: string },
): Promise<DBNote | undefined> => {
  return db
    .updateTable('note')
    .set(data)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const deleteById = async (id: string): Promise<void> => {
  await db.deleteFrom('note').where('id', '=', id).execute()
}

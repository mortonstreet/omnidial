import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withId } from './utils'
import { DBTask, InsertDBTask, UpdateDBTask } from '@shared/db/src/types'

export type FindTasksOptions = {
  organizationId: string
  userId?: string
  leadId?: string
  completed?: 'true' | 'false' | 'all'
  dueFrom?: Date
  dueTo?: Date
  page: number
  limit: number
}

export type PaginatedTasksResult = {
  data: DBTask[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export const findByOrganizationId = async (
  options: FindTasksOptions,
): Promise<PaginatedTasksResult> => {
  let query = db
    .selectFrom('task')
    .where('organizationId', '=', options.organizationId)

  if (options.userId) {
    query = query.where('userId', '=', options.userId)
  }

  if (options.leadId) {
    query = query.where('leadId', '=', options.leadId)
  }

  if (options.completed === 'true') {
    query = query.where('completedAt', 'is not', null)
  } else if (options.completed === 'false') {
    query = query.where('completedAt', 'is', null)
  }

  if (options.dueFrom) {
    query = query.where('dueAt', '>=', options.dueFrom)
  }

  if (options.dueTo) {
    query = query.where('dueAt', '<=', options.dueTo)
  }

  const countResult = await query
    .select(sql<number>`count(*)::int`.as('count'))
    .executeTakeFirst()

  const total = countResult?.count ?? 0

  const data = await query
    .orderBy('dueAt', 'asc')
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

export const findById = async (id: string): Promise<DBTask | undefined> => {
  return db
    .selectFrom('task')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByLeadId = async (leadId: string): Promise<DBTask[]> => {
  return db
    .selectFrom('task')
    .where('leadId', '=', leadId)
    .orderBy('dueAt', 'asc')
    .orderBy('createdAt', 'desc')
    .selectAll()
    .execute()
}

export const create = async (
  data: Omit<InsertDBTask, 'id' | 'createdAt'>,
): Promise<DBTask | undefined> => {
  return db
    .insertInto('task')
    .values({
      ...withId(data),
      createdAt: new Date(),
    })
    .returningAll()
    .executeTakeFirst()
}

export const update = async (
  id: string,
  data: Omit<
    UpdateDBTask,
    'id' | 'organizationId' | 'userId' | 'leadId' | 'createdAt'
  >,
): Promise<DBTask | undefined> => {
  return db
    .updateTable('task')
    .set(data)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const complete = async (id: string): Promise<DBTask | undefined> => {
  return db
    .updateTable('task')
    .set({ completedAt: new Date() })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const uncomplete = async (id: string): Promise<DBTask | undefined> => {
  return db
    .updateTable('task')
    .set({ completedAt: null })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const deleteById = async (id: string): Promise<void> => {
  await db.deleteFrom('task').where('id', '=', id).execute()
}

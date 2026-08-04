import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateParallelDialSessionInput {
  organizationId: string
  userId: string
  campaignId?: string
  listId?: string
  lineCount?: number
  conferenceId?: string
}

export interface UpdateParallelDialSessionInput {
  status?: string
  conferenceId?: string
  totalAttempts?: number
  totalConnects?: number
  totalAbandoned?: number
  endedAt?: Date
}

export const create = async (data: CreateParallelDialSessionInput) => {
  const session = await db
    .insertInto('parallel_dial_session')
    .values({
      ...withId(
        withTimestamps(
          {
            organizationId: data.organizationId,
            userId: data.userId,
            campaignId: data.campaignId ?? null,
            listId: data.listId ?? null,
            lineCount: data.lineCount ?? 2,
            status: 'active',
            conferenceId: data.conferenceId ?? null,
            totalAttempts: 0,
            totalConnects: 0,
            totalAbandoned: 0,
            startedAt: new Date(),
          },
          true,
        ),
      ),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return session
}

export const findById = async (id: string) => {
  return db
    .selectFrom('parallel_dial_session')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findActiveByUserId = async (userId: string) => {
  return db
    .selectFrom('parallel_dial_session')
    .where('userId', '=', userId)
    .where('status', '=', 'active')
    .selectAll()
    .executeTakeFirst()
}

export const findByOrganization = async (
  organizationId: string,
  filters: {
    status?: string
    userId?: string
  },
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('parallel_dial_session')
    .where('organizationId', '=', organizationId)

  if (filters.status) {
    query = query.where('status', '=', filters.status)
  }

  if (filters.userId) {
    query = query.where('userId', '=', filters.userId)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const sessions = await withPagination(pagination, query.selectAll())
    .orderBy('startedAt', 'desc')
    .execute()

  return {
    data: sessions,
    total: Number(countResult.count),
  }
}

export const update = async (
  id: string,
  data: UpdateParallelDialSessionInput,
) => {
  return db
    .updateTable('parallel_dial_session')
    .set({
      ...withTimestamps({}),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.conferenceId !== undefined && {
        conferenceId: data.conferenceId,
      }),
      ...(data.totalAttempts !== undefined && {
        totalAttempts: data.totalAttempts,
      }),
      ...(data.totalConnects !== undefined && {
        totalConnects: data.totalConnects,
      }),
      ...(data.totalAbandoned !== undefined && {
        totalAbandoned: data.totalAbandoned,
      }),
      ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const incrementStats = async (
  id: string,
  stats: {
    attempts?: number
    connects?: number
    abandoned?: number
  },
) => {
  let query = db.updateTable('parallel_dial_session').where('id', '=', id)

  const updates: Record<string, unknown> = { ...withTimestamps({}) }

  if (stats.attempts) {
    // Use raw SQL for increment
    updates.totalAttempts = sql`"totalAttempts" + ${stats.attempts}`
  }
  if (stats.connects) {
    updates.totalConnects = sql`"totalConnects" + ${stats.connects}`
  }
  if (stats.abandoned) {
    updates.totalAbandoned = sql`"totalAbandoned" + ${stats.abandoned}`
  }

  return query.set(updates).returningAll().executeTakeFirst()
}

export const endSession = async (id: string) => {
  return db
    .updateTable('parallel_dial_session')
    .set({
      ...withTimestamps({}),
      status: 'ended',
      endedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

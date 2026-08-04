import { db } from '@/lib/db'
import { withId } from './utils'

export interface CreateScheduleEventInput {
  type: string
  title: string
  leadId?: string | null
  userId: string
  organizationId: string
  startTime: Date
  endTime?: Date | null
  notes?: string | null
}

export interface UpdateScheduleEventInput {
  type?: string
  title?: string
  leadId?: string | null
  startTime?: Date
  endTime?: Date | null
  notes?: string | null
}

export interface GetScheduleFilters {
  organizationId: string
  startDate: Date
  endDate: Date
  userId?: string
}

export const create = async (data: CreateScheduleEventInput) => {
  return db
    .insertInto('schedule_event')
    .values(
      withId({
        ...data,
        createdAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findByOrganization = async (filters: GetScheduleFilters) => {
  let query = db
    .selectFrom('schedule_event')
    .selectAll()
    .where('organizationId', '=', filters.organizationId)
    .where('startTime', '>=', filters.startDate)
    .where('startTime', '<=', filters.endDate)
    .orderBy('startTime', 'asc')

  if (filters.userId) {
    query = query.where('userId', '=', filters.userId)
  }

  return query.execute()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('schedule_event')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateScheduleEventInput) => {
  return db
    .updateTable('schedule_event')
    .set(data)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  await db.deleteFrom('schedule_event').where('id', '=', id).execute()
}

export const findByUserAndDateRange = async (
  userId: string,
  startDate: Date,
  endDate: Date,
) => {
  return db
    .selectFrom('schedule_event')
    .selectAll()
    .where('userId', '=', userId)
    .where('startTime', '>=', startDate)
    .where('startTime', '<=', endDate)
    .orderBy('startTime', 'asc')
    .execute()
}

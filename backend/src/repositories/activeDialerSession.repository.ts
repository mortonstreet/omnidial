import { db } from '@/lib/db'
import { withIdAndTimestamps, withTimestamps } from './utils'

export interface CreateActiveDialerSessionInput {
  organizationId: string
  userId: string
  twilioConfigId: string
  campaignId?: string
  listId?: string
  status?: string
}

export interface UpdateActiveDialerSessionInput {
  status?: string
  currentCallId?: string
  endedAt?: Date
}

export const findById = async (id: string) => {
  return db
    .selectFrom('active_dialer_session')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findActiveByUserId = async (userId: string) => {
  return db
    .selectFrom('active_dialer_session')
    .where('userId', '=', userId)
    .where('status', '=', 'active')
    .selectAll()
    .executeTakeFirst()
}

export const findActiveByOrganization = async (organizationId: string) => {
  return db
    .selectFrom('active_dialer_session')
    .leftJoin('user', 'user.id', 'active_dialer_session.userId')
    .where('active_dialer_session.organizationId', '=', organizationId)
    .where('active_dialer_session.status', '=', 'active')
    .select([
      'active_dialer_session.id',
      'active_dialer_session.organizationId',
      'active_dialer_session.userId',
      'active_dialer_session.twilioConfigId',
      'active_dialer_session.status',
      'active_dialer_session.currentCallId',
      'active_dialer_session.campaignId',
      'active_dialer_session.listId',
      'active_dialer_session.startedAt',
      'active_dialer_session.endedAt',
      'active_dialer_session.createdAt',
      'active_dialer_session.updatedAt',
      'user.name as userName',
      'user.email as userEmail',
    ])
    .execute()
}

export const create = async (data: CreateActiveDialerSessionInput) => {
  const record = withIdAndTimestamps(
    {
      ...data,
      status: data.status || 'active',
      startedAt: new Date(),
    },
    true,
  )

  return db
    .insertInto('active_dialer_session')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  id: string,
  data: UpdateActiveDialerSessionInput,
) => {
  const record = withTimestamps(data)

  return db
    .updateTable('active_dialer_session')
    .set(record)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const endSession = async (id: string) => {
  const record = withTimestamps({
    status: 'ended',
    endedAt: new Date(),
  })

  return db
    .updateTable('active_dialer_session')
    .set(record)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const endAllUserSessions = async (userId: string) => {
  const record = withTimestamps({
    status: 'ended',
    endedAt: new Date(),
  })

  return db
    .updateTable('active_dialer_session')
    .set(record)
    .where('userId', '=', userId)
    .where('status', '=', 'active')
    .returningAll()
    .execute()
}

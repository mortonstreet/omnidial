import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateAgentInput {
  organizationId: string
  memberId: string
  name: string
  description?: string | null
  systemPrompt: string
  status?: string
  emailEnabled?: boolean
  smsEnabled?: boolean
  dailyEmailLimit?: number
  dailySmsLimit?: number
  createdById: string
}

export interface UpdateAgentInput {
  name?: string
  description?: string | null
  systemPrompt?: string
  status?: string
  emailEnabled?: boolean
  smsEnabled?: boolean
  dailyEmailLimit?: number
  dailySmsLimit?: number
}

export const create = async (data: CreateAgentInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('agent')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByMemberId = async (memberId: string) => {
  return db
    .selectFrom('agent')
    .selectAll()
    .where('memberId', '=', memberId)
    .executeTakeFirst()
}

export const findByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('agent')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findActiveByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('agent')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('status', '=', 'active')
    .orderBy('createdAt', 'desc')
    .execute()
}

export const update = async (id: string, data: UpdateAgentInput) => {
  return db
    .updateTable('agent')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const activate = async (id: string) => {
  return db
    .updateTable('agent')
    .set({
      status: 'active',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deactivate = async (id: string) => {
  return db
    .updateTable('agent')
    .set({
      status: 'inactive',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const pause = async (id: string) => {
  return db
    .updateTable('agent')
    .set({
      status: 'paused',
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent').where('id', '=', id).execute()
}

export const countByOrganizationId = async (organizationId: string) => {
  const result = await db
    .selectFrom('agent')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return result?.count ?? 0
}

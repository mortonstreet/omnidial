import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateClientUserAssignmentInput {
  organizationId: string
  clientId: string
  userId: string
}

export const create = async (data: CreateClientUserAssignmentInput) => {
  const assignment = await db
    .insertInto('client_user_assignment')
    .values(withId(withTimestamps(data, true)))
    .returningAll()
    .executeTakeFirstOrThrow()
  return assignment
}

export const findByUser = async (organizationId: string, userId: string) => {
  const assignments = await db
    .selectFrom('client_user_assignment')
    .innerJoin('client', 'client.id', 'client_user_assignment.clientId')
    .where('client_user_assignment.organizationId', '=', organizationId)
    .where('client_user_assignment.userId', '=', userId)
    .select([
      'client_user_assignment.id',
      'client_user_assignment.clientId',
      'client_user_assignment.userId',
      'client_user_assignment.createdAt',
      'client.name as clientName',
      'client.color as clientColor',
    ])
    .execute()
  return assignments
}

export const findByClient = async (
  organizationId: string,
  clientId: string,
) => {
  const assignments = await db
    .selectFrom('client_user_assignment')
    .innerJoin('user', 'user.id', 'client_user_assignment.userId')
    .where('client_user_assignment.organizationId', '=', organizationId)
    .where('client_user_assignment.clientId', '=', clientId)
    .select([
      'client_user_assignment.id',
      'client_user_assignment.clientId',
      'client_user_assignment.userId',
      'client_user_assignment.createdAt',
      'user.name as userName',
      'user.email as userEmail',
    ])
    .execute()
  return assignments
}

export const findAssignment = async (clientId: string, userId: string) => {
  const assignment = await db
    .selectFrom('client_user_assignment')
    .where('clientId', '=', clientId)
    .where('userId', '=', userId)
    .selectAll()
    .executeTakeFirst()
  return assignment
}

export const remove = async (clientId: string, userId: string) => {
  const result = await db
    .deleteFrom('client_user_assignment')
    .where('clientId', '=', clientId)
    .where('userId', '=', userId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const getAssignedClientIds = async (
  organizationId: string,
  userId: string,
) => {
  const assignments = await db
    .selectFrom('client_user_assignment')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .select('clientId')
    .execute()
  return assignments.map((a) => a.clientId)
}

export const findClientsForUser = async (
  organizationId: string,
  userId: string,
) => {
  const clients = await db
    .selectFrom('client_user_assignment')
    .innerJoin('client', 'client.id', 'client_user_assignment.clientId')
    .where('client_user_assignment.organizationId', '=', organizationId)
    .where('client_user_assignment.userId', '=', userId)
    .select([
      'client.id',
      'client.name',
      'client.color',
      'client.organizationId',
      'client.createdAt',
      'client.updatedAt',
    ])
    .orderBy('client.name', 'asc')
    .execute()
  return clients
}

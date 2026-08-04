import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateClientPhoneNumberInput {
  organizationId: string
  clientId: string
  phoneNumber: string
  friendlyName?: string
}

export const create = async (data: CreateClientPhoneNumberInput) => {
  const assignment = await db
    .insertInto('client_phone_number')
    .values(withId(withTimestamps(data, true)))
    .returningAll()
    .executeTakeFirstOrThrow()
  return assignment
}

export const findByOrganization = async (organizationId: string) => {
  return db
    .selectFrom('client_phone_number')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .orderBy('createdAt', 'asc')
    .execute()
}

export const findByClient = async (
  organizationId: string,
  clientId: string,
) => {
  return db
    .selectFrom('client_phone_number')
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .selectAll()
    .orderBy('createdAt', 'asc')
    .execute()
}

export const findByPhoneNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  return db
    .selectFrom('client_phone_number')
    .where('organizationId', '=', organizationId)
    .where('phoneNumber', '=', phoneNumber)
    .selectAll()
    .executeTakeFirst()
}

export const findByOrganizationWithClient = async (organizationId: string) => {
  return db
    .selectFrom('client_phone_number')
    .innerJoin('client', 'client.id', 'client_phone_number.clientId')
    .where('client_phone_number.organizationId', '=', organizationId)
    .select([
      'client_phone_number.id',
      'client_phone_number.organizationId',
      'client_phone_number.clientId',
      'client_phone_number.phoneNumber',
      'client_phone_number.friendlyName',
      'client_phone_number.createdAt',
      'client_phone_number.updatedAt',
      'client.name as clientName',
      'client.color as clientColor',
    ])
    .orderBy('client_phone_number.createdAt', 'asc')
    .execute()
}

export const deleteByPhoneNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  const result = await db
    .deleteFrom('client_phone_number')
    .where('organizationId', '=', organizationId)
    .where('phoneNumber', '=', phoneNumber)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const deleteByClient = async (
  organizationId: string,
  clientId: string,
) => {
  const result = await db
    .deleteFrom('client_phone_number')
    .where('organizationId', '=', organizationId)
    .where('clientId', '=', clientId)
    .execute()
  return result
}

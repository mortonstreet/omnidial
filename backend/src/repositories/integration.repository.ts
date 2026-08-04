import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateIntegrationInput {
  organizationId: string
  provider: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: Date
  connectedById: string
  config?: object
}

export interface UpdateIntegrationInput {
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: Date
  config?: object
  lastSyncAt?: Date
}

export const findByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('integration')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .execute()
}

export const findByOrganizationAndProvider = async (
  organizationId: string,
  provider: string,
) => {
  return db
    .selectFrom('integration')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .selectAll()
    .executeTakeFirst()
}

export const create = async (data: CreateIntegrationInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('integration')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  organizationId: string,
  provider: string,
  data: UpdateIntegrationInput,
) => {
  const record = withTimestamps(data)
  return db
    .updateTable('integration')
    .set(record)
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .returningAll()
    .executeTakeFirst()
}

export const deleteByOrganizationAndProvider = async (
  organizationId: string,
  provider: string,
) => {
  return db
    .deleteFrom('integration')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', provider)
    .execute()
}

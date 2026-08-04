import { db } from '@/lib/db'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { sql } from 'kysely'

export interface CreateClientInput {
  organizationId: string
  name: string
  color?: string
}

export interface UpdateClientInput {
  name?: string
  color?: string
}

export const create = async (data: CreateClientInput) => {
  const client = await db
    .insertInto('client')
    .values(withId(withTimestamps(data, true)))
    .returningAll()
    .executeTakeFirstOrThrow()
  return client
}

export const findById = async (id: string, organizationId: string) => {
  const client = await db
    .selectFrom('client')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
  return client
}

export const findByOrganization = async (organizationId: string) => {
  const clients = await db
    .selectFrom('client')
    .leftJoin('campaign', 'campaign.clientId', 'client.id')
    .where('client.organizationId', '=', organizationId)
    .selectAll('client')
    .select((eb) => eb.fn.count('campaign.id').as('campaignCount'))
    .groupBy('client.id')
    .orderBy('client.name', 'asc')
    .execute()

  return clients.map((c) => ({
    ...c,
    campaignCount: Number(c.campaignCount ?? 0),
  }))
}

export const update = async (
  id: string,
  organizationId: string,
  data: UpdateClientInput,
) => {
  const client = await db
    .updateTable('client')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
  return client
}

export const remove = async (id: string, organizationId: string) => {
  const result = await db
    .deleteFrom('client')
    .where('id', '=', id)
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const getCampaignCount = async (id: string) => {
  const result = await db
    .selectFrom('campaign')
    .where('clientId', '=', id)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirst()
  return Number(result?.count ?? 0)
}

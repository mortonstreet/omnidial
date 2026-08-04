import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateEnrichEngineConnectionInput {
  organizationId: string
  apiKeyEncrypted: string
  createdById: string
  isActive?: boolean
}

export interface UpdateEnrichEngineConnectionInput {
  apiKeyEncrypted?: string
  isActive?: boolean
  lastSyncAt?: Date
}

/**
 * Find connection by organization ID
 */
export const findByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('enrichengine_connection')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Create a new EnrichEngine connection
 */
export const create = async (data: CreateEnrichEngineConnectionInput) => {
  const record = withId(
    withTimestamps(
      {
        ...data,
        isActive: data.isActive ?? true,
      },
      true,
    ),
  )

  return db
    .insertInto('enrichengine_connection')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Update an existing EnrichEngine connection
 */
export const update = async (
  organizationId: string,
  data: UpdateEnrichEngineConnectionInput,
) => {
  const record = withTimestamps(data)

  return db
    .updateTable('enrichengine_connection')
    .set(record)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirst()
}

/**
 * Delete an EnrichEngine connection by organization ID
 */
export const deleteByOrganizationId = async (organizationId: string) => {
  return db
    .deleteFrom('enrichengine_connection')
    .where('organizationId', '=', organizationId)
    .execute()
}

/**
 * Update last sync time
 */
export const updateLastSyncAt = async (organizationId: string) => {
  return update(organizationId, { lastSyncAt: new Date() })
}

/**
 * Activate/deactivate connection
 */
export const setActive = async (organizationId: string, isActive: boolean) => {
  return update(organizationId, { isActive })
}

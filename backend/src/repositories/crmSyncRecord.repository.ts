import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateCrmSyncRecordInput {
  organizationId: string
  leadId: string
  provider: string
  externalId: string
  externalUrl?: string
  syncDirection: string
  syncStatus: string
  lastSyncedAt: Date
  errorMessage?: string
}

export interface UpdateCrmSyncRecordInput {
  externalId?: string
  externalUrl?: string
  syncStatus?: string
  lastSyncedAt?: Date
  errorMessage?: string | null
}

export const findByOrgLeadProvider = async (
  organizationId: string,
  leadId: string,
  provider: string,
) => {
  return db
    .selectFrom('crm_sync_record' as any)
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .where('provider', '=', provider)
    .selectAll()
    .executeTakeFirst()
}

export const findByLead = async (leadId: string) => {
  return db
    .selectFrom('crm_sync_record' as any)
    .where('leadId', '=', leadId)
    .selectAll()
    .execute()
}

export const findByOrganization = async (organizationId: string) => {
  return db
    .selectFrom('crm_sync_record' as any)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .execute()
}

export const create = async (data: CreateCrmSyncRecordInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('crm_sync_record' as any)
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const upsert = async (data: CreateCrmSyncRecordInput) => {
  const existing = await findByOrgLeadProvider(
    data.organizationId,
    data.leadId,
    data.provider,
  )
  if (existing) {
    return update(data.organizationId, data.leadId, data.provider, {
      externalId: data.externalId,
      externalUrl: data.externalUrl,
      syncStatus: data.syncStatus,
      lastSyncedAt: data.lastSyncedAt,
      errorMessage: data.errorMessage,
    })
  }
  return create(data)
}

export const update = async (
  organizationId: string,
  leadId: string,
  provider: string,
  data: UpdateCrmSyncRecordInput,
) => {
  const record = withTimestamps(data)
  return db
    .updateTable('crm_sync_record' as any)
    .set(record)
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .where('provider', '=', provider)
    .returningAll()
    .executeTakeFirst()
}

import { db } from '@/lib/db'
import { withIdAndTimestamps, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateDispositionInput {
  twilioConfigId: string
  label: string
  color?: string
  sortOrder?: number
  isDefault?: boolean
}

export interface UpdateDispositionInput {
  label?: string
  color?: string
  sortOrder?: number
  isDefault?: boolean
}

export const findById = async (id: string) => {
  return db
    .selectFrom('disposition')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByIdForOrg = async (id: string, orgId: string) => {
  return db
    .selectFrom('disposition')
    .innerJoin(
      'twilio_config',
      'twilio_config.id',
      'disposition.twilioConfigId',
    )
    .where('disposition.id', '=', id)
    .where('twilio_config.organizationId', '=', orgId)
    .selectAll('disposition')
    .executeTakeFirst()
}

export const findByTwilioConfigId = async (
  twilioConfigId: string,
  pagination: DBPagination,
) => {
  const query = db
    .selectFrom('disposition')
    .where('twilioConfigId', '=', twilioConfigId)
    .selectAll()
    .orderBy('sortOrder', 'asc')

  const data = await withPagination(pagination, query).execute()

  const countResult = await db
    .selectFrom('disposition')
    .select(db.fn.count('id').as('count'))
    .where('twilioConfigId', '=', twilioConfigId)
    .executeTakeFirst()

  const total = Number(countResult?.count || 0)

  return { data, total }
}

export const findAllByTwilioConfigId = async (twilioConfigId: string) => {
  return db
    .selectFrom('disposition')
    .where('twilioConfigId', '=', twilioConfigId)
    .selectAll()
    .orderBy('sortOrder', 'asc')
    .execute()
}

export const create = async (data: CreateDispositionInput) => {
  const record = withIdAndTimestamps(
    {
      ...data,
      color: data.color || '#6B7280',
      sortOrder: data.sortOrder || 0,
      isDefault: data.isDefault || false,
    },
    true,
  )

  return db
    .insertInto('disposition')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (id: string, data: UpdateDispositionInput) => {
  const record = withTimestamps(data)

  return db
    .updateTable('disposition')
    .set(record)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const updateForOrg = async (
  id: string,
  orgId: string,
  data: UpdateDispositionInput,
) => {
  const disposition = await findByIdForOrg(id, orgId)
  if (!disposition) {
    return null
  }

  return update(id, data)
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('disposition').where('id', '=', id).executeTakeFirst()
}

export const deleteByIdForOrg = async (id: string, orgId: string) => {
  const disposition = await findByIdForOrg(id, orgId)
  if (!disposition) {
    return false
  }

  await deleteById(id)
  return true
}

export const createDefaultDispositions = async (twilioConfigId: string) => {
  const defaults = [
    { label: 'Connected', color: '#10B981', sortOrder: 1, isDefault: true },
    { label: 'Booked', color: '#8B5CF6', sortOrder: 2, isDefault: true },
    { label: 'Voicemail', color: '#F59E0B', sortOrder: 3, isDefault: true },
    {
      label: 'Not Interested',
      color: '#EF4444',
      sortOrder: 4,
      isDefault: true,
    },
    { label: 'Wrong Number', color: '#6B7280', sortOrder: 5, isDefault: true },
    {
      label: 'Callback Requested',
      color: '#3B82F6',
      sortOrder: 6,
      isDefault: true,
    },
  ]

  const records = defaults.map((d) =>
    withIdAndTimestamps({ ...d, twilioConfigId }, true),
  )

  return db.insertInto('disposition').values(records).returningAll().execute()
}

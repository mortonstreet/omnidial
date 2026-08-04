import { db } from '@/lib/db'
import { withIdAndTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateVoicemailDropInput {
  twilioConfigId: string
  userId: string
  name: string
  recordingUrl: string
  duration: number
}

export const findById = async (id: string) => {
  return db
    .selectFrom('voicemail_drop')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByIdForOrg = async (id: string, orgId: string) => {
  return db
    .selectFrom('voicemail_drop')
    .innerJoin(
      'twilio_config',
      'twilio_config.id',
      'voicemail_drop.twilioConfigId',
    )
    .where('voicemail_drop.id', '=', id)
    .where('twilio_config.organizationId', '=', orgId)
    .selectAll('voicemail_drop')
    .executeTakeFirst()
}

export const findByUserId = async (
  userId: string,
  twilioConfigId: string,
  pagination: DBPagination,
) => {
  const query = db
    .selectFrom('voicemail_drop')
    .where('userId', '=', userId)
    .where('twilioConfigId', '=', twilioConfigId)
    .selectAll()
    .orderBy('createdAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  const countResult = await db
    .selectFrom('voicemail_drop')
    .select(db.fn.count('id').as('count'))
    .where('userId', '=', userId)
    .where('twilioConfigId', '=', twilioConfigId)
    .executeTakeFirst()

  const total = Number(countResult?.count || 0)

  return { data, total }
}

export const findByTwilioConfigId = async (
  twilioConfigId: string,
  pagination: DBPagination,
) => {
  const query = db
    .selectFrom('voicemail_drop')
    .where('twilioConfigId', '=', twilioConfigId)
    .selectAll()
    .orderBy('createdAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  const countResult = await db
    .selectFrom('voicemail_drop')
    .select(db.fn.count('id').as('count'))
    .where('twilioConfigId', '=', twilioConfigId)
    .executeTakeFirst()

  const total = Number(countResult?.count || 0)

  return { data, total }
}

export const create = async (data: CreateVoicemailDropInput) => {
  const record = withIdAndTimestamps(data, true)

  return db
    .insertInto('voicemail_drop')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('voicemail_drop').where('id', '=', id).executeTakeFirst()
}

export const deleteByIdForOrg = async (id: string, orgId: string) => {
  const voicemailDrop = await findByIdForOrg(id, orgId)
  if (!voicemailDrop) {
    return false
  }

  await deleteById(id)
  return true
}

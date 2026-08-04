import { db } from '@/lib/db'
import { withIdAndTimestamps, withTimestamps } from './utils'

export interface CreateVoicemailGreetingInput {
  twilioConfigId: string
  name: string
  recordingUrl: string
  recordingSid?: string
  duration: number
}

export const findByTwilioConfigId = async (twilioConfigId: string) => {
  return db
    .selectFrom('voicemail_greeting')
    .where('twilioConfigId', '=', twilioConfigId)
    .selectAll()
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findActiveByTwilioConfigId = async (twilioConfigId: string) => {
  return db
    .selectFrom('voicemail_greeting')
    .where('twilioConfigId', '=', twilioConfigId)
    .where('isActive', '=', true)
    .selectAll()
    .executeTakeFirst()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('voicemail_greeting')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByIdForOrg = async (id: string, orgId: string) => {
  return db
    .selectFrom('voicemail_greeting')
    .innerJoin(
      'twilio_config',
      'twilio_config.id',
      'voicemail_greeting.twilioConfigId',
    )
    .where('voicemail_greeting.id', '=', id)
    .where('twilio_config.organizationId', '=', orgId)
    .selectAll('voicemail_greeting')
    .executeTakeFirst()
}

export const create = async (data: CreateVoicemailGreetingInput) => {
  const record = withIdAndTimestamps(data, true)

  return db
    .insertInto('voicemail_greeting')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const setActive = async (id: string, twilioConfigId: string) => {
  // Deactivate all greetings for this config
  await db
    .updateTable('voicemail_greeting')
    .set(withTimestamps({ isActive: false }))
    .where('twilioConfigId', '=', twilioConfigId)
    .execute()

  // Activate the selected one
  return db
    .updateTable('voicemail_greeting')
    .set(withTimestamps({ isActive: true }))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const setActiveForOrg = async (
  id: string,
  twilioConfigId: string,
  orgId: string,
) => {
  const greeting = await findByIdForOrg(id, orgId)
  if (!greeting || greeting.twilioConfigId !== twilioConfigId) {
    return null
  }

  return setActive(id, twilioConfigId)
}

export const deleteById = async (id: string) => {
  return db
    .deleteFrom('voicemail_greeting')
    .where('id', '=', id)
    .executeTakeFirst()
}

export const deleteByIdForOrg = async (id: string, orgId: string) => {
  const greeting = await findByIdForOrg(id, orgId)
  if (!greeting) {
    return false
  }

  await deleteById(id)
  return true
}

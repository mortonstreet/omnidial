import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateAgentSmsConfigInput {
  agentId: string
  twilioSubaccountSid?: string | null
  twilioAuthTokenEncrypted?: string | null
  twilioPhoneNumber?: string | null
  twilioPhoneNumberSid?: string | null
  twilioMessagingServiceSid?: string | null
  a2pBrandSid?: string | null
  a2pCampaignSid?: string | null
  a2pStatus?: string | null
  aiModel?: string
  aiSystemPrompt?: string | null
  aiMaxTokens?: number
  aiTemperature?: number
  isActive?: boolean
}

export interface UpdateAgentSmsConfigInput {
  twilioSubaccountSid?: string | null
  twilioAuthTokenEncrypted?: string | null
  twilioPhoneNumber?: string | null
  twilioPhoneNumberSid?: string | null
  twilioMessagingServiceSid?: string | null
  a2pBrandSid?: string | null
  a2pCampaignSid?: string | null
  a2pStatus?: string | null
  aiModel?: string
  aiSystemPrompt?: string | null
  aiMaxTokens?: number
  aiTemperature?: number
  isActive?: boolean
}

export const create = async (data: CreateAgentSmsConfigInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('agent_sms_config')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_sms_config')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByAgentId = async (agentId: string) => {
  return db
    .selectFrom('agent_sms_config')
    .selectAll()
    .where('agentId', '=', agentId)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateAgentSmsConfigInput) => {
  return db
    .updateTable('agent_sms_config')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const updateByAgentId = async (
  agentId: string,
  data: UpdateAgentSmsConfigInput,
) => {
  return db
    .updateTable('agent_sms_config')
    .set(withTimestamps(data))
    .where('agentId', '=', agentId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const upsertByAgentId = async (
  agentId: string,
  data: Omit<CreateAgentSmsConfigInput, 'agentId'>,
) => {
  const existing = await findByAgentId(agentId)
  if (existing) {
    return updateByAgentId(agentId, data)
  }
  return create({ ...data, agentId })
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent_sms_config').where('id', '=', id).execute()
}

export const deleteByAgentId = async (agentId: string) => {
  return db
    .deleteFrom('agent_sms_config')
    .where('agentId', '=', agentId)
    .execute()
}

export const setActive = async (agentId: string, isActive: boolean) => {
  return db
    .updateTable('agent_sms_config')
    .set({
      isActive,
      updatedAt: new Date(),
    })
    .where('agentId', '=', agentId)
    .execute()
}

export const updateA2pStatus = async (agentId: string, a2pStatus: string) => {
  return db
    .updateTable('agent_sms_config')
    .set({
      a2pStatus,
      updatedAt: new Date(),
    })
    .where('agentId', '=', agentId)
    .execute()
}

/**
 * Find SMS config by Twilio phone number (for inbound webhook lookup)
 */
export const findByPhoneNumber = async (phoneNumber: string) => {
  return db
    .selectFrom('agent_sms_config')
    .selectAll()
    .where('twilioPhoneNumber', '=', phoneNumber)
    .where('isActive', '=', true)
    .executeTakeFirst()
}

/**
 * Update autonomous mode settings
 */
export const updateAutonomousSettings = async (
  agentId: string,
  settings: { autonomousEnabled?: boolean; maxRepliesPerLead?: number },
) => {
  return db
    .updateTable('agent_sms_config')
    .set({
      ...settings,
      updatedAt: new Date(),
    })
    .where('agentId', '=', agentId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

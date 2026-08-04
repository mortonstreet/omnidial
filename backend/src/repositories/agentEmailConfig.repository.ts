import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateAgentEmailConfigInput {
  agentId: string
  provider: string
  agentmailApiKeyEncrypted?: string | null
  agentmailInboxId?: string | null
  accessTokenEncrypted?: string | null
  refreshTokenEncrypted?: string | null
  tokenExpiresAt?: Date | null
  fromEmail: string
  fromName?: string | null
  signatureHtml?: string | null
  isVerified?: boolean
}

export interface UpdateAgentEmailConfigInput {
  provider?: string
  agentmailApiKeyEncrypted?: string | null
  agentmailInboxId?: string | null
  accessTokenEncrypted?: string | null
  refreshTokenEncrypted?: string | null
  tokenExpiresAt?: Date | null
  fromEmail?: string
  fromName?: string | null
  signatureHtml?: string | null
  isVerified?: boolean
}

export const create = async (data: CreateAgentEmailConfigInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('agent_email_config')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_email_config')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByAgentId = async (agentId: string) => {
  return db
    .selectFrom('agent_email_config')
    .selectAll()
    .where('agentId', '=', agentId)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateAgentEmailConfigInput) => {
  return db
    .updateTable('agent_email_config')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const updateByAgentId = async (
  agentId: string,
  data: UpdateAgentEmailConfigInput,
) => {
  return db
    .updateTable('agent_email_config')
    .set(withTimestamps(data))
    .where('agentId', '=', agentId)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const upsertByAgentId = async (
  agentId: string,
  data: Omit<CreateAgentEmailConfigInput, 'agentId'>,
) => {
  const existing = await findByAgentId(agentId)
  if (existing) {
    return updateByAgentId(agentId, data)
  }
  return create({ ...data, agentId })
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent_email_config').where('id', '=', id).execute()
}

export const deleteByAgentId = async (agentId: string) => {
  return db
    .deleteFrom('agent_email_config')
    .where('agentId', '=', agentId)
    .execute()
}

export const setVerified = async (agentId: string, isVerified: boolean) => {
  return db
    .updateTable('agent_email_config')
    .set({
      isVerified,
      updatedAt: new Date(),
    })
    .where('agentId', '=', agentId)
    .execute()
}

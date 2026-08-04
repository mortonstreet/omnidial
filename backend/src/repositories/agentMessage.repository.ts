import { db } from '@/lib/db'
import { withId } from './utils'
import { DBPagination } from '@shared/db/src/types'
import { withPagination } from './utils'

export interface CreateAgentMessageInput {
  agentId: string
  workflowId?: string | null
  leadId: string
  campaignId?: string | null
  messageType: string
  status?: string
  emailSubject?: string | null
  emailBodyHtml?: string | null
  toEmail?: string | null
  smsBody?: string | null
  toPhone?: string | null
  twilioMessageSid?: string | null
  direction?: string
  fromPhone?: string | null
  replyToMessageId?: string | null
}

export interface UpdateAgentMessageInput {
  status?: string
  twilioMessageSid?: string | null
  deliveredAt?: Date | null
  openedAt?: Date | null
  clickedAt?: Date | null
  failureReason?: string | null
}

export const create = async (data: CreateAgentMessageInput) => {
  const record = { ...withId(data), createdAt: new Date() }
  return db
    .insertInto('agent_message')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_message')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByAgentId = async (
  agentId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('agent_message')
    .selectAll()
    .where('agentId', '=', agentId)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByLeadId = async (leadId: string) => {
  return db
    .selectFrom('agent_message')
    .selectAll()
    .where('leadId', '=', leadId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findByWorkflowId = async (
  workflowId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('agent_message')
    .selectAll()
    .where('workflowId', '=', workflowId)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByTwilioMessageSid = async (twilioMessageSid: string) => {
  return db
    .selectFrom('agent_message')
    .selectAll()
    .where('twilioMessageSid', '=', twilioMessageSid)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateAgentMessageInput) => {
  return db
    .updateTable('agent_message')
    .set(data)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const updateByTwilioMessageSid = async (
  twilioMessageSid: string,
  data: UpdateAgentMessageInput,
) => {
  return db
    .updateTable('agent_message')
    .set(data)
    .where('twilioMessageSid', '=', twilioMessageSid)
    .returningAll()
    .executeTakeFirst()
}

export const markDelivered = async (id: string) => {
  return db
    .updateTable('agent_message')
    .set({
      status: 'delivered',
      deliveredAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markOpened = async (id: string) => {
  return db
    .updateTable('agent_message')
    .set({
      status: 'opened',
      openedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markClicked = async (id: string) => {
  return db
    .updateTable('agent_message')
    .set({
      status: 'clicked',
      clickedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markFailed = async (id: string, failureReason: string) => {
  return db
    .updateTable('agent_message')
    .set({
      status: 'failed',
      failureReason,
    })
    .where('id', '=', id)
    .execute()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent_message').where('id', '=', id).execute()
}

export const countByAgentId = async (agentId: string) => {
  const result = await db
    .selectFrom('agent_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('agentId', '=', agentId)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countByAgentIdAndStatus = async (
  agentId: string,
  status: string,
) => {
  const result = await db
    .selectFrom('agent_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('agentId', '=', agentId)
    .where('status', '=', status)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countTodayByAgentIdAndType = async (
  agentId: string,
  messageType: string,
) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db
    .selectFrom('agent_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('agentId', '=', agentId)
    .where('messageType', '=', messageType)
    .where('createdAt', '>=', today)
    .executeTakeFirst()
  return result?.count ?? 0
}

/**
 * Create an inbound message (from external party to agent)
 */
export const createInbound = async (data: {
  agentId: string
  fromPhone: string
  toPhone: string
  smsBody: string
  twilioMessageSid?: string
  leadId?: string
}) => {
  const record = {
    ...withId({
      agentId: data.agentId,
      leadId: data.leadId || 'unknown',
      messageType: 'sms',
      status: 'received',
      smsBody: data.smsBody,
      toPhone: data.toPhone,
      fromPhone: data.fromPhone,
      twilioMessageSid: data.twilioMessageSid,
      direction: 'inbound',
    }),
    createdAt: new Date(),
  }
  return db
    .insertInto('agent_message')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

/**
 * Count today's outbound messages to a specific lead (for rate limiting)
 */
export const countTodayByLeadAndType = async (
  leadId: string,
  messageType: string,
  direction: string = 'outbound',
) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db
    .selectFrom('agent_message')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('leadId', '=', leadId)
    .where('messageType', '=', messageType)
    .where('direction', '=', direction)
    .where('createdAt', '>=', today)
    .executeTakeFirst()
  return result?.count ?? 0
}

/**
 * Get conversation history for a lead (both directions)
 */
export const findConversationByLeadId = async (leadId: string, limit = 50) => {
  return db
    .selectFrom('agent_message')
    .selectAll()
    .where('leadId', '=', leadId)
    .where('messageType', '=', 'sms')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()
}

/**
 * Find messages by phone number (for inbound lookups)
 */
export const findByFromPhone = async (
  agentId: string,
  fromPhone: string,
  limit = 20,
) => {
  return db
    .selectFrom('agent_message')
    .selectAll()
    .where('agentId', '=', agentId)
    .where('fromPhone', '=', fromPhone)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()
}

/**
 * Find the most recent outbound message to a phone number
 */
export const findLastOutboundToPhone = async (
  agentId: string,
  toPhone: string,
) => {
  return db
    .selectFrom('agent_message')
    .selectAll()
    .where('agentId', '=', agentId)
    .where('toPhone', '=', toPhone)
    .where('direction', '=', 'outbound')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .executeTakeFirst()
}

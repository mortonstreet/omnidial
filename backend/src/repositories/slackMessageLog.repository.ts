import { db } from '@/lib/db'
import { withId } from './utils'

export interface CreateSlackMessageLogInput {
  workspaceId: string
  channelId: string
  messageTs?: string | null
  eventType?: string | null
  payload?: Record<string, unknown> | null
  success?: boolean
  errorMessage?: string | null
}

export const create = async (data: CreateSlackMessageLogInput) => {
  const record = withId({
    ...data,
    payload: data.payload ? JSON.stringify(data.payload) : null,
    createdAt: new Date(),
  })
  return db
    .insertInto('slack_message_log')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('slack_message_log')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByWorkspaceId = async (workspaceId: string, limit = 50) => {
  return db
    .selectFrom('slack_message_log')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()
}

export const findRecentByWorkspaceAndChannel = async (
  workspaceId: string,
  channelId: string,
  limit = 20,
) => {
  return db
    .selectFrom('slack_message_log')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('channelId', '=', channelId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()
}

export const findRecentErrors = async (workspaceId: string, limit = 20) => {
  return db
    .selectFrom('slack_message_log')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('success', '=', false)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()
}

export const countRecentMessages = async (
  workspaceId: string,
  withinMinutes = 60,
) => {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000)
  const result = await db
    .selectFrom('slack_message_log')
    .select((eb) => eb.fn.countAll().as('count'))
    .where('workspaceId', '=', workspaceId)
    .where('createdAt', '>=', since)
    .executeTakeFirst()
  return Number(result?.count || 0)
}

export const deleteOlderThan = async (days: number) => {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return db
    .deleteFrom('slack_message_log')
    .where('createdAt', '<', cutoff)
    .execute()
}

export const deleteByWorkspaceId = async (workspaceId: string) => {
  return db
    .deleteFrom('slack_message_log')
    .where('workspaceId', '=', workspaceId)
    .execute()
}

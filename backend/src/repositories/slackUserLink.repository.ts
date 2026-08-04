import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateSlackUserLinkInput {
  workspaceId: string
  userId: string
  slackUserId: string
  slackEmail?: string | null
  slackDisplayName?: string | null
  slackRealName?: string | null
  slackTimezone?: string | null
  notificationsEnabled?: boolean
  dmChannelId?: string | null
}

export interface UpdateSlackUserLinkInput {
  slackEmail?: string | null
  slackDisplayName?: string | null
  slackRealName?: string | null
  slackTimezone?: string | null
  notificationsEnabled?: boolean
  dmChannelId?: string | null
}

export const create = async (data: CreateSlackUserLinkInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('slack_user_link')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('slack_user_link')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByUserId = async (userId: string) => {
  return db
    .selectFrom('slack_user_link')
    .selectAll()
    .where('userId', '=', userId)
    .execute()
}

export const findByWorkspaceAndUser = async (
  workspaceId: string,
  userId: string,
) => {
  return db
    .selectFrom('slack_user_link')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('userId', '=', userId)
    .executeTakeFirst()
}

export const findByWorkspaceAndSlackUser = async (
  workspaceId: string,
  slackUserId: string,
) => {
  return db
    .selectFrom('slack_user_link')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('slackUserId', '=', slackUserId)
    .executeTakeFirst()
}

export const findByWorkspaceId = async (workspaceId: string) => {
  return db
    .selectFrom('slack_user_link')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .execute()
}

export const findBySlackEmail = async (workspaceId: string, email: string) => {
  return db
    .selectFrom('slack_user_link')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('slackEmail', '=', email)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateSlackUserLinkInput) => {
  return db
    .updateTable('slack_user_link')
    .set(withTimestamps(data))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const upsert = async (data: CreateSlackUserLinkInput) => {
  // Try to find existing
  const existing = await findByWorkspaceAndUser(data.workspaceId, data.userId)
  if (existing) {
    return update(existing.id, {
      slackEmail: data.slackEmail,
      slackDisplayName: data.slackDisplayName,
      slackRealName: data.slackRealName,
      slackTimezone: data.slackTimezone,
      dmChannelId: data.dmChannelId,
    })
  }
  return create(data)
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('slack_user_link').where('id', '=', id).execute()
}

export const deleteByWorkspaceId = async (workspaceId: string) => {
  return db
    .deleteFrom('slack_user_link')
    .where('workspaceId', '=', workspaceId)
    .execute()
}

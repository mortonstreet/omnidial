import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export type SlackEventType =
  | 'inbound_call'
  | 'call_completed'
  | 'milestone_reached'
  | 'daily_summary'
  | 'weekly_summary'
  | 'lead_created'
  | 'deal_won'
  | 'deal_lost'
  | 'coaching_available'
  | 'rep_activity'
  | 'agent_approval'

export interface CreateSlackNotificationRuleInput {
  workspaceId: string
  channelId: string
  channelName?: string | null
  eventType: SlackEventType
  enabled?: boolean
  config?: Record<string, unknown>
  createdById?: string | null
}

export interface UpdateSlackNotificationRuleInput {
  channelName?: string | null
  enabled?: boolean
  config?: Record<string, unknown>
}

export const create = async (data: CreateSlackNotificationRuleInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('slack_notification_rule')
    .values({
      ...record,
      config: JSON.stringify(data.config || {}),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByWorkspaceId = async (workspaceId: string) => {
  return db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .execute()
}

export const findByWorkspaceAndEventType = async (
  workspaceId: string,
  eventType: SlackEventType,
) => {
  return db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('eventType', '=', eventType)
    .execute()
}

export const findEnabledByWorkspaceAndEventType = async (
  workspaceId: string,
  eventType: SlackEventType,
) => {
  return db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('eventType', '=', eventType)
    .where('enabled', '=', true)
    .execute()
}

export const findByWorkspaceAndChannel = async (
  workspaceId: string,
  channelId: string,
) => {
  return db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('workspaceId', '=', workspaceId)
    .where('channelId', '=', channelId)
    .execute()
}

export const findByEventType = async (eventType: SlackEventType) => {
  return db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('eventType', '=', eventType)
    .where('enabled', '=', true)
    .execute()
}

export const update = async (
  id: string,
  data: UpdateSlackNotificationRuleInput,
) => {
  const updateData: Record<string, unknown> = { ...withTimestamps(data) }
  if (data.config) {
    updateData.config = JSON.stringify(data.config)
  }
  return db
    .updateTable('slack_notification_rule')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const upsert = async (data: CreateSlackNotificationRuleInput) => {
  // Check for existing rule with same workspace, channel, and event type
  const existing = await db
    .selectFrom('slack_notification_rule')
    .selectAll()
    .where('workspaceId', '=', data.workspaceId)
    .where('channelId', '=', data.channelId)
    .where('eventType', '=', data.eventType)
    .executeTakeFirst()

  if (existing) {
    return update(existing.id, {
      channelName: data.channelName,
      enabled: data.enabled,
      config: data.config,
    })
  }
  return create(data)
}

export const enable = async (id: string) => {
  return db
    .updateTable('slack_notification_rule')
    .set({ enabled: true, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

export const disable = async (id: string) => {
  return db
    .updateTable('slack_notification_rule')
    .set({ enabled: false, updatedAt: new Date() })
    .where('id', '=', id)
    .execute()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('slack_notification_rule').where('id', '=', id).execute()
}

export const deleteByWorkspaceId = async (workspaceId: string) => {
  return db
    .deleteFrom('slack_notification_rule')
    .where('workspaceId', '=', workspaceId)
    .execute()
}

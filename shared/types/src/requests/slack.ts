import { z } from 'zod'

// Event types for notification rules
export const SlackEventTypeSchema = z.enum([
  'inbound_call',
  'call_completed',
  'milestone_reached',
  'daily_summary',
  'weekly_summary',
  'lead_created',
  'deal_won',
  'deal_lost',
  'coaching_available',
  'rep_activity',
])

export type SlackEventType = z.infer<typeof SlackEventTypeSchema>

// Workspace status response
export interface SlackStatusResponse {
  connected: boolean
  installUrl?: string
  workspace?: {
    id: string
    teamId: string
    teamName: string
    teamDomain: string | null
    defaultChannelId: string | null
    isActive: boolean
    lastActivityAt: Date | null
    connectedAt: Date
  }
  notificationRules?: Array<{
    id: string
    channelId: string
    channelName: string | null
    eventType: string
    enabled: boolean
  }>
  linkedUsers?: number
}

// Channels response
export interface SlackChannelsResponse {
  channels: Array<{
    id: string
    name: string
    isPrivate: boolean
  }>
}

// Update notification rules request
export const UpdateSlackNotificationRulesSchema = z.object({
  channelId: z.string().min(1),
  rules: z.array(
    z.object({
      eventType: SlackEventTypeSchema,
      enabled: z.boolean(),
    }),
  ),
})

export type UpdateSlackNotificationRulesRequest = z.infer<typeof UpdateSlackNotificationRulesSchema>

// Link user request
export const LinkSlackUserSchema = z.object({
  slackUserId: z.string().min(1),
})

export type LinkSlackUserRequest = z.infer<typeof LinkSlackUserSchema>

// Test notification request
export const TestSlackNotificationSchema = z.object({
  channelId: z.string().min(1),
  eventType: SlackEventTypeSchema.optional(),
})

export type TestSlackNotificationRequest = z.infer<typeof TestSlackNotificationSchema>

// Install URL response
export interface SlackInstallUrlResponse {
  url: string
}

// Generic success response
export interface SlackSuccessResponse {
  success: boolean
}

// Auto-link response
export interface SlackAutoLinkResponse {
  success: boolean
  linkedCount: number
}

// Notification rules response
export interface SlackNotificationRulesResponse {
  success: boolean
  rules: Array<{
    id: string
    channelId: string
    channelName: string | null
    eventType: string
    enabled: boolean
  }>
}

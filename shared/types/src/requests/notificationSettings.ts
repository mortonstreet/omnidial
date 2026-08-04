import { z } from 'zod'

// Sub-interfaces for notification settings
export interface RepSessionNotificationSettings {
  enabled: boolean
  notifyOnStart: boolean
  notifyOnStop: boolean
}

export interface DailyPerformanceSummarySettings {
  enabled: boolean
  sendTime: string // "17:00" (24hr format)
  timezone: string // "America/Los_Angeles"
  includeCoachingSummary: boolean
}

export interface RepReminderSettings {
  enabled: boolean
  sendTime: string // "09:00" (24hr format)
  timezone: string
  includeFollowUps: boolean
  includeCampaignSchedule: boolean
}

// Main notification settings interface
export interface NotificationSettings {
  repSessionNotifications: RepSessionNotificationSettings
  dailyPerformanceSummary: DailyPerformanceSummarySettings
  repReminders: RepReminderSettings
}

// Zod schemas for validation
export const RepSessionNotificationSettingsSchema = z.object({
  enabled: z.boolean(),
  notifyOnStart: z.boolean(),
  notifyOnStop: z.boolean(),
})

export const DailyPerformanceSummarySettingsSchema = z.object({
  enabled: z.boolean(),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  timezone: z.string(),
  includeCoachingSummary: z.boolean(),
})

export const RepReminderSettingsSchema = z.object({
  enabled: z.boolean(),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Invalid time format (HH:MM)'),
  timezone: z.string(),
  includeFollowUps: z.boolean(),
  includeCampaignSchedule: z.boolean(),
})

export const NotificationSettingsSchema = z.object({
  repSessionNotifications: RepSessionNotificationSettingsSchema,
  dailyPerformanceSummary: DailyPerformanceSummarySettingsSchema,
  repReminders: RepReminderSettingsSchema,
})

// Partial schema for updates (all fields optional)
export const UpdateNotificationSettingsSchema = z.object({
  repSessionNotifications: RepSessionNotificationSettingsSchema.partial().optional(),
  dailyPerformanceSummary: DailyPerformanceSummarySettingsSchema.partial().optional(),
  repReminders: RepReminderSettingsSchema.partial().optional(),
})

// Request/Response types
export type GetNotificationSettingsRequest = Record<string, never>
export type GetNotificationSettingsResponse = NotificationSettings

export type UpdateNotificationSettingsRequest = z.infer<typeof UpdateNotificationSettingsSchema>
export type UpdateNotificationSettingsResponse = NotificationSettings

export type TestDailySummaryRequest = Record<string, never>
export type TestDailySummaryResponse = { success: boolean; message: string }

export type TestRepReminderRequest = Record<string, never>
export type TestRepReminderResponse = { success: boolean; message: string }

// Default settings factory
export const getDefaultNotificationSettings = (): NotificationSettings => ({
  repSessionNotifications: {
    enabled: true,
    notifyOnStart: true,
    notifyOnStop: false,
  },
  dailyPerformanceSummary: {
    enabled: false,
    sendTime: '17:00',
    timezone: 'America/Los_Angeles',
    includeCoachingSummary: true,
  },
  repReminders: {
    enabled: false,
    sendTime: '09:00',
    timezone: 'America/Los_Angeles',
    includeFollowUps: true,
    includeCampaignSchedule: true,
  },
})

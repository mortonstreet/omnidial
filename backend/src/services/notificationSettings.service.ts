import { db } from '@/lib/db'
import logger from '@/lib/logger'
import {
  NotificationSettings,
  UpdateNotificationSettingsRequest,
  getDefaultNotificationSettings,
} from '@shared/types/src'

interface OrganizationMetadata {
  notificationSettings?: NotificationSettings
  [key: string]: unknown
}

/**
 * Parse organization metadata JSON string
 */
const parseMetadata = (metadataStr: string | null): OrganizationMetadata => {
  if (!metadataStr) {
    return {}
  }
  try {
    return JSON.parse(metadataStr) as OrganizationMetadata
  } catch (error) {
    logger.error({ error }, 'Failed to parse organization metadata')
    return {}
  }
}

/**
 * Serialize organization metadata to JSON string
 */
const serializeMetadata = (metadata: OrganizationMetadata): string => {
  return JSON.stringify(metadata)
}

/**
 * Get notification settings for an organization
 */
export const getNotificationSettings = async (
  organizationId: string,
): Promise<NotificationSettings> => {
  const org = await db
    .selectFrom('organization')
    .where('id', '=', organizationId)
    .select(['metadata'])
    .executeTakeFirst()

  if (!org) {
    throw new Error('Organization not found')
  }

  const metadata = parseMetadata(org.metadata)
  const defaults = getDefaultNotificationSettings()

  // Deep merge with defaults to handle partial settings
  return {
    repSessionNotifications: {
      ...defaults.repSessionNotifications,
      ...metadata.notificationSettings?.repSessionNotifications,
    },
    dailyPerformanceSummary: {
      ...defaults.dailyPerformanceSummary,
      ...metadata.notificationSettings?.dailyPerformanceSummary,
    },
    repReminders: {
      ...defaults.repReminders,
      ...metadata.notificationSettings?.repReminders,
    },
  }
}

/**
 * Update notification settings for an organization
 */
export const updateNotificationSettings = async (
  organizationId: string,
  updates: UpdateNotificationSettingsRequest,
): Promise<NotificationSettings> => {
  // Get current organization
  const org = await db
    .selectFrom('organization')
    .where('id', '=', organizationId)
    .select(['metadata'])
    .executeTakeFirst()

  if (!org) {
    throw new Error('Organization not found')
  }

  // Parse existing metadata
  const metadata = parseMetadata(org.metadata)
  const currentSettings = await getNotificationSettings(organizationId)

  // Merge updates with current settings
  const newSettings: NotificationSettings = {
    repSessionNotifications: {
      ...currentSettings.repSessionNotifications,
      ...updates.repSessionNotifications,
    },
    dailyPerformanceSummary: {
      ...currentSettings.dailyPerformanceSummary,
      ...updates.dailyPerformanceSummary,
    },
    repReminders: {
      ...currentSettings.repReminders,
      ...updates.repReminders,
    },
  }

  // Update metadata
  metadata.notificationSettings = newSettings

  // Save to database
  await db
    .updateTable('organization')
    .set({ metadata: serializeMetadata(metadata) })
    .where('id', '=', organizationId)
    .execute()

  logger.info(
    { organizationId, settings: newSettings },
    'Updated notification settings',
  )

  return newSettings
}

/**
 * Check if rep session notifications are enabled for an organization
 */
export const isRepSessionNotificationsEnabled = async (
  organizationId: string,
): Promise<{
  enabled: boolean
  notifyOnStart: boolean
  notifyOnStop: boolean
}> => {
  const settings = await getNotificationSettings(organizationId)
  return {
    enabled: settings.repSessionNotifications.enabled,
    notifyOnStart: settings.repSessionNotifications.notifyOnStart,
    notifyOnStop: settings.repSessionNotifications.notifyOnStop,
  }
}

/**
 * Check if daily performance summary is enabled for an organization
 */
export const isDailyPerformanceSummaryEnabled = async (
  organizationId: string,
): Promise<boolean> => {
  const settings = await getNotificationSettings(organizationId)
  return settings.dailyPerformanceSummary.enabled
}

/**
 * Check if rep reminders are enabled for an organization
 */
export const isRepRemindersEnabled = async (
  organizationId: string,
): Promise<boolean> => {
  const settings = await getNotificationSettings(organizationId)
  return settings.repReminders.enabled
}

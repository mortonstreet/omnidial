import { db } from '@/lib/db'
import * as emailClient from '@/clients/email.client'
import { config } from '@/config'
import logger from '@/lib/logger'
import * as notificationSettingsService from './notificationSettings.service'

// Cache to track recently notified sessions to avoid spam
// Key: `${organizationId}:${userId}`, Value: timestamp of last notification
const recentNotifications = new Map<string, number>()

// Minimum interval between notifications for the same user (15 minutes)
const NOTIFICATION_COOLDOWN_MS = 15 * 60 * 1000

/**
 * Get organization owners' emails
 */
const getOrganizationOwners = async (organizationId: string) => {
  const owners = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .where('member.organizationId', '=', organizationId)
    .where('member.role', '=', 'owner')
    .select([
      'user.id',
      'user.email',
      'user.name',
      'organization.name as organizationName',
    ])
    .execute()

  return owners
}

/**
 * Get user details
 */
const getUserDetails = async (userId: string) => {
  return db
    .selectFrom('user')
    .where('id', '=', userId)
    .select(['id', 'name', 'email'])
    .executeTakeFirst()
}

/**
 * Get campaign details
 */
const getCampaignDetails = async (campaignId: string) => {
  return db
    .selectFrom('campaign')
    .where('id', '=', campaignId)
    .select(['id', 'name'])
    .executeTakeFirst()
}

/**
 * Check if we should send a notification (respecting cooldown)
 */
const shouldNotify = (organizationId: string, userId: string): boolean => {
  const key = `${organizationId}:${userId}`
  const lastNotified = recentNotifications.get(key)

  if (!lastNotified) {
    return true
  }

  const elapsed = Date.now() - lastNotified
  return elapsed >= NOTIFICATION_COOLDOWN_MS
}

/**
 * Mark that we've sent a notification
 */
const markNotified = (organizationId: string, userId: string): void => {
  const key = `${organizationId}:${userId}`
  recentNotifications.set(key, Date.now())

  // Clean up old entries periodically
  if (recentNotifications.size > 1000) {
    const now = Date.now()
    for (const [k, v] of recentNotifications.entries()) {
      if (now - v > NOTIFICATION_COOLDOWN_MS * 2) {
        recentNotifications.delete(k)
      }
    }
  }
}

/**
 * Notify organization owners when a rep starts a calling session
 */
export const notifyOwnersOfCallingSession = async ({
  organizationId,
  userId,
  campaignId,
  dialerType,
}: {
  organizationId: string
  userId: string
  campaignId?: string
  dialerType: 'manual' | 'power' | 'parallel'
}): Promise<void> => {
  try {
    // Check notification settings
    const notificationSettings =
      await notificationSettingsService.isRepSessionNotificationsEnabled(
        organizationId,
      )

    if (!notificationSettings.enabled || !notificationSettings.notifyOnStart) {
      logger.debug('Rep session start notifications disabled', {
        organizationId,
        userId,
        dialerType,
      })
      return
    }

    // Check cooldown to avoid spamming
    if (!shouldNotify(organizationId, userId)) {
      logger.debug('Skipping calling notification due to cooldown', {
        organizationId,
        userId,
        dialerType,
      })
      return
    }

    // Get owners
    const owners = await getOrganizationOwners(organizationId)
    if (owners.length === 0) {
      logger.debug('No owners found for organization', { organizationId })
      return
    }

    // Get rep details
    const rep = await getUserDetails(userId)
    if (!rep) {
      logger.error('Rep not found for calling notification', { userId })
      return
    }

    // Don't notify if the rep is an owner
    const isRepOwner = owners.some((o) => o.id === userId)
    if (isRepOwner) {
      logger.debug('Skipping notification - rep is an owner', { userId })
      return
    }

    // Get campaign details if provided
    let campaignName: string | undefined
    if (campaignId) {
      const campaign = await getCampaignDetails(campaignId)
      campaignName = campaign?.name
    }

    // Get organization name from first owner
    const organizationName = owners[0].organizationName

    // Build dashboard URL
    const dashboardUrl = `${config.frontendUrl}/dashboard/sales-floor`

    // Mark as notified before sending (optimistic)
    markNotified(organizationId, userId)

    // Send emails to all owners in parallel
    const emailPromises = owners.map((owner) =>
      emailClient
        .sendCallingActivityNotification({
          ownerEmail: owner.email,
          ownerName: owner.name || 'there',
          repName: rep.name || rep.email,
          organizationName: organizationName || 'your organization',
          campaignName,
          dialerType,
          dashboardUrl,
        })
        .catch((error) => {
          logger.error('Failed to send calling notification email', {
            error,
            ownerEmail: owner.email,
            repName: rep.name,
          })
        }),
    )

    await Promise.all(emailPromises)

    logger.info('Sent calling session notifications to owners', {
      organizationId,
      repId: userId,
      repName: rep.name,
      dialerType,
      ownerCount: owners.length,
    })
  } catch (error) {
    logger.error('Failed to send calling session notifications', {
      error,
      organizationId,
      userId,
      dialerType,
    })
  }
}

/**
 * Format duration in seconds to human readable string
 */
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

/**
 * Notify organization owners when a rep ends a calling session
 */
export const notifyOwnersOfSessionEnd = async ({
  organizationId,
  userId,
  sessionDurationSeconds,
  totalCalls,
  connectedCalls,
}: {
  organizationId: string
  userId: string
  sessionDurationSeconds: number
  totalCalls: number
  connectedCalls: number
}): Promise<void> => {
  try {
    // Check notification settings
    const notificationSettings =
      await notificationSettingsService.isRepSessionNotificationsEnabled(
        organizationId,
      )

    if (!notificationSettings.enabled || !notificationSettings.notifyOnStop) {
      logger.debug('Rep session stop notifications disabled', {
        organizationId,
        userId,
      })
      return
    }

    // Get owners
    const owners = await getOrganizationOwners(organizationId)
    if (owners.length === 0) {
      logger.debug('No owners found for organization', { organizationId })
      return
    }

    // Get rep details
    const rep = await getUserDetails(userId)
    if (!rep) {
      logger.error('Rep not found for session end notification', { userId })
      return
    }

    // Don't notify if the rep is an owner
    const isRepOwner = owners.some((o) => o.id === userId)
    if (isRepOwner) {
      logger.debug('Skipping notification - rep is an owner', { userId })
      return
    }

    // Get organization name from first owner
    const organizationName = owners[0].organizationName

    // Build dashboard URL
    const dashboardUrl = `${config.frontendUrl}/dashboard/analytics`

    // Format duration
    const sessionDuration = formatDuration(sessionDurationSeconds)

    // Send emails to all owners in parallel
    const emailPromises = owners.map((owner) =>
      emailClient
        .sendCallingSessionEndNotification({
          ownerEmail: owner.email,
          ownerName: owner.name || 'there',
          repName: rep.name || rep.email,
          organizationName: organizationName || 'your organization',
          sessionDuration,
          totalCalls,
          connectedCalls,
          dashboardUrl,
        })
        .catch((error) => {
          logger.error('Failed to send session end notification email', {
            error,
            ownerEmail: owner.email,
            repName: rep.name,
          })
        }),
    )

    await Promise.all(emailPromises)

    logger.info('Sent session end notifications to owners', {
      organizationId,
      repId: userId,
      repName: rep.name,
      sessionDuration,
      totalCalls,
      connectedCalls,
      ownerCount: owners.length,
    })
  } catch (error) {
    logger.error('Failed to send session end notifications', {
      error,
      organizationId,
      userId,
    })
  }
}

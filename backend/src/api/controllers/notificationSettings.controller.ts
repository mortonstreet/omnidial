import { AuthRequestHandler, AuthRequest } from '@/types/handlers'
import { UpdateNotificationSettingsRequest } from '@shared/types/src'
import * as notificationSettingsService from '@/services/notificationSettings.service'
import * as scheduledNotificationService from '@/services/scheduledNotification.service'
import { doesMemberHaveRole } from '@/services/organization.service'
import {
  rescheduleNotificationJobs,
  triggerDailySummary,
  triggerRepReminder,
} from '@/queues/scheduled-notification.queue'

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

/**
 * Check if user is owner of their organization
 */
const checkOwnerAccess = async (
  userId: string,
  organizationId: string | null,
) => {
  if (!organizationId) {
    return false
  }
  return doesMemberHaveRole(userId, organizationId, ['owner'])
}

export const getNotificationSettingsController: AuthRequestHandler<
  Record<string, never>
> = async (req, res) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const isOwner = await checkOwnerAccess(req.user.id, organizationId)
  if (!isOwner) {
    return res.status(403).json({
      error: 'Only organization owners can access notification settings',
    })
  }

  const settings =
    await notificationSettingsService.getNotificationSettings(organizationId)

  return res.json(settings)
}

export const updateNotificationSettingsController: AuthRequestHandler<
  UpdateNotificationSettingsRequest
> = async (req, res) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const isOwner = await checkOwnerAccess(req.user.id, organizationId)
  if (!isOwner) {
    return res.status(403).json({
      error: 'Only organization owners can update notification settings',
    })
  }

  const updates = req.validated

  const settings = await notificationSettingsService.updateNotificationSettings(
    organizationId,
    updates,
  )

  // Reschedule jobs when settings change
  const repUserIds =
    await scheduledNotificationService.getOrganizationReps(organizationId)
  await rescheduleNotificationJobs(organizationId, repUserIds)

  return res.json(settings)
}

export const testDailySummaryController: AuthRequestHandler<
  Record<string, never>
> = async (req, res) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const isOwner = await checkOwnerAccess(req.user.id, organizationId)
  if (!isOwner) {
    return res
      .status(403)
      .json({ error: 'Only organization owners can test notification emails' })
  }

  try {
    await triggerDailySummary(organizationId)
    return res.json({
      success: true,
      message: 'Test daily summary email queued. Check your inbox.',
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
    })
  }
}

export const testRepReminderController: AuthRequestHandler<
  Record<string, never>
> = async (req, res) => {
  const organizationId = getOrgId(req)
  const userId = req.user.id

  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const isOwner = await checkOwnerAccess(req.user.id, organizationId)
  if (!isOwner) {
    return res
      .status(403)
      .json({ error: 'Only organization owners can test notification emails' })
  }

  try {
    await triggerRepReminder(organizationId, userId)
    return res.json({
      success: true,
      message: 'Test rep reminder email queued. Check your inbox.',
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to send test email',
    })
  }
}

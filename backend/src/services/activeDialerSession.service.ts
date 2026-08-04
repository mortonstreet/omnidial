import * as activeDialerSessionRepository from '@/repositories/activeDialerSession.repository'
import * as dialerService from '@/services/dialer.service'
import * as userRepository from '@/repositories/user.repository'
import * as organizationRepository from '@/repositories/organization.repository'
import { sendEmail } from '@/clients/email.client'

// === Active Dialer Sessions ===

export const startSession = async (
  organizationId: string,
  userId: string,
  campaignId?: string,
  listId?: string,
) => {
  // Get twilio config for org (auto-provisions for superadmin)
  const twilioConfig = await dialerService.resolveOrgTwilioConfig(
    organizationId,
    userId,
  )
  if (!twilioConfig) {
    throw new Error('Twilio configuration not found')
  }

  // End any existing active sessions for this user
  await activeDialerSessionRepository.endAllUserSessions(userId)

  // Create new session
  const session = await activeDialerSessionRepository.create({
    organizationId,
    userId,
    twilioConfigId: twilioConfig.id,
    campaignId,
    listId,
  })

  // Send email notification to managers/admins
  try {
    await notifyManagersOfNewSession(organizationId, userId)
  } catch (error) {
    console.error('Failed to send manager notifications:', error)
    // Don't fail the session start if notification fails
  }

  return session
}

export const endSession = async (sessionId: string) => {
  return activeDialerSessionRepository.endSession(sessionId)
}

export const endUserSessions = async (userId: string) => {
  return activeDialerSessionRepository.endAllUserSessions(userId)
}

export const getActiveSession = async (userId: string) => {
  return activeDialerSessionRepository.findActiveByUserId(userId)
}

export const getActiveSessions = async (organizationId: string) => {
  return activeDialerSessionRepository.findActiveByOrganization(organizationId)
}

export const updateSessionCall = async (sessionId: string, callId: string) => {
  return activeDialerSessionRepository.update(sessionId, {
    currentCallId: callId,
  })
}

// === Manager Notifications ===

const notifyManagersOfNewSession = async (
  organizationId: string,
  repUserId: string,
) => {
  // Get the rep user info
  const repUser = await userRepository.findById(repUserId)
  if (!repUser) return

  // Get all admins and owners in the organization
  const members =
    await organizationRepository.findMembersByOrganizationId(organizationId)
  const managerMembers = members.filter(
    (m) => (m.role === 'admin' || m.role === 'owner') && m.userId !== repUserId,
  )

  if (managerMembers.length === 0) return

  // Get user details for managers
  const managerUserIds = managerMembers.map((m) => m.userId)
  const managers = await userRepository.findByIds(managerUserIds)

  const APP_URL = process.env.APP_URL || 'http://localhost:3000'

  // Send email to each manager
  for (const manager of managers) {
    if (!manager?.email) continue

    try {
      await sendEmail(
        manager.email,
        `${repUser.name || repUser.email} started a power dialer session`,
        `${repUser.name || repUser.email} has started a power dialer session. You can listen in on their calls from the Live Monitor panel: ${APP_URL}/dashboard/dialer?tab=live-monitor`,
      )
    } catch (error) {
      console.error(`Failed to send notification to ${manager.email}:`, error)
    }
  }
}

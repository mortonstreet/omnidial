import { db } from '@/lib/db'
import { sql } from 'kysely'
import logger from '@/lib/logger'
import { config } from '@/config'
import * as emailClient from '@/clients/email.client'
import * as notificationSettingsService from './notificationSettings.service'

/**
 * Get organization owners with their details
 */
const getOrganizationOwners = async (organizationId: string) => {
  return db
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
 * Get rep performance data for a specific date
 */
export const getRepPerformanceData = async (
  organizationId: string,
  date: Date,
): Promise<emailClient.RepPerformanceData[]> => {
  // Get the organization's twilio config
  const twilioConfig = await db
    .selectFrom('twilio_config')
    .where('organizationId', '=', organizationId)
    .select(['id'])
    .executeTakeFirst()

  if (!twilioConfig) {
    return []
  }

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  // Get call stats grouped by user
  const repStats = await db
    .selectFrom('call')
    .innerJoin('user', 'user.id', 'call.userId')
    .where('call.twilioConfigId', '=', twilioConfig.id)
    .where('call.startedAt', '>=', startOfDay)
    .where('call.startedAt', '<=', endOfDay)
    .groupBy(['call.userId', 'user.name', 'user.email'])
    .select([
      'call.userId',
      'user.name',
      'user.email',
      db.fn.count('call.id').as('totalCalls'),
      sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed' AND call.duration > 0)`.as(
        'connectedCalls',
      ),
      sql<number>`COALESCE(SUM(call.duration), 0)`.as('totalTalkTimeSeconds'),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)), 0)`.as(
        'avgCallDurationSeconds',
      ),
    ])
    .execute()

  return repStats.map((rep) => {
    const totalCalls = Number(rep.totalCalls || 0)
    const connectedCalls = Number(rep.connectedCalls || 0)

    return {
      repName: rep.name || rep.email,
      totalCalls,
      connectedCalls,
      connectionRate:
        totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      totalTalkTimeMinutes: Math.round(
        Number(rep.totalTalkTimeSeconds || 0) / 60,
      ),
      avgCallDurationSeconds: Math.round(
        Number(rep.avgCallDurationSeconds || 0),
      ),
    }
  })
}

/**
 * Get coaching summary data for a specific date
 */
export const getCoachingSummaryData = async (
  organizationId: string,
  date: Date,
): Promise<emailClient.CoachingSummaryData | undefined> => {
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)

  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  // Get coaching sessions from today
  const coachingStats = await db
    .selectFrom('call_coaching')
    .innerJoin('call', 'call.id', 'call_coaching.callId')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('twilio_config.organizationId', '=', organizationId)
    .where('call_coaching.createdAt', '>=', startOfDay)
    .where('call_coaching.createdAt', '<=', endOfDay)
    .select([
      sql<number>`AVG(call_coaching.score)`.as('avgScore'),
      db.fn.count('call_coaching.id').as('totalSessions'),
    ])
    .executeTakeFirst()

  if (!coachingStats || Number(coachingStats.totalSessions) === 0) {
    return undefined
  }

  return {
    avgScore: Math.round(Number(coachingStats.avgScore || 0)),
    totalSessions: Number(coachingStats.totalSessions || 0),
  }
}

/**
 * Get follow-up leads for a rep (tasks due today)
 */
export const getRepFollowUps = async (
  userId: string,
  organizationId: string,
): Promise<emailClient.FollowUpLead[]> => {
  const today = new Date()
  today.setHours(23, 59, 59, 999)

  const tasks = await db
    .selectFrom('task')
    .leftJoin('lead', 'lead.id', 'task.leadId')
    .where('task.userId', '=', userId)
    .where('task.organizationId', '=', organizationId)
    .where('task.completedAt', 'is', null)
    .where('task.dueAt', '<=', today)
    .select([
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'task.createdAt',
    ])
    .orderBy('task.dueAt', 'asc')
    .limit(20)
    .execute()

  return tasks.map((task) => ({
    name:
      task.firstName || task.lastName
        ? `${task.firstName || ''} ${task.lastName || ''}`.trim()
        : 'Unknown',
    company: task.company || undefined,
    lastContact: task.createdAt
      ? new Date(task.createdAt).toLocaleDateString()
      : undefined,
  }))
}

/**
 * Get campaign schedule for a rep (assigned leads by campaign)
 */
export const getRepCampaignSchedule = async (
  userId: string,
  organizationId: string,
): Promise<emailClient.CampaignScheduleItem[]> => {
  // Get campaigns the user has assigned leads in
  const campaignStats = await db
    .selectFrom('campaign_lead')
    .innerJoin('campaign', 'campaign.id', 'campaign_lead.campaignId')
    .where('campaign.organizationId', '=', organizationId)
    .where('campaign_lead.assignedUserId', '=', userId)
    .where('campaign_lead.status', '=', 'pending')
    .groupBy(['campaign.id', 'campaign.name'])
    .select([
      'campaign.name as campaignName',
      db.fn.count('campaign_lead.id').as('leadCount'),
    ])
    .execute()

  return campaignStats.map((campaign) => ({
    campaignName: campaign.campaignName,
    leadCount: Number(campaign.leadCount || 0),
  }))
}

/**
 * Send daily performance summary to organization owners
 */
export const sendDailyPerformanceSummary = async (
  organizationId: string,
): Promise<void> => {
  const settings =
    await notificationSettingsService.getNotificationSettings(organizationId)

  if (!settings.dailyPerformanceSummary.enabled) {
    logger.debug(
      { organizationId },
      'Daily performance summary disabled, skipping',
    )
    return
  }

  const owners = await getOrganizationOwners(organizationId)
  if (owners.length === 0) {
    logger.debug({ organizationId }, 'No owners found for organization')
    return
  }

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  const repPerformance = await getRepPerformanceData(organizationId, yesterday)

  if (repPerformance.length === 0) {
    logger.debug({ organizationId }, 'No rep activity found for yesterday')
    return
  }

  let coachingSummary: emailClient.CoachingSummaryData | undefined
  if (settings.dailyPerformanceSummary.includeCoachingSummary) {
    coachingSummary = await getCoachingSummaryData(organizationId, yesterday)
  }

  const organizationName = owners[0].organizationName || 'your organization'
  const dateStr = yesterday.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const analyticsUrl = `${config.frontendUrl}/dashboard/analytics`

  // Send to all owners
  const emailPromises = owners.map((owner) =>
    emailClient
      .sendDailyPerformanceSummaryEmail({
        ownerEmail: owner.email,
        ownerName: owner.name || 'there',
        organizationName,
        date: dateStr,
        repPerformance,
        coachingSummary,
        analyticsUrl,
      })
      .catch((error) => {
        logger.error(
          { error, ownerEmail: owner.email },
          'Failed to send daily performance summary email',
        )
      }),
  )

  await Promise.all(emailPromises)

  logger.info(
    {
      organizationId,
      ownerCount: owners.length,
      repCount: repPerformance.length,
    },
    'Sent daily performance summary to owners',
  )
}

/**
 * Send daily reminders to a specific rep
 */
export const sendRepReminders = async (
  userId: string,
  organizationId: string,
): Promise<void> => {
  const settings =
    await notificationSettingsService.getNotificationSettings(organizationId)

  if (!settings.repReminders.enabled) {
    logger.debug({ organizationId, userId }, 'Rep reminders disabled, skipping')
    return
  }

  const user = await getUserDetails(userId)
  if (!user) {
    logger.error({ userId }, 'User not found for rep reminders')
    return
  }

  const org = await db
    .selectFrom('organization')
    .where('id', '=', organizationId)
    .select(['name'])
    .executeTakeFirst()

  const followUps = settings.repReminders.includeFollowUps
    ? await getRepFollowUps(userId, organizationId)
    : []

  const campaignSchedule = settings.repReminders.includeCampaignSchedule
    ? await getRepCampaignSchedule(userId, organizationId)
    : []

  // Only send if there's something to report
  if (followUps.length === 0 && campaignSchedule.length === 0) {
    logger.debug(
      { organizationId, userId },
      'No follow-ups or campaigns for rep, skipping reminder',
    )
    return
  }

  const dialerUrl = `${config.frontendUrl}/dashboard/dialer`

  await emailClient.sendRepDailyRemindersEmail({
    repEmail: user.email,
    repName: user.name || 'there',
    organizationName: org?.name || 'your organization',
    followUps,
    campaignSchedule,
    dialerUrl,
  })

  logger.info(
    {
      organizationId,
      userId,
      followUpCount: followUps.length,
      campaignCount: campaignSchedule.length,
    },
    'Sent daily reminders to rep',
  )
}

/**
 * Get all reps (non-owner members) in an organization
 */
export const getOrganizationReps = async (
  organizationId: string,
): Promise<string[]> => {
  const members = await db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('role', '!=', 'owner')
    .select(['userId'])
    .execute()

  return members.map((m) => m.userId)
}

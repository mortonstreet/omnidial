import { Queue } from 'bullmq'
import {
  ScheduledNotificationEvent,
  ScheduledNotificationEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import logger from '@/lib/logger'
import { getNotificationSettings } from '@/services/notificationSettings.service'

export const scheduledNotificationQueue = new Queue<ScheduledNotificationEvent>(
  QueueName.SCHEDULED_NOTIFICATIONS,
  {
    connection: {
      url: config.redis.url,
      ...(config.redis.useTLS && {
        tls: {
          rejectUnauthorized: false,
        },
      }),
    },
  },
)

/**
 * Convert time string (HH:MM) and timezone to a cron expression
 * Returns cron in format: minute hour * * *
 */
const timeToCron = (time: string): string => {
  const [hours, minutes] = time.split(':')
  return `${minutes} ${hours} * * *`
}

/**
 * Schedule daily performance summary job for an organization
 */
export const scheduleDailyPerformanceSummary = async (
  organizationId: string,
): Promise<void> => {
  const settings = await getNotificationSettings(organizationId)

  if (!settings.dailyPerformanceSummary.enabled) {
    logger.debug(
      { organizationId },
      'Daily performance summary disabled, skipping schedule',
    )
    return
  }

  const jobKey = `daily-summary-${organizationId}`
  const cron = timeToCron(settings.dailyPerformanceSummary.sendTime)

  // Remove existing job if any
  const existingSchedulers = await scheduledNotificationQueue.getJobSchedulers()
  for (const scheduler of existingSchedulers) {
    if (scheduler.key.startsWith(jobKey)) {
      await scheduledNotificationQueue.removeJobScheduler(scheduler.key)
    }
  }

  // Add new repeatable job
  await scheduledNotificationQueue.add(
    ScheduledNotificationEventType.DAILY_PERFORMANCE_SUMMARY,
    {
      type: ScheduledNotificationEventType.DAILY_PERFORMANCE_SUMMARY,
      organizationId,
    },
    {
      repeat: {
        pattern: cron,
        tz: settings.dailyPerformanceSummary.timezone,
      },
      jobId: jobKey,
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  )

  logger.info(
    {
      organizationId,
      cron,
      timezone: settings.dailyPerformanceSummary.timezone,
    },
    'Scheduled daily performance summary',
  )
}

/**
 * Schedule rep reminder jobs for all reps in an organization
 */
export const scheduleRepReminders = async (
  organizationId: string,
  repUserIds: string[],
): Promise<void> => {
  const settings = await getNotificationSettings(organizationId)

  if (!settings.repReminders.enabled) {
    logger.debug(
      { organizationId },
      'Rep reminders disabled, skipping schedule',
    )
    return
  }

  const cron = timeToCron(settings.repReminders.sendTime)

  // Remove existing rep reminder jobs for this org
  const existingSchedulers = await scheduledNotificationQueue.getJobSchedulers()
  for (const scheduler of existingSchedulers) {
    if (scheduler.key.startsWith(`rep-reminder-${organizationId}`)) {
      await scheduledNotificationQueue.removeJobScheduler(scheduler.key)
    }
  }

  // Add a job for each rep
  for (const userId of repUserIds) {
    const jobKey = `rep-reminder-${organizationId}-${userId}`

    await scheduledNotificationQueue.add(
      ScheduledNotificationEventType.REP_REMINDERS,
      {
        type: ScheduledNotificationEventType.REP_REMINDERS,
        organizationId,
        userId,
      },
      {
        repeat: {
          pattern: cron,
          tz: settings.repReminders.timezone,
        },
        jobId: jobKey,
        removeOnComplete: 10,
        removeOnFail: 5,
      },
    )
  }

  logger.info(
    {
      organizationId,
      repCount: repUserIds.length,
      cron,
      timezone: settings.repReminders.timezone,
    },
    'Scheduled rep reminders',
  )
}

/**
 * Cancel all scheduled jobs for an organization
 */
export const cancelScheduledJobs = async (
  organizationId: string,
): Promise<void> => {
  const existingSchedulers = await scheduledNotificationQueue.getJobSchedulers()

  for (const scheduler of existingSchedulers) {
    if (
      scheduler.key.includes(organizationId) ||
      scheduler.key.startsWith(`daily-summary-${organizationId}`) ||
      scheduler.key.startsWith(`rep-reminder-${organizationId}`)
    ) {
      await scheduledNotificationQueue.removeJobScheduler(scheduler.key)
    }
  }

  logger.info({ organizationId }, 'Cancelled scheduled notification jobs')
}

/**
 * Reschedule all notification jobs when settings change
 */
export const rescheduleNotificationJobs = async (
  organizationId: string,
  repUserIds: string[],
): Promise<void> => {
  // Cancel existing jobs
  await cancelScheduledJobs(organizationId)

  // Reschedule based on current settings
  await scheduleDailyPerformanceSummary(organizationId)
  await scheduleRepReminders(organizationId, repUserIds)
}

/**
 * Manually trigger a daily summary (for testing)
 */
export const triggerDailySummary = async (
  organizationId: string,
): Promise<void> => {
  await scheduledNotificationQueue.add(
    ScheduledNotificationEventType.DAILY_PERFORMANCE_SUMMARY,
    {
      type: ScheduledNotificationEventType.DAILY_PERFORMANCE_SUMMARY,
      organizationId,
    },
    {
      removeOnComplete: true,
      removeOnFail: true,
    },
  )

  logger.info({ organizationId }, 'Triggered manual daily summary')
}

/**
 * Manually trigger a rep reminder (for testing)
 */
export const triggerRepReminder = async (
  organizationId: string,
  userId: string,
): Promise<void> => {
  await scheduledNotificationQueue.add(
    ScheduledNotificationEventType.REP_REMINDERS,
    {
      type: ScheduledNotificationEventType.REP_REMINDERS,
      organizationId,
      userId,
    },
    {
      removeOnComplete: true,
      removeOnFail: true,
    },
  )

  logger.info({ organizationId, userId }, 'Triggered manual rep reminder')
}

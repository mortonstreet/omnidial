import { Worker, Job } from 'bullmq'
import {
  ScheduledNotificationEvent,
  ScheduledNotificationEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as scheduledNotificationService from '@/services/scheduledNotification.service'

async function processDailyPerformanceSummary(
  job: Job<ScheduledNotificationEvent>,
) {
  const { organizationId } = job.data

  logger.info({ organizationId }, 'Processing daily performance summary')

  await scheduledNotificationService.sendDailyPerformanceSummary(organizationId)

  logger.info({ organizationId }, 'Daily performance summary sent')

  return { success: true, organizationId }
}

async function processRepReminders(job: Job<ScheduledNotificationEvent>) {
  const { organizationId, userId } = job.data

  if (!userId) {
    throw new Error('userId is required for rep reminders')
  }

  logger.info({ organizationId, userId }, 'Processing rep reminders')

  await scheduledNotificationService.sendRepReminders(userId, organizationId)

  logger.info({ organizationId, userId }, 'Rep reminders sent')

  return { success: true, organizationId, userId }
}

export class ScheduledNotificationProcessor {
  private worker: Worker<ScheduledNotificationEvent>

  constructor() {
    this.worker = new Worker<ScheduledNotificationEvent>(
      QueueName.SCHEDULED_NOTIFICATIONS,
      async (job) => {
        setRequestContext('jobId', job.id)
        try {
          return await Sentry.withScope(async (scope) => {
            scope.setContext('job', {
              id: job.id,
              name: job.name,
              data: job.data,
            })

            switch (job.data.type) {
              case ScheduledNotificationEventType.DAILY_PERFORMANCE_SUMMARY:
                return await processDailyPerformanceSummary(job)
              case ScheduledNotificationEventType.REP_REMINDERS:
                return await processRepReminders(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            {
              error,
              jobId: job.id,
              organizationId: job.data.organizationId,
              type: job.data.type,
            },
            'Failed to process scheduled notification',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              organizationId: job.data.organizationId,
              type: job.data.type,
            },
          })
          throw error
        }
      },
      {
        connection: {
          url: config.redis.url,
          ...(config.redis.useTLS && {
            tls: {
              rejectUnauthorized: false,
            },
          }),
        },
        concurrency: 5, // Process 5 notifications at a time
      },
    )
  }

  async close() {
    await this.worker.close()
  }
}

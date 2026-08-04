import { Queue } from 'bullmq'
import {
  SmsCampaignEvent,
  SmsCampaignEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import logger from '@/lib/logger'

export const smsCampaignQueue = new Queue<SmsCampaignEvent>(
  QueueName.SMS_CAMPAIGN,
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
 * Schedule the recurring SMS campaign processor
 * Runs every minute to process ready enrollments
 */
export const scheduleSmsCampaignProcessor = async (): Promise<void> => {
  const jobKey = 'sms-campaign-processor'

  // Remove existing scheduler if any
  const existingSchedulers = await smsCampaignQueue.getJobSchedulers()
  for (const scheduler of existingSchedulers) {
    if (scheduler.key.startsWith(jobKey)) {
      await smsCampaignQueue.removeJobScheduler(scheduler.key)
    }
  }

  // Add new repeatable job - runs every minute
  await smsCampaignQueue.add(
    SmsCampaignEventType.PROCESS_READY,
    {
      type: SmsCampaignEventType.PROCESS_READY,
      limit: 100, // Process up to 100 enrollments per run
    },
    {
      repeat: {
        pattern: '* * * * *', // Every minute
      },
      jobId: jobKey,
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  )

  logger.info('Scheduled SMS campaign processor (every minute)')
}

/**
 * Manually trigger the SMS campaign processor (for testing)
 */
export const triggerSmsCampaignProcessor = async (
  limit: number = 100,
): Promise<void> => {
  await smsCampaignQueue.add(
    SmsCampaignEventType.PROCESS_READY,
    {
      type: SmsCampaignEventType.PROCESS_READY,
      limit,
    },
    {
      removeOnComplete: true,
      removeOnFail: true,
    },
  )

  logger.info({ limit }, 'Triggered manual SMS campaign processing')
}

/**
 * Queue a specific enrollment for processing
 */
export const queueEnrollmentProcessing = async (
  enrollmentId: string,
): Promise<void> => {
  await smsCampaignQueue.add(
    SmsCampaignEventType.PROCESS_ENROLLMENT,
    {
      type: SmsCampaignEventType.PROCESS_ENROLLMENT,
      enrollmentId,
    },
    {
      removeOnComplete: true,
      removeOnFail: 5,
    },
  )
}

/**
 * Queue an inbound reply for processing
 */
export const queueInboundReply = async (
  fromPhone: string,
  organizationId: string,
): Promise<void> => {
  await smsCampaignQueue.add(
    SmsCampaignEventType.HANDLE_REPLY,
    {
      type: SmsCampaignEventType.HANDLE_REPLY,
      fromPhone,
      organizationId,
    },
    {
      removeOnComplete: true,
      removeOnFail: 5,
    },
  )
}

/**
 * Queue an unsubscribe request for processing
 */
export const queueUnsubscribe = async (
  fromPhone: string,
  organizationId: string,
): Promise<void> => {
  await smsCampaignQueue.add(
    SmsCampaignEventType.HANDLE_UNSUBSCRIBE,
    {
      type: SmsCampaignEventType.HANDLE_UNSUBSCRIBE,
      fromPhone,
      organizationId,
    },
    {
      removeOnComplete: true,
      removeOnFail: 5,
    },
  )
}

/**
 * Queue a Twilio delivery status update for processing
 */
export const queueDeliveryStatus = async (
  messageSid: string,
  status: string,
  errorCode?: string,
): Promise<void> => {
  await smsCampaignQueue.add(
    SmsCampaignEventType.HANDLE_DELIVERY_STATUS,
    {
      type: SmsCampaignEventType.HANDLE_DELIVERY_STATUS,
      messageSid,
      status,
      errorCode,
    },
    {
      removeOnComplete: true,
      removeOnFail: 5,
    },
  )
}

/**
 * Cancel the SMS campaign processor scheduler
 */
export const cancelSmsCampaignProcessor = async (): Promise<void> => {
  const existingSchedulers = await smsCampaignQueue.getJobSchedulers()

  for (const scheduler of existingSchedulers) {
    if (scheduler.key.startsWith('sms-campaign-processor')) {
      await smsCampaignQueue.removeJobScheduler(scheduler.key)
    }
  }

  logger.info('Cancelled SMS campaign processor')
}

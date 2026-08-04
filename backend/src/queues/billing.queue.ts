import { Queue } from 'bullmq'
import { BillingQueueEvent, BillingEventType, QueueName } from '@/types/queues'
import { config } from '@/config'
import logger from '@/lib/logger'

export const billingQueue = new Queue<BillingQueueEvent>(QueueName.BILLING, {
  connection: {
    url: config.redis.url,
    ...(config.redis.useTLS && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  },
})

/**
 * Schedule all billing recurring jobs.
 */
export const scheduleBillingJobs = async (): Promise<void> => {
  // Remove existing schedulers
  const existingSchedulers = await billingQueue.getJobSchedulers()
  for (const scheduler of existingSchedulers) {
    await billingQueue.removeJobScheduler(scheduler.key)
  }

  // Cycle rotation: daily at 00:05 UTC
  await billingQueue.add(
    BillingEventType.CYCLE_ROTATION,
    { type: BillingEventType.CYCLE_ROTATION },
    {
      repeat: {
        pattern: '5 0 * * *', // 00:05 UTC daily
      },
      jobId: 'billing-cycle-rotation',
      removeOnComplete: 10,
      removeOnFail: 5,
    },
  )

  // Redis sync: every 5 minutes
  await billingQueue.add(
    BillingEventType.REDIS_SYNC,
    { type: BillingEventType.REDIS_SYNC },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'billing-redis-sync',
      removeOnComplete: 5,
      removeOnFail: 3,
    },
  )

  // Overage reporting: every 5 minutes
  await billingQueue.add(
    BillingEventType.REPORT_OVERAGE,
    { type: BillingEventType.REPORT_OVERAGE },
    {
      repeat: {
        pattern: '*/5 * * * *', // Every 5 minutes
      },
      jobId: 'billing-report-overage',
      removeOnComplete: 5,
      removeOnFail: 3,
    },
  )

  logger.info(
    'Scheduled billing jobs (cycle rotation, Redis sync, overage reporting)',
  )
}

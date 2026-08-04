import { Worker, Job } from 'bullmq'
import {
  SmsCampaignEvent,
  SmsCampaignEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as smsCampaignExecutionService from '@/services/smsCampaignExecution.service'
import * as smsCampaignEnrollmentRepo from '@/repositories/smsCampaignEnrollment.repository'

async function processReadyEnrollments(job: Job<SmsCampaignEvent>) {
  const { limit = 100 } = job.data

  logger.info({ limit }, 'Processing ready SMS campaign enrollments')

  const result =
    await smsCampaignExecutionService.processReadyEnrollments(limit)

  logger.info(
    {
      processed: result.processed,
      successful: result.successful,
      failed: result.failed,
    },
    'Finished processing SMS campaign enrollments',
  )

  return result
}

async function processEnrollment(job: Job<SmsCampaignEvent>) {
  const { enrollmentId } = job.data

  if (!enrollmentId) {
    throw new Error('enrollmentId is required for PROCESS_ENROLLMENT')
  }

  logger.info({ enrollmentId }, 'Processing single SMS campaign enrollment')

  const enrollment = await smsCampaignEnrollmentRepo.findById(enrollmentId)
  if (!enrollment) {
    throw new Error(`Enrollment not found: ${enrollmentId}`)
  }

  // This is a simplified version - the full context would need to be fetched
  // For now, the scheduler should use processReadyEnrollments which does the full query
  logger.info(
    { enrollmentId },
    'Single enrollment processing not implemented directly',
  )

  return { success: false, reason: 'Use processReadyEnrollments instead' }
}

async function handleReply(job: Job<SmsCampaignEvent>) {
  const { fromPhone, organizationId } = job.data

  if (!fromPhone || !organizationId) {
    throw new Error(
      'fromPhone and organizationId are required for HANDLE_REPLY',
    )
  }

  logger.info({ fromPhone, organizationId }, 'Handling inbound SMS reply')

  await smsCampaignExecutionService.handleInboundReply(
    fromPhone,
    organizationId,
  )

  return { success: true }
}

async function handleUnsubscribe(job: Job<SmsCampaignEvent>) {
  const { fromPhone, organizationId } = job.data

  if (!fromPhone || !organizationId) {
    throw new Error(
      'fromPhone and organizationId are required for HANDLE_UNSUBSCRIBE',
    )
  }

  logger.info({ fromPhone, organizationId }, 'Handling SMS unsubscribe')

  await smsCampaignExecutionService.handleUnsubscribe(fromPhone, organizationId)

  return { success: true }
}

async function handleDeliveryStatus(job: Job<SmsCampaignEvent>) {
  const { messageSid, status, errorCode } = job.data

  if (!messageSid || !status) {
    throw new Error(
      'messageSid and status are required for HANDLE_DELIVERY_STATUS',
    )
  }

  logger.debug({ messageSid, status }, 'Handling SMS delivery status')

  await smsCampaignExecutionService.handleDeliveryStatus(
    messageSid,
    status,
    errorCode,
  )

  return { success: true }
}

export class SmsCampaignProcessor {
  private worker: Worker<SmsCampaignEvent>

  constructor() {
    this.worker = new Worker<SmsCampaignEvent>(
      QueueName.SMS_CAMPAIGN,
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
              case SmsCampaignEventType.PROCESS_READY:
                return await processReadyEnrollments(job)
              case SmsCampaignEventType.PROCESS_ENROLLMENT:
                return await processEnrollment(job)
              case SmsCampaignEventType.HANDLE_REPLY:
                return await handleReply(job)
              case SmsCampaignEventType.HANDLE_UNSUBSCRIBE:
                return await handleUnsubscribe(job)
              case SmsCampaignEventType.HANDLE_DELIVERY_STATUS:
                return await handleDeliveryStatus(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            {
              error,
              jobId: job.id,
              type: job.data.type,
            },
            'Failed to process SMS campaign job',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
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
        concurrency: 10, // Process 10 jobs at a time
      },
    )

    this.worker.on('completed', (job) => {
      logger.debug(
        { jobId: job.id, type: job.data.type },
        'SMS campaign job completed',
      )
    })

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, type: job?.data.type, error },
        'SMS campaign job failed',
      )
    })
  }

  async close() {
    await this.worker.close()
  }
}

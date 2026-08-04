import { Worker, Job } from 'bullmq'
import {
  ResearchTaskEvent,
  ResearchTaskEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as webResearchService from '@/services/webResearch.service'

async function processResearchTask(job: Job<ResearchTaskEvent>) {
  const { taskId, organizationId } = job.data

  logger.info({ taskId, organizationId }, 'Starting research task execution')

  await webResearchService.executeTask(taskId)

  logger.info({ taskId, organizationId }, 'Research task execution completed')

  return { taskId, success: true }
}

export class ResearchTaskProcessor {
  private worker: Worker<ResearchTaskEvent>

  constructor() {
    this.worker = new Worker<ResearchTaskEvent>(
      QueueName.RESEARCH_TASK,
      async (job) => {
        setRequestContext('jobId', job.id)
        setRequestContext('taskId', job.data.taskId)
        try {
          return await Sentry.withScope(async (scope) => {
            scope.setContext('job', {
              id: job.id,
              name: job.name,
              taskId: job.data.taskId,
              organizationId: job.data.organizationId,
            })

            switch (job.data.type) {
              case ResearchTaskEventType.EXECUTE_TASK:
                return await processResearchTask(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            { error, jobId: job.id, taskId: job.data.taskId },
            'Failed to process research task',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              taskId: job.data.taskId,
              organizationId: job.data.organizationId,
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
        concurrency: 3, // Process up to 3 research tasks at a time
      },
    )

    // Listen for worker events
    this.worker.on('completed', (job) => {
      logger.info(
        { jobId: job.id, taskId: job.data.taskId },
        'Research task job completed',
      )
    })

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, taskId: job?.data.taskId, error },
        'Research task job failed',
      )
    })
  }

  async close() {
    await this.worker.close()
  }
}

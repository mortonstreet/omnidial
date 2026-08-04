import { Queue } from 'bullmq'
import { ResearchTaskEvent, QueueName } from '@/types/queues'
import { config } from '@/config'

export const researchTaskQueue = new Queue<ResearchTaskEvent>(
  QueueName.RESEARCH_TASK,
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

export const addResearchTaskJob = async (
  event: ResearchTaskEvent,
  attempts: number = 3,
  backoff: number = 10000,
) => {
  const job = await researchTaskQueue.add(event.type, event, {
    attempts,
    backoff: {
      type: 'exponential',
      delay: backoff,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  })
  return job.id
}

/**
 * Add a research task job with priority
 * Higher priority = processed first
 */
export const addResearchTaskJobWithPriority = async (
  event: ResearchTaskEvent,
  priority: number,
  attempts: number = 3,
  backoff: number = 10000,
) => {
  const job = await researchTaskQueue.add(event.type, event, {
    priority,
    attempts,
    backoff: {
      type: 'exponential',
      delay: backoff,
    },
    removeOnComplete: 100,
    removeOnFail: 50,
  })
  return job.id
}

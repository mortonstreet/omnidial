import { Queue } from 'bullmq'
import { ExtensionBulkEnrichEvent, QueueName } from '@/types/queues'
import { config } from '@/config'

export const extensionBulkEnrichQueue = new Queue<ExtensionBulkEnrichEvent>(
  QueueName.EXTENSION_BULK_ENRICH,
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

export const addExtensionBulkEnrichJob = async (
  event: ExtensionBulkEnrichEvent,
  attempts: number = 2,
  backoff: number = 5000,
) => {
  const job = await extensionBulkEnrichQueue.add(event.type, event, {
    attempts,
    backoff: {
      type: 'exponential',
      delay: backoff,
    },
    removeOnComplete: 100,
    removeOnFail: 100,
  })
  return job.id
}

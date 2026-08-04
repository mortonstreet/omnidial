import { Queue } from 'bullmq'
import { ListCsvImportEvent, QueueName } from '@/types/queues'
import { config } from '@/config'

export const listCsvImportQueue = new Queue<ListCsvImportEvent>(
  QueueName.LIST_CSV_IMPORT,
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

export const addListCsvImportJob = async (
  event: ListCsvImportEvent,
  attempts: number = 3,
  backoff: number = 5000,
) => {
  const job = await listCsvImportQueue.add(event.type, event, {
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

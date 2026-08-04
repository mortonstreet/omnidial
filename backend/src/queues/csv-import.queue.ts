import { Queue } from 'bullmq'
import { CsvImportEvent, QueueName } from '@/types/queues'
import { config } from '@/config'

export const csvImportQueue = new Queue<CsvImportEvent>(QueueName.CSV_IMPORT, {
  connection: {
    url: config.redis.url,
    ...(config.redis.useTLS && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  },
})

export const addCsvImportJob = async (
  event: CsvImportEvent,
  attempts: number = 3,
  backoff: number = 5000,
) => {
  const job = await csvImportQueue.add(event.type, event, {
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

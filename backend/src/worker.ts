import { EventProcessor } from '@/queues/workers'
import { CsvImportProcessor } from '@/queues/csv-import.worker'
import { ListCsvImportProcessor } from '@/queues/list-csv-import.worker'
import { ExtensionBulkEnrichProcessor } from '@/queues/extension-bulk-enrich.worker'
import { ScheduledNotificationProcessor } from '@/queues/scheduled-notification.worker'
import { ResearchTaskProcessor } from '@/queues/research-task.worker'
import { SmsCampaignProcessor } from '@/queues/sms-campaign.worker'
import { BillingProcessor } from '@/queues/billing.worker'
import { exampleQueue, scheduleRecurringExampleCheck } from '@/queues'
import { scheduleSmsCampaignProcessor } from '@/queues/sms-campaign.queue'
import { scheduleBillingJobs } from '@/queues/billing.queue'

import logger from '@/lib/logger'

logger.info('Starting Worker services...')

export const startWorker = async () => {
  logger.info('Initializing Worker services...')
  const eventProcessor = new EventProcessor()
  const csvImportProcessor = new CsvImportProcessor()
  const listCsvImportProcessor = new ListCsvImportProcessor()
  const extensionBulkEnrichProcessor = new ExtensionBulkEnrichProcessor()
  const scheduledNotificationProcessor = new ScheduledNotificationProcessor()
  const researchTaskProcessor = new ResearchTaskProcessor()
  const smsCampaignProcessor = new SmsCampaignProcessor()
  const billingProcessor = new BillingProcessor()

  try {
    const jobs = await exampleQueue.getJobSchedulers()
    for (const job of jobs) {
      logger.info(`Removing repeatable: ${job.key}`)
      await exampleQueue.removeJobScheduler(job.key)
    }
    await scheduleRecurringExampleCheck()
    logger.info('Scheduled recurring example check (every n minute)')
  } catch (error) {
    logger.error('Failed to schedule recurring stuck games check:', error)
  }

  try {
    await scheduleSmsCampaignProcessor()
    logger.info('Scheduled SMS campaign processor (every minute)')
  } catch (error) {
    logger.error('Failed to schedule SMS campaign processor:', error)
  }

  try {
    await scheduleBillingJobs()
    logger.info(
      'Scheduled billing jobs (cycle rotation, Redis sync, overage reporting)',
    )
  } catch (error) {
    logger.error('Failed to schedule billing jobs:', error)
  }

  const shutdown = async () => {
    logger.info('Shutting down Worker services...')
    await eventProcessor.close()
    await csvImportProcessor.close()
    await listCsvImportProcessor.close()
    await extensionBulkEnrichProcessor.close()
    await scheduledNotificationProcessor.close()
    await researchTaskProcessor.close()
    await smsCampaignProcessor.close()
    await billingProcessor.close()
    logger.info('Worker services stopped.')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  logger.info(
    'Worker is now processing events, internal tasks, and cleanup tasks...',
  )
}

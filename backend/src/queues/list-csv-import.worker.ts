import { Worker, Job } from 'bullmq'
import {
  ListCsvImportEvent,
  ListCsvImportEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as leadListService from '@/services/leadList.service'
import * as leadRepo from '@/repositories/lead.repository'
import * as leadListEntryRepo from '@/repositories/leadListEntry.repository'
import * as campaignListRepo from '@/repositories/campaignList.repository'
import * as campaignLeadRepo from '@/repositories/campaign-lead.repository'
import { mapCsvRowToLead, parseCSV, ParsedCsvLead } from '@/lib/csv-lead-import'

async function processListCsvImport(job: Job<ListCsvImportEvent>) {
  const { organizationId, listId, fileContent, fileName } = job.data

  logger.info({ listId, fileName }, 'Starting list CSV import')

  // Update import status to processing
  await leadListService.updateImportStatus(listId, 'processing')

  try {
    // Decode base64 content
    const csvContent = Buffer.from(fileContent, 'base64').toString('utf-8')

    // Parse CSV
    const { headers, rows } = parseCSV(csvContent)

    if (headers.length === 0 || rows.length === 0) {
      throw new Error('CSV file is empty or has no data rows')
    }

    logger.info(
      { listId, headerCount: headers.length, rowCount: rows.length, headers },
      'CSV parsed',
    )

    // Map rows to leads
    const leads: ParsedCsvLead[] = []
    const errors: { row: number; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const result = mapCsvRowToLead(headers, rows[i], {
        requirePhone: false,
      })
      if (result.lead) {
        leads.push(result.lead)
      } else {
        errors.push({ row: i + 2, error: result.error })
      }
    }

    logger.info(
      { listId, validLeads: leads.length, errors: errors.length },
      'CSV rows processed',
    )

    if (leads.length === 0) {
      throw new Error(
        `No valid leads found - each row must include phone or LinkedIn URL. Found headers: [${headers.join(', ')}]. ` +
          `Prospeo headers such as Mobile and Person LinkedIn URL are supported.`,
      )
    }

    // Batch create leads and add to list
    const BATCH_SIZE = 100
    let totalCreated = 0
    const allLeadIds: string[] = []

    for (let i = 0; i < leads.length; i += BATCH_SIZE) {
      const batch = leads.slice(i, i + BATCH_SIZE)

      // Create leads in organization using repository
      const createdLeadIds = await leadRepo.bulkCreateIgnoreConflicts(
        organizationId,
        batch.map((lead) => ({
          firstName: lead.firstName ?? null,
          lastName: lead.lastName ?? null,
          email: lead.email ?? null,
          phone: lead.phone ?? null,
          normalizedPhone: lead.normalizedPhone,
          company: lead.company ?? null,
          title: lead.title ?? null,
          linkedInUrl: lead.linkedInUrl ?? null,
          website: lead.website ?? null,
          customFields: lead.customFields,
        })),
      )

      allLeadIds.push(...createdLeadIds)
      totalCreated += batch.length

      // Add leads to list
      await leadListEntryRepo.addLeads(listId, createdLeadIds)

      // Update job progress
      const progress = Math.round(((i + batch.length) / leads.length) * 100)
      await job.updateProgress(progress)

      logger.info(
        { listId, progress, totalCreated },
        'List CSV import progress',
      )
    }

    // Update list lead count
    await leadListService.refreshLeadCount(listId)

    // Sync with linked campaigns
    const linkedCampaigns = await campaignListRepo.findByList(listId)
    for (const campaign of linkedCampaigns) {
      const maxOrder = await campaignLeadRepo.getMaxDialOrder(
        campaign.campaignId,
      )
      await campaignLeadRepo.createMany(
        campaign.campaignId,
        allLeadIds,
        maxOrder + 1,
      )
    }

    // Update import status to completed
    await leadListService.updateImportStatus(listId, 'completed')

    logger.info(
      { listId, totalCreated, errors: errors.length },
      'List CSV import completed',
    )

    return {
      totalRows: rows.length,
      created: totalCreated,
      errors,
    }
  } catch (error) {
    // Update import status to failed
    await leadListService.updateImportStatus(
      listId,
      'failed',
      (error as Error).message,
    )
    throw error
  }
}

export class ListCsvImportProcessor {
  private worker: Worker<ListCsvImportEvent>

  constructor() {
    this.worker = new Worker<ListCsvImportEvent>(
      QueueName.LIST_CSV_IMPORT,
      async (job) => {
        setRequestContext('jobId', job.id)
        try {
          return await Sentry.withScope(async (scope) => {
            scope.setContext('job', {
              id: job.id,
              name: job.name,
              data: {
                ...job.data,
                fileContent: '[REDACTED]', // Don't log file content
              },
            })

            switch (job.data.type) {
              case ListCsvImportEventType.PROCESS_CSV:
                return await processListCsvImport(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            { error, jobId: job.id, listId: job.data.listId },
            'Failed to process list CSV import',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              listId: job.data.listId,
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
        concurrency: 2, // Process 2 CSV imports at a time
      },
    )
  }

  async close() {
    await this.worker.close()
  }
}

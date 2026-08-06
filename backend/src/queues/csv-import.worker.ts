import { Worker, Job } from 'bullmq'
import { CsvImportEvent, CsvImportEventType, QueueName } from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as leadService from '@/services/lead.service'
import * as campaignRepo from '@/repositories/campaign.repository'
import { mapCsvRowToLead, parseCSV, ParsedCsvLead } from '@/lib/csv-lead-import'

async function processCsvImport(job: Job<CsvImportEvent>) {
  const { organizationId, campaignId, fileContent, fileName } = job.data

  logger.info({ campaignId, fileName }, 'Starting CSV import')

  // Decode base64 content
  const csvContent = Buffer.from(fileContent, 'base64').toString('utf-8')

  // Parse CSV
  const { headers, rows } = parseCSV(csvContent)

  if (headers.length === 0 || rows.length === 0) {
    throw new Error('CSV file is empty or has no data rows')
  }

  logger.info(
    { campaignId, headerCount: headers.length, rowCount: rows.length },
    'CSV parsed',
  )

  // Map rows to leads
  const leads: ParsedCsvLead[] = []
  const errors: { row: number; error: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const result = mapCsvRowToLead(headers, rows[i], {
      requirePhone: true,
    })
    if (result.lead) {
      leads.push(result.lead)
    } else {
      errors.push({ row: i + 2, error: result.error })
    }
  }

  logger.info(
    { campaignId, validLeads: leads.length, errors: errors.length },
    'CSV rows processed',
  )

  if (leads.length === 0) {
    throw new Error(
      'No valid leads found in CSV - campaign imports require a valid phone number.',
    )
  }

  // Batch create leads
  const BATCH_SIZE = 100
  let totalCreated = 0

  for (let i = 0; i < leads.length; i += BATCH_SIZE) {
    const batch = leads.slice(i, i + BATCH_SIZE)

    const result = await leadService.bulkCreate({
      organizationId,
      campaignId,
      leads: batch.map((lead) => ({
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone ?? '',
        normalizedPhone: lead.normalizedPhone,
        company: lead.company,
        title: lead.title,
        linkedInUrl: lead.linkedInUrl,
        website: lead.website,
        customFields: lead.customFields,
      })),
    })

    totalCreated += result.created

    // Update job progress
    const progress = Math.round(((i + batch.length) / leads.length) * 100)
    await job.updateProgress(progress)

    logger.info({ campaignId, progress, totalCreated }, 'CSV import progress')
  }

  // Update campaign counts
  await campaignRepo.updateCounts(campaignId, organizationId)

  logger.info(
    { campaignId, totalCreated, errors: errors.length },
    'CSV import completed',
  )

  return {
    totalRows: rows.length,
    created: totalCreated,
    errors,
  }
}

export class CsvImportProcessor {
  private worker: Worker<CsvImportEvent>

  constructor() {
    this.worker = new Worker<CsvImportEvent>(
      QueueName.CSV_IMPORT,
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
              case CsvImportEventType.PROCESS_CSV:
                return await processCsvImport(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            { error, jobId: job.id, campaignId: job.data.campaignId },
            'Failed to process CSV import',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              campaignId: job.data.campaignId,
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

import { Worker, Job } from 'bullmq'
import {
  ExtensionBulkEnrichEvent,
  ExtensionBulkEnrichEventType,
  QueueName,
} from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as enrichmentService from '@/services/enrichment.service'
import type { DataVendorProvider } from '@shared/types/src/requests/enrichment'

const EXTENSION_BULK_ENRICH_EVENT = {
  JOB_STARTED: 'extension.bulk_enrich.job.started',
  JOB_PROGRESS: 'extension.bulk_enrich.job.progress',
  JOB_COMPLETED: 'extension.bulk_enrich.job.completed',
  JOB_FAILED: 'extension.bulk_enrich.job.failed',
  LEAD_FAILED: 'extension.bulk_enrich.lead.failed',
  WORKER_ERROR: 'extension.bulk_enrich.worker.error',
} as const

async function processListBulkEnrich(job: Job<ExtensionBulkEnrichEvent>) {
  const {
    organizationId,
    userId,
    leadIds,
    providers,
    forceRefresh,
    listId,
    correlationId,
  } = job.data
  const startedAt = Date.now()

  logger.info(
    {
      eventType: EXTENSION_BULK_ENRICH_EVENT.JOB_STARTED,
      jobId: String(job.id),
      organizationId,
      userId,
      listId,
      totalLeads: leadIds.length,
      providers,
      forceRefresh: !!forceRefresh,
      correlationId,
    },
    'Starting extension list bulk enrichment job',
  )

  const results: Awaited<ReturnType<typeof enrichmentService.enrichLead>>[] = []
  let totalEnriched = 0
  let totalFailed = 0
  let totalCreditsUsed = 0

  for (let i = 0; i < leadIds.length; i++) {
    const leadId = leadIds[i]
    try {
      const result = await enrichmentService.enrichLead(
        organizationId,
        leadId,
        {
          providers: providers as DataVendorProvider[] | undefined,
          forceRefresh,
          requestMode: 'bulk',
        },
      )
      results.push(result)
      if (result.success) {
        totalEnriched++
      } else {
        logger.warn(
          {
            eventType: EXTENSION_BULK_ENRICH_EVENT.LEAD_FAILED,
            jobId: String(job.id),
            organizationId,
            listId,
            leadId,
            reason: result.errorMessage || 'Enrichment returned success=false',
            correlationId,
          },
          'Lead enrichment failed in extension bulk job',
        )
        totalFailed++
      }
      totalCreditsUsed += result.creditsUsed
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error'
      results.push({
        leadId,
        success: false,
        providersUsed: [],
        fieldsEnriched: [],
        creditsUsed: 0,
        errorMessage,
      })
      logger.warn(
        {
          eventType: EXTENSION_BULK_ENRICH_EVENT.LEAD_FAILED,
          jobId: String(job.id),
          organizationId,
          listId,
          leadId,
          errorMessage,
          correlationId,
        },
        'Lead enrichment threw in extension bulk job',
      )
      totalFailed++
    }

    await job.updateProgress({
      processed: i + 1,
      total: leadIds.length,
      enriched: totalEnriched,
      failed: totalFailed,
    })

    if ((i + 1) % 10 === 0 || i === leadIds.length - 1) {
      logger.info(
        {
          eventType: EXTENSION_BULK_ENRICH_EVENT.JOB_PROGRESS,
          jobId: String(job.id),
          organizationId,
          listId,
          processed: i + 1,
          total: leadIds.length,
          enriched: totalEnriched,
          failed: totalFailed,
          correlationId,
        },
        'Extension list bulk enrichment progress',
      )
    }
  }

  logger.info(
    {
      eventType: EXTENSION_BULK_ENRICH_EVENT.JOB_COMPLETED,
      jobId: String(job.id),
      organizationId,
      userId,
      listId,
      totalRequested: leadIds.length,
      totalEnriched,
      totalFailed,
      totalCreditsUsed,
      durationMs: Date.now() - startedAt,
      correlationId,
    },
    'Completed extension list bulk enrichment job',
  )

  const completedAt = new Date().toISOString()

  return {
    listId,
    correlationId,
    totalRequested: leadIds.length,
    totalEnriched,
    totalFailed,
    totalCreditsUsed,
    results,
    completedAt,
  }
}

export class ExtensionBulkEnrichProcessor {
  private worker: Worker<ExtensionBulkEnrichEvent>

  constructor() {
    this.worker = new Worker<ExtensionBulkEnrichEvent>(
      QueueName.EXTENSION_BULK_ENRICH,
      async (job) => {
        setRequestContext('jobId', job.id)
        setRequestContext('userId', job.data.userId)
        setRequestContext('organizationId', job.data.organizationId)
        setRequestContext('correlationId', job.data.correlationId)

        try {
          return await Sentry.withScope(async (scope) => {
            scope.setContext('job', {
              id: job.id,
              name: job.name,
              data: job.data,
            })

            switch (job.data.type) {
              case ExtensionBulkEnrichEventType.PROCESS_LIST_BULK_ENRICH:
                return await processListBulkEnrich(job)
              default:
                throw new Error(`Unknown event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            {
              eventType: EXTENSION_BULK_ENRICH_EVENT.JOB_FAILED,
              error,
              jobId: job.id,
              organizationId: job.data.organizationId,
              userId: job.data.userId,
              listId: job.data.listId,
              correlationId: job.data.correlationId,
            },
            'Failed to process extension bulk enrich job',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              data: job.data,
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
        concurrency: 2,
      },
    )

    this.worker.on('failed', (job, error) => {
      logger.error(
        {
          eventType: EXTENSION_BULK_ENRICH_EVENT.JOB_FAILED,
          error,
          jobId: job?.id ? String(job.id) : undefined,
          organizationId: job?.data.organizationId,
          userId: job?.data.userId,
          listId: job?.data.listId,
          correlationId: job?.data.correlationId,
        },
        'Extension bulk enrich worker observed failed job event',
      )
    })

    this.worker.on('error', (error) => {
      logger.error(
        {
          eventType: EXTENSION_BULK_ENRICH_EVENT.WORKER_ERROR,
          error,
        },
        'Extension bulk enrich worker error',
      )
    })
  }

  async close() {
    await this.worker.close()
  }
}

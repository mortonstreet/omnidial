import { Worker } from 'bullmq'
import { CrmSyncEvent, CrmSyncEventType, QueueName } from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as hubspotSyncService from '@/services/hubspotSync.service'

export class CrmSyncProcessor {
  private worker: Worker<CrmSyncEvent>

  constructor() {
    this.worker = new Worker<CrmSyncEvent>(
      QueueName.CRM_SYNC,
      async (job) => {
        setRequestContext('jobId', job.id)
        switch (job.data.type) {
          case CrmSyncEventType.PUSH_LEAD:
            if (!job.data.organizationId || !job.data.leadId) return
            return hubspotSyncService.pushLead(
              job.data.organizationId,
              job.data.leadId,
            )
          case CrmSyncEventType.SYNC_CALL:
            if (!job.data.callId) return
            return hubspotSyncService.syncCall(job.data.callId)
          case CrmSyncEventType.RECONCILE_ALL:
            return hubspotSyncService.reconcileAll()
          default:
            throw new Error(`Unknown CRM sync event type: ${job.data.type}`)
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
        // HubSpot allows ~10 req/s per app on a portal; pushes make several calls.
        concurrency: 2,
      },
    )

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, data: job?.data, error },
        'CRM sync job failed',
      )
      // Only report the final attempt; earlier ones are retried with backoff.
      if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) {
        Sentry.captureException(error, {
          extra: { jobId: job.id, data: job.data },
        })
      }
    })
  }

  async close() {
    await this.worker.close()
  }
}

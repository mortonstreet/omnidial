import { Queue } from 'bullmq'
import { CrmSyncEvent, CrmSyncEventType, QueueName } from '@/types/queues'
import { config } from '@/config'
import logger from '@/lib/logger'
import * as integrationRepository from '@/repositories/integration.repository'
import { readSyncConfig } from '@/lib/hubspot-sync-rules'

export const crmSyncQueue = new Queue<CrmSyncEvent>(QueueName.CRM_SYNC, {
  connection: {
    url: config.redis.url,
    ...(config.redis.useTLS && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  },
})

/** Edits within this window collapse into one push. */
const DEBOUNCE_MS = 5_000

/**
 * BullMQ waits indefinitely for Redis. Sync is bookkeeping, so cap the wait:
 * a Redis outage must never hang a lead edit. The 6-hourly reconcile catches
 * anything that failed to enqueue.
 */
const ENQUEUE_TIMEOUT_MS = 3_000
const withTimeout = <T>(promise: Promise<T>): Promise<T> =>
  Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error('CRM sync enqueue timed out (Redis unavailable?)')),
        ENQUEUE_TIMEOUT_MS,
      ).unref(),
    ),
  ])

/**
 * Queue a HubSpot push for a lead that just changed. No-op when HubSpot isn't
 * connected or auto-sync is off. Never throws: sync must not fail the edit.
 */
export const enqueueCrmSync = async (
  organizationId: string,
  leadId: string,
) => {
  try {
    const integration =
      await integrationRepository.findByOrganizationAndProvider(
        organizationId,
        'hubspot',
      )
    if (!integration || !readSyncConfig(integration.config).autoSync) return

    // Bucketed job id: repeated edits in one window coalesce, while an edit
    // that lands during a running push still gets its own follow-up job.
    const bucket = Math.floor(Date.now() / DEBOUNCE_MS)
    await withTimeout(
      crmSyncQueue.add(
        CrmSyncEventType.PUSH_LEAD,
        { type: CrmSyncEventType.PUSH_LEAD, organizationId, leadId },
        {
          jobId: `push-${organizationId}-${leadId}-${bucket}`,
          delay: DEBOUNCE_MS,
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      ),
    )
  } catch (error) {
    logger.error(
      { error, organizationId, leadId },
      'Failed to enqueue CRM sync',
    )
  }
}

/**
 * A call finished or got its disposition: log/refresh it in HubSpot. Delayed
 * so the disposition a rep picks right after hanging up lands in the same log.
 */
export const enqueueCallSync = async (callId: string) => {
  try {
    await withTimeout(
      crmSyncQueue.add(
        CrmSyncEventType.SYNC_CALL,
        { type: CrmSyncEventType.SYNC_CALL, callId },
        {
          jobId: `call-${callId}-${Math.floor(Date.now() / DEBOUNCE_MS)}`,
          delay: 30_000,
          attempts: 5,
          backoff: { type: 'exponential', delay: 10_000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      ),
    )
  } catch (error) {
    logger.error({ error, callId }, 'Failed to enqueue call sync')
  }
}

export const enqueueCrmSyncMany = async (
  organizationId: string,
  leadIds: string[],
) => {
  for (const leadId of leadIds) await enqueueCrmSync(organizationId, leadId)
}

/** Drift sweep for every connected portal, every 6 hours. */
export const scheduleCrmReconcile = async (): Promise<void> => {
  const existing = await crmSyncQueue.getJobSchedulers()
  for (const scheduler of existing) {
    await crmSyncQueue.removeJobScheduler(scheduler.key)
  }
  await crmSyncQueue.add(
    CrmSyncEventType.RECONCILE_ALL,
    { type: CrmSyncEventType.RECONCILE_ALL },
    {
      repeat: { pattern: '17 */6 * * *' },
      jobId: 'crm-reconcile-all',
      removeOnComplete: 10,
      removeOnFail: 10,
    },
  )
}

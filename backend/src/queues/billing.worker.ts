import { Worker, Job } from 'bullmq'
import { BillingQueueEvent, BillingEventType, QueueName } from '@/types/queues'
import { config } from '@/config'
import { setRequestContext } from '@/lib/context'
import logger from '@/lib/logger'
import Sentry from '@/lib/sentry'
import * as usageCycleRepository from '@/repositories/usageCycle.repository'
import * as billingEventRepository from '@/repositories/billingEvent.repository'
import * as subscriptionRepository from '@/repositories/subscription.repository'
import * as usageTrackingService from '@/services/usageTracking.service'
import * as stripeMeterClient from '@/clients/stripeMeter.client'
import { getPlanUsageConfig } from '@shared/types/src/constants/billing'

/**
 * Cycle rotation: finalize expired cycles and create new ones.
 */
async function processCycleRotation() {
  logger.info('Starting billing cycle rotation')

  const expiredCycles = await usageCycleRepository.findExpiredCurrentCycles()

  for (const cycle of expiredCycles) {
    try {
      // Sync any remaining Redis usage to Postgres
      await usageTrackingService.syncRedisToPostgres(cycle.organizationId)

      // Finalize the old cycle
      await usageCycleRepository.closeCycle(cycle.id)

      // Create a new cycle
      const sub = await subscriptionRepository.getSubscriptionByReferenceId(
        cycle.organizationId,
      )
      if (!sub) {
        logger.warn(
          { orgId: cycle.organizationId },
          'No subscription found for cycle rotation',
        )
        continue
      }

      const planConfig = getPlanUsageConfig(sub.plan)
      if (!planConfig) {
        logger.warn({ plan: sub.plan }, 'Unknown plan for cycle rotation')
        continue
      }

      const newStart = new Date(cycle.periodEnd)
      const newEnd = new Date(newStart.getTime() + 30 * 24 * 60 * 60 * 1000)

      await usageCycleRepository.getOrCreateCurrentCycle(
        cycle.organizationId,
        sub.id,
        planConfig,
        newStart,
        newEnd,
      )

      // Reset Redis counters
      const ttlSeconds = Math.floor((newEnd.getTime() - Date.now()) / 1000)
      await usageTrackingService.resetCycleCounters(
        cycle.organizationId,
        planConfig.includedMinutes,
        ttlSeconds,
      )

      // Reset overage cap hit flag
      const { db } = await import('@/lib/db')
      await db
        .updateTable('subscription')
        .set({ overageCapHit: false })
        .where('id', '=', sub.id)
        .execute()

      await billingEventRepository.create(
        cycle.organizationId,
        'cycle_rotated',
        {
          oldCycleId: cycle.id,
          usedMinutes: cycle.usedMinutes,
          overageMinutes: cycle.overageMinutes,
        },
      )

      logger.info(
        {
          orgId: cycle.organizationId,
          oldCycleId: cycle.id,
          usedMinutes: cycle.usedMinutes,
        },
        'Rotated billing cycle',
      )
    } catch (err) {
      logger.error(
        { err, cycleId: cycle.id, orgId: cycle.organizationId },
        'Failed to rotate billing cycle',
      )
      Sentry.captureException(err, {
        extra: { cycleId: cycle.id, orgId: cycle.organizationId },
      })
    }
  }

  return { rotated: expiredCycles.length }
}

/**
 * Redis sync: persist Redis counters to Postgres for all active cycles.
 */
async function processRedisSync() {
  logger.debug('Starting billing Redis sync')

  const { db } = await import('@/lib/db')
  const activeCycles = await db
    .selectFrom('usage_cycle')
    .where('isCurrent', '=', true)
    .where('finalized', '=', false)
    .select(['organizationId'])
    .execute()

  let synced = 0
  for (const cycle of activeCycles) {
    try {
      await usageTrackingService.syncRedisToPostgres(cycle.organizationId)
      synced++
    } catch (err) {
      logger.warn(
        { err, orgId: cycle.organizationId },
        'Failed to sync Redis to Postgres for org',
      )
    }
  }

  logger.debug(
    { synced, total: activeCycles.length },
    'Billing Redis sync completed',
  )
  return { synced }
}

/**
 * Report unreported overage minutes to Stripe Meters.
 */
async function processOverageReporting() {
  logger.debug('Starting overage reporting to Stripe')

  const cycles = await usageCycleRepository.findCyclesWithUnreportedOverage()

  let reported = 0
  for (const cycle of cycles) {
    try {
      const delta = cycle.overageMinutes - cycle.overageReportedToStripe
      if (delta <= 0) continue

      // Get subscription for Stripe customer ID and plan
      const sub = await subscriptionRepository.getSubscriptionByReferenceId(
        cycle.organizationId,
      )
      if (!sub?.stripeCustomerId) {
        logger.warn(
          { orgId: cycle.organizationId },
          'No Stripe customer ID for overage reporting',
        )
        continue
      }

      const planConfig = getPlanUsageConfig(sub.plan)
      if (!planConfig) continue

      const success = await stripeMeterClient.reportOverageToStripe(
        sub.stripeCustomerId,
        planConfig.stripeOverageMeterEvent,
        delta,
      )

      if (success) {
        await usageCycleRepository.updateOverageReported(
          cycle.id,
          cycle.overageMinutes,
        )

        await billingEventRepository.create(
          cycle.organizationId,
          'overage_reported',
          {
            minutes: delta,
            totalOverage: cycle.overageMinutes,
            meterEvent: planConfig.stripeOverageMeterEvent,
          },
        )

        reported++
      }
    } catch (err) {
      logger.error(
        { err, cycleId: cycle.id, orgId: cycle.organizationId },
        'Failed to report overage to Stripe',
      )
      Sentry.captureException(err, {
        extra: { cycleId: cycle.id, orgId: cycle.organizationId },
      })
    }
  }

  logger.debug(
    { reported, total: cycles.length },
    'Overage reporting completed',
  )
  return { reported }
}

export class BillingProcessor {
  private worker: Worker<BillingQueueEvent>

  constructor() {
    this.worker = new Worker<BillingQueueEvent>(
      QueueName.BILLING,
      async (job) => {
        setRequestContext('jobId', job.id)
        try {
          return await Sentry.withScope(async (scope) => {
            scope.setContext('job', {
              id: job.id,
              name: job.name,
              data: job.data,
            })

            switch (job.data.type) {
              case BillingEventType.CYCLE_ROTATION:
                return await processCycleRotation()
              case BillingEventType.REDIS_SYNC:
                return await processRedisSync()
              case BillingEventType.REPORT_OVERAGE:
                return await processOverageReporting()
              default:
                throw new Error(`Unknown billing event type: ${job.data.type}`)
            }
          })
        } catch (error) {
          logger.error(
            { error, jobId: job.id, type: job.data.type },
            'Failed to process billing job',
          )
          Sentry.captureException(error, {
            extra: {
              jobId: job.id,
              jobName: job.name,
              type: job.data.type,
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
        concurrency: 3,
      },
    )

    this.worker.on('completed', (job) => {
      logger.debug(
        { jobId: job.id, type: job.data.type },
        'Billing job completed',
      )
    })

    this.worker.on('failed', (job, error) => {
      logger.error(
        { jobId: job?.id, type: job?.data.type, error },
        'Billing job failed',
      )
    })
  }

  async close() {
    await this.worker.close()
  }
}

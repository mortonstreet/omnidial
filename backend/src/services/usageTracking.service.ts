import { getRedis } from '@/lib/redis'
import logger from '@/lib/logger'
import * as usageCycleRepository from '@/repositories/usageCycle.repository'
import * as billingEventRepository from '@/repositories/billingEvent.repository'
import * as subscriptionRepository from '@/repositories/subscription.repository'
import { getPlanUsageConfig } from '@shared/types/src/constants/billing'

// Redis key helpers
const keys = {
  minutes: (orgId: string) => `usage:${orgId}:minutes`,
  overage: (orgId: string) => `usage:${orgId}:overage`,
  included: (orgId: string) => `usage:${orgId}:included`,
  cycleStart: (orgId: string) => `usage:${orgId}:cycle_start`,
  status: (orgId: string) => `org:${orgId}:status`,
  canCall: (orgId: string) => `org:${orgId}:can_call`,
  overageCap: (orgId: string) => `org:${orgId}:overage_cap`,
  overageAmount: (orgId: string) => `org:${orgId}:overage_amount`,
  alertSent: (orgId: string, threshold: number) =>
    `usage:${orgId}:alert:${threshold}`,
  dailyCalls: (orgId: string, userId: string, date: string) =>
    `usage:${orgId}:${userId}:calls:${date}`,
}

export interface RecordResult {
  totalMinutes: number
  overageFromThisCall: number
  isOverage: boolean
}

/**
 * Record call minutes for an organization.
 * Uses Redis INCRBY for atomic increment, with Postgres as backing store.
 */
export const recordCallMinutes = async (
  orgId: string,
  durationSeconds: number,
): Promise<RecordResult> => {
  const durationMinutes = Math.ceil(durationSeconds / 60)
  if (durationMinutes <= 0) {
    return { totalMinutes: 0, overageFromThisCall: 0, isOverage: false }
  }

  const redis = getRedis()

  try {
    // Ensure Redis has the counters (hydrate from Postgres if needed)
    const hasCounters = await redis.exists(keys.included(orgId))
    if (!hasCounters) {
      await syncFromPostgres(orgId)
    }

    // Atomic increment total minutes
    const newTotal = await redis.incrby(keys.minutes(orgId), durationMinutes)
    const included = parseInt(
      (await redis.get(keys.included(orgId))) || '0',
      10,
    )

    let overageFromThisCall = 0
    const isOverage = newTotal > included

    if (isOverage) {
      const previousTotal = newTotal - durationMinutes
      const previousOverage = Math.max(0, previousTotal - included)
      const currentOverage = newTotal - included
      overageFromThisCall = currentOverage - previousOverage

      if (overageFromThisCall > 0) {
        await redis.incrby(keys.overage(orgId), overageFromThisCall)

        // Calculate overage cost and update Redis
        const cycle = await usageCycleRepository.findCurrentCycle(orgId)
        if (cycle) {
          const costCents = overageFromThisCall * cycle.overageRateCents
          await redis.incrby(keys.overageAmount(orgId), costCents)
        }
      }
    }

    // Check usage alert thresholds
    await checkUsageAlerts(orgId, newTotal, included)

    // Async persist to Postgres (non-blocking)
    persistToPostgres(orgId, durationMinutes, overageFromThisCall).catch(
      (err) => {
        logger.error({ err, orgId }, 'Failed to persist usage to Postgres')
      },
    )

    return {
      totalMinutes: newTotal,
      overageFromThisCall,
      isOverage,
    }
  } catch (err) {
    logger.error(
      { err, orgId },
      'Redis error in recordCallMinutes, falling back to Postgres',
    )
    // Fallback: write directly to Postgres
    return await recordCallMinutesDirect(orgId, durationSeconds)
  }
}

/**
 * Direct Postgres fallback for recording minutes (when Redis is unavailable).
 */
const recordCallMinutesDirect = async (
  orgId: string,
  durationSeconds: number,
): Promise<RecordResult> => {
  const durationMinutes = Math.ceil(durationSeconds / 60)
  const cycle = await usageCycleRepository.findCurrentCycle(orgId)
  if (!cycle) {
    logger.warn({ orgId }, 'No current usage cycle found')
    return { totalMinutes: 0, overageFromThisCall: 0, isOverage: false }
  }

  const newTotal = cycle.usedMinutes + durationMinutes
  const isOverage = newTotal > cycle.includedMinutes
  let overageFromThisCall = 0

  if (isOverage) {
    const previousOverage = Math.max(
      0,
      cycle.usedMinutes - cycle.includedMinutes,
    )
    const currentOverage = newTotal - cycle.includedMinutes
    overageFromThisCall = currentOverage - previousOverage
  }

  const costCents = overageFromThisCall * cycle.overageRateCents

  await usageCycleRepository.incrementUsage(
    cycle.id,
    durationMinutes,
    overageFromThisCall,
    costCents,
  )

  return { totalMinutes: newTotal, overageFromThisCall, isOverage }
}

/**
 * Persist Redis counters to Postgres UsageCycle.
 */
const persistToPostgres = async (
  orgId: string,
  minutes: number,
  overageMinutes: number,
) => {
  const cycle = await usageCycleRepository.findCurrentCycle(orgId)
  if (!cycle) return

  const costCents = overageMinutes * cycle.overageRateCents
  await usageCycleRepository.incrementUsage(
    cycle.id,
    minutes,
    overageMinutes,
    costCents,
  )
}

/**
 * Get current usage from Redis, with Postgres fallback.
 */
export const getCurrentUsage = async (orgId: string) => {
  const redis = getRedis()

  try {
    const [minutesStr, includedStr, overageStr, overageAmountStr] =
      await Promise.all([
        redis.get(keys.minutes(orgId)),
        redis.get(keys.included(orgId)),
        redis.get(keys.overage(orgId)),
        redis.get(keys.overageAmount(orgId)),
      ])

    if (minutesStr !== null && includedStr !== null) {
      return {
        usedMinutes: parseInt(minutesStr, 10),
        includedMinutes: parseInt(includedStr, 10),
        overageMinutes: parseInt(overageStr || '0', 10),
        overageAmountCents: parseInt(overageAmountStr || '0', 10),
      }
    }
  } catch (err) {
    logger.warn({ err, orgId }, 'Redis error in getCurrentUsage')
  }

  // Fallback to Postgres
  const cycle = await usageCycleRepository.findCurrentCycle(orgId)
  if (!cycle) return null

  return {
    usedMinutes: cycle.usedMinutes,
    includedMinutes: cycle.includedMinutes,
    overageMinutes: cycle.overageMinutes,
    overageAmountCents: cycle.overageAmountCents,
  }
}

/**
 * Initialize Redis counters from a UsageCycle (cache warm-up).
 */
export const initializeCycleCounters = async (
  orgId: string,
  includedMinutes: number,
  usedMinutes: number,
  overageMinutes: number,
  overageAmountCents: number,
  cycleStart: string,
  ttlSeconds: number,
) => {
  const redis = getRedis()
  const pipeline = redis.pipeline()

  pipeline.set(keys.minutes(orgId), usedMinutes, 'EX', ttlSeconds)
  pipeline.set(keys.included(orgId), includedMinutes, 'EX', ttlSeconds)
  pipeline.set(keys.overage(orgId), overageMinutes, 'EX', ttlSeconds)
  pipeline.set(keys.overageAmount(orgId), overageAmountCents, 'EX', ttlSeconds)
  pipeline.set(keys.cycleStart(orgId), cycleStart, 'EX', ttlSeconds)

  await pipeline.exec()
}

/**
 * Hydrate Redis from Postgres for an org (used on cache miss).
 */
export const syncFromPostgres = async (orgId: string) => {
  const cycle = await usageCycleRepository.findCurrentCycle(orgId)
  if (!cycle) {
    // Try to create a cycle from the subscription
    const sub = await subscriptionRepository.getSubscriptionByReferenceId(orgId)
    if (!sub) return

    const planUsageConfig = getPlanUsageConfig(sub.plan)
    if (!planUsageConfig) return

    const newCycle = await usageCycleRepository.getOrCreateCurrentCycle(
      orgId,
      sub.id,
      planUsageConfig,
      sub.periodStart || undefined,
      sub.periodEnd || undefined,
    )

    const ttlSeconds = Math.max(
      3600,
      Math.floor((new Date(newCycle.periodEnd).getTime() - Date.now()) / 1000),
    )

    await initializeCycleCounters(
      orgId,
      newCycle.includedMinutes,
      newCycle.usedMinutes,
      newCycle.overageMinutes,
      newCycle.overageAmountCents,
      newCycle.periodStart.toISOString(),
      ttlSeconds,
    )
    return
  }

  const ttlSeconds = Math.max(
    3600,
    Math.floor((new Date(cycle.periodEnd).getTime() - Date.now()) / 1000),
  )

  await initializeCycleCounters(
    orgId,
    cycle.includedMinutes,
    cycle.usedMinutes,
    cycle.overageMinutes,
    cycle.overageAmountCents,
    cycle.periodStart.toISOString(),
    ttlSeconds,
  )
}

/**
 * Sync Redis counters back to Postgres (used by cron job).
 */
export const syncRedisToPostgres = async (orgId: string) => {
  const redis = getRedis()
  const [minutesStr, overageStr, overageAmountStr] = await Promise.all([
    redis.get(keys.minutes(orgId)),
    redis.get(keys.overage(orgId)),
    redis.get(keys.overageAmount(orgId)),
  ])

  if (minutesStr === null) return

  const cycle = await usageCycleRepository.findCurrentCycle(orgId)
  if (!cycle) return

  const redisMinutes = parseInt(minutesStr, 10)
  const redisOverage = parseInt(overageStr || '0', 10)
  const redisOverageAmount = parseInt(overageAmountStr || '0', 10)

  // Only update if Redis has higher values (Redis is the source of truth)
  if (redisMinutes > cycle.usedMinutes) {
    const delta = redisMinutes - cycle.usedMinutes
    const overageDelta = Math.max(0, redisOverage - cycle.overageMinutes)
    const overageAmountDelta = Math.max(
      0,
      redisOverageAmount - cycle.overageAmountCents,
    )

    await usageCycleRepository.incrementUsage(
      cycle.id,
      delta,
      overageDelta,
      overageAmountDelta,
    )
  }
}

/**
 * Check thresholds and send alerts (80%, 100%, 150%).
 */
const checkUsageAlerts = async (
  orgId: string,
  usedMinutes: number,
  includedMinutes: number,
) => {
  if (includedMinutes <= 0) return

  const redis = getRedis()
  const percentage = usedMinutes / includedMinutes

  const thresholds = [
    { pct: 0.8, label: '80%' },
    { pct: 1.0, label: '100%' },
    { pct: 1.5, label: '150%' },
  ]

  for (const threshold of thresholds) {
    if (percentage >= threshold.pct) {
      const alertKey = keys.alertSent(orgId, threshold.pct)
      const alreadySent = await redis.exists(alertKey)

      if (!alreadySent) {
        // Mark as sent with TTL matching cycle end
        const cycleTtl = parseInt(
          (await redis.ttl(keys.included(orgId))).toString(),
          10,
        )
        const ttl = cycleTtl > 0 ? cycleTtl : 86400 * 30
        await redis.set(alertKey, '1', 'EX', ttl)

        // Log the alert (email sending is done in the billing worker)
        await billingEventRepository.create(
          orgId,
          `usage_alert_${threshold.label}`,
          {
            usedMinutes,
            includedMinutes,
            percentage: Math.round(percentage * 100),
          },
        )

        logger.info(
          { orgId, threshold: threshold.label, usedMinutes, includedMinutes },
          'Usage alert threshold hit',
        )
      }
    }
  }
}

/**
 * Record a daily call for rate limiting.
 */
export const recordDailyCall = async (
  orgId: string,
  userId: string,
): Promise<number> => {
  try {
    const redis = getRedis()
    const today = new Date().toISOString().split('T')[0]
    const key = keys.dailyCalls(orgId, userId, today)

    const count = await redis.incr(key)
    if (count === 1) {
      // Set TTL to expire at end of day (24 hours from now)
      await redis.expire(key, 86400)
    }

    return count
  } catch (err) {
    logger.error(
      { err, orgId, userId },
      'Redis error in recordDailyCall, skipping',
    )
    return 0
  }
}

/**
 * Get daily call count for a user.
 */
export const getDailyCallCount = async (
  orgId: string,
  userId: string,
): Promise<number> => {
  const redis = getRedis()
  const today = new Date().toISOString().split('T')[0]
  const key = keys.dailyCalls(orgId, userId, today)

  const count = await redis.get(key)
  return count ? parseInt(count, 10) : 0
}

/**
 * Set the org account status in Redis.
 */
export const setOrgStatus = async (orgId: string, status: string) => {
  const redis = getRedis()
  await redis.set(keys.status(orgId), status)
  await redis.set(
    keys.canCall(orgId),
    status === 'active' || status === 'grace_period' ? '1' : '0',
  )
}

/**
 * Set the overage cap in Redis.
 */
export const setOverageCap = async (orgId: string, capCents: number) => {
  const redis = getRedis()
  await redis.set(keys.overageCap(orgId), capCents.toString())
}

/**
 * Get the org status from Redis.
 */
export const getOrgStatus = async (orgId: string): Promise<string | null> => {
  const redis = getRedis()
  return await redis.get(keys.status(orgId))
}

/**
 * Reset Redis counters for a new cycle.
 */
export const resetCycleCounters = async (
  orgId: string,
  includedMinutes: number,
  ttlSeconds: number,
) => {
  const redis = getRedis()
  const pipeline = redis.pipeline()

  pipeline.set(keys.minutes(orgId), 0, 'EX', ttlSeconds)
  pipeline.set(keys.included(orgId), includedMinutes, 'EX', ttlSeconds)
  pipeline.set(keys.overage(orgId), 0, 'EX', ttlSeconds)
  pipeline.set(keys.overageAmount(orgId), 0, 'EX', ttlSeconds)
  pipeline.set(
    keys.cycleStart(orgId),
    new Date().toISOString(),
    'EX',
    ttlSeconds,
  )

  // Clear alert flags
  pipeline.del(keys.alertSent(orgId, 0.8))
  pipeline.del(keys.alertSent(orgId, 1.0))
  pipeline.del(keys.alertSent(orgId, 1.5))

  await pipeline.exec()
}

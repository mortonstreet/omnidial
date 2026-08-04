import * as usageCycleRepository from '@/repositories/usageCycle.repository'
import * as subscriptionRepository from '@/repositories/subscription.repository'
import * as usageTrackingService from '@/services/usageTracking.service'
import { getPlanUsageConfig } from '@shared/types/src/constants/billing'
import type {
  GetUsageDashboardResponse,
  GetUsageHistoryResponse,
  UsageCycleData,
} from '@shared/types/src/requests/billing'

const toCycleData = (cycle: {
  id: string
  periodStart: Date
  periodEnd: Date
  includedMinutes: number
  usedMinutes: number
  overageMinutes: number
  overageAmountCents: number
  overageRateCents: number
  isCurrent: boolean
  finalized: boolean
}): UsageCycleData => ({
  id: cycle.id,
  periodStart: cycle.periodStart.toISOString(),
  periodEnd: cycle.periodEnd.toISOString(),
  includedMinutes: cycle.includedMinutes,
  usedMinutes: cycle.usedMinutes,
  overageMinutes: cycle.overageMinutes,
  overageAmountCents: cycle.overageAmountCents,
  overageRateCents: cycle.overageRateCents,
  isCurrent: cycle.isCurrent,
  finalized: cycle.finalized,
})

export const getUsageDashboard = async (
  orgId: string,
): Promise<GetUsageDashboardResponse> => {
  // Get subscription for account status and plan info
  const sub = await subscriptionRepository.getSubscriptionByReferenceId(orgId)

  // Get or create current cycle
  let cycle = await usageCycleRepository.findCurrentCycle(orgId)

  if (!cycle && sub) {
    const planConfig = getPlanUsageConfig(sub.plan)
    if (planConfig) {
      cycle = await usageCycleRepository.getOrCreateCurrentCycle(
        orgId,
        sub.id,
        planConfig,
        sub.periodStart || undefined,
        sub.periodEnd || undefined,
      )
    }
  }

  if (!cycle) {
    return {
      cycle: null,
      percentUsed: 0,
      daysRemaining: 0,
      projectedMinutes: 0,
      projectedOverage: false,
      accountStatus: sub?.accountStatus || 'active',
      overageCapCents: sub?.overageCapCents || 1000,
      overageCapHit: sub?.overageCapHit || false,
    }
  }

  // Get real-time usage from Redis (more accurate than Postgres)
  const redisUsage = await usageTrackingService.getCurrentUsage(orgId)
  const usedMinutes = redisUsage?.usedMinutes ?? cycle.usedMinutes

  // Calculate projection
  const now = new Date()
  const cycleStart = new Date(cycle.periodStart)
  const cycleEnd = new Date(cycle.periodEnd)
  const totalDays = Math.max(
    1,
    (cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  const daysPassed = Math.max(
    1,
    (now.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24),
  )
  const daysRemaining = Math.max(
    0,
    Math.ceil((cycleEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
  )

  const dailyRate = usedMinutes / daysPassed
  const projectedMinutes = Math.round(dailyRate * totalDays)

  const percentUsed =
    cycle.includedMinutes > 0
      ? Math.round((usedMinutes / cycle.includedMinutes) * 100)
      : 0

  // Build the cycle data with real-time values from Redis
  const cycleData = toCycleData(cycle)
  cycleData.usedMinutes = usedMinutes
  if (redisUsage) {
    cycleData.overageMinutes = redisUsage.overageMinutes
    cycleData.overageAmountCents = redisUsage.overageAmountCents
  }

  return {
    cycle: cycleData,
    percentUsed,
    daysRemaining,
    projectedMinutes,
    projectedOverage: projectedMinutes > cycle.includedMinutes,
    accountStatus: sub?.accountStatus || 'active',
    overageCapCents: sub?.overageCapCents || 1000,
    overageCapHit: sub?.overageCapHit || false,
  }
}

export const getUsageHistory = async (
  orgId: string,
): Promise<GetUsageHistoryResponse> => {
  const cycles = await usageCycleRepository.findHistory(orgId)
  return {
    cycles: cycles.map(toCycleData),
  }
}

export const acknowledgeOverageCap = async (
  orgId: string,
  additionalCapCents: number = 1000,
) => {
  const redis = (await import('@/lib/redis')).getRedis()

  // Set acknowledgment flag with TTL matching cycle end
  const cycle = await usageCycleRepository.findCurrentCycle(orgId)
  if (cycle) {
    const ttl = Math.max(
      3600,
      Math.floor((new Date(cycle.periodEnd).getTime() - Date.now()) / 1000),
    )
    await redis.set(`org:${orgId}:cap_ack`, '1', 'EX', ttl)
  }

  // Bump the cap in Redis
  const currentCapStr = await redis.get(`org:${orgId}:overage_cap`)
  const currentCap = parseInt(currentCapStr || '1000', 10)
  const newCap = currentCap + additionalCapCents
  await redis.set(`org:${orgId}:overage_cap`, newCap.toString())

  // Also update in Postgres via subscription
  const sub = await subscriptionRepository.getSubscriptionByReferenceId(orgId)
  if (sub) {
    const { db } = await import('@/lib/db')
    await db
      .updateTable('subscription')
      .set({ overageCapCents: newCap, overageCapHit: false })
      .where('id', '=', sub.id)
      .execute()
  }

  return { newCapCents: newCap, overageCapHit: false }
}

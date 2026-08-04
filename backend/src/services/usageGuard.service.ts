import { getRedis } from '@/lib/redis'
import logger from '@/lib/logger'
import * as usageTrackingService from '@/services/usageTracking.service'
import * as subscriptionRepository from '@/repositories/subscription.repository'
import { getUserById } from '@/repositories/auth.repository'
import { DAILY_CALL_LIMIT_PER_USER } from '@shared/types/src/constants/billing'
import type { CallGuardResult } from '@shared/types/src/requests/billing'
import { randomUUID } from 'crypto'

const BILLING_GUARD_UNAVAILABLE: CallGuardResult['reason'] =
  'BILLING_GUARD_UNAVAILABLE'

const createGuardUnavailableResult = (
  orgId: string,
  userId: string,
  err: unknown,
): CallGuardResult => {
  const correlationId = randomUUID()

  logger.error(
    { err, orgId, userId, correlationId },
    'Billing guard unavailable; denying call (fail-closed)',
  )

  return {
    allowed: false,
    reason: BILLING_GUARD_UNAVAILABLE,
    retryable: true,
    httpStatus: 503,
    correlationId,
  }
}

/**
 * Check if an org/user is allowed to make a call.
 * Superadmins bypass all checks. For everyone else, checks are performed
 * against Redis first, with Postgres fallback.
 */
export const canMakeCall = async (
  orgId: string,
  userId: string,
): Promise<CallGuardResult> => {
  // Superadmins bypass all billing checks
  try {
    const user = await getUserById(userId)
    if (user?.role === 'superadmin') {
      return { allowed: true, reason: 'ALLOWED' }
    }
  } catch (err) {
    logger.error({ err, orgId, userId }, 'Failed to check superadmin status')
    // Continue with normal checks if lookup fails
  }

  const redis = getRedis()

  try {
    // 1. Check account status
    let status = await redis.get(`org:${orgId}:status`)

    if (!status) {
      // Hydrate from Postgres
      const sub =
        await subscriptionRepository.getSubscriptionByReferenceId(orgId)
      if (!sub) {
        return {
          allowed: false,
          reason: 'NO_ACTIVE_SUBSCRIPTION',
        }
      }
      status = sub.accountStatus || 'active'
      await usageTrackingService.setOrgStatus(orgId, status)
    }

    if (
      status !== 'active' &&
      status !== 'grace_period' &&
      status !== 'suspended' &&
      status !== 'canceled'
    ) {
      return createGuardUnavailableResult(
        orgId,
        userId,
        new Error(`Unexpected account status: ${status}`),
      )
    }

    if (status === 'suspended') {
      return { allowed: false, reason: 'ACCOUNT_SUSPENDED' }
    }

    if (status === 'canceled') {
      return { allowed: false, reason: 'ACCOUNT_CANCELED' }
    }

    // 2. Check can_call flag
    const canCall = await redis.get(`org:${orgId}:can_call`)
    if (canCall === '0') {
      return { allowed: false, reason: 'ACCOUNT_SUSPENDED' }
    }

    // 3. Check overage cap
    const [overageAmountStr, overageCapStr] = await Promise.all([
      redis.get(`org:${orgId}:overage_amount`),
      redis.get(`org:${orgId}:overage_cap`),
    ])

    const overageAmount = parseInt(overageAmountStr || '0', 10)
    const overageCap = parseInt(overageCapStr || '1000', 10) // Default $10

    // Also check if cap acknowledgment flag exists
    const capAck = await redis.exists(`org:${orgId}:cap_ack`)

    if (overageAmount >= overageCap && !capAck) {
      const usage = await usageTrackingService.getCurrentUsage(orgId)
      return {
        allowed: false,
        reason: 'OVERAGE_CAP_HIT',
        minutesUsed: usage?.usedMinutes,
        minutesIncluded: usage?.includedMinutes,
        overageAmountCents: overageAmount,
        overageCapCents: overageCap,
      }
    }

    // 4. Check daily call limit (per user)
    const dailyCount = await usageTrackingService.getDailyCallCount(
      orgId,
      userId,
    )
    if (dailyCount >= DAILY_CALL_LIMIT_PER_USER) {
      return { allowed: false, reason: 'DAILY_LIMIT_REACHED' }
    }

    // All checks passed
    const usage = await usageTrackingService.getCurrentUsage(orgId)
    return {
      allowed: true,
      reason: 'ALLOWED',
      minutesUsed: usage?.usedMinutes,
      minutesIncluded: usage?.includedMinutes,
      overageAmountCents: overageAmount,
      overageCapCents: overageCap,
    }
  } catch (err) {
    return createGuardUnavailableResult(orgId, userId, err)
  }
}

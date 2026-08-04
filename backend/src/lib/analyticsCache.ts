import { getRedis } from './redis'
import logger from './logger'

// Cache key patterns
export const ANALYTICS_CACHE_KEYS = {
  repProfile: (orgId: string, userId: string, period: string) =>
    `analytics:rep:${orgId}:${userId}:${period}`,
  campaignTimeOfDay: (orgId: string, campaignId: string, period: string) =>
    `analytics:campaign:tod:${orgId}:${campaignId}:${period}`,
}

// TTL strategy based on period (in seconds)
export const CACHE_TTL = {
  today: 60, // 1 minute - most frequently changing
  week: 300, // 5 minutes - moderate freshness
  month: 900, // 15 minutes - less frequently changing
  '90d': 1800, // 30 minutes - less frequently changing
} as const

/**
 * Get cached analytics data
 */
export async function getCached<T>(
  key: string,
): Promise<{ data: T; hit: boolean } | null> {
  try {
    const redis = getRedis()
    const cached = await redis.get(key)

    if (cached) {
      logger.debug({ key }, 'Analytics cache HIT')
      return { data: JSON.parse(cached) as T, hit: true }
    }

    logger.debug({ key }, 'Analytics cache MISS')
    return null
  } catch (error) {
    logger.error({ key, error }, 'Analytics cache get failed')
    return null
  }
}

/**
 * Set cached analytics data
 */
export async function setCache<T>(
  key: string,
  data: T,
  ttl: number,
): Promise<boolean> {
  try {
    const redis = getRedis()
    await redis.setex(key, ttl, JSON.stringify(data))
    logger.debug({ key, ttl }, 'Analytics cache SET')
    return true
  } catch (error) {
    logger.error({ key, error }, 'Analytics cache set failed')
    return false
  }
}

/**
 * Invalidate rep analytics cache (all periods)
 */
export async function invalidateRepAnalytics(
  orgId: string,
  userId: string,
): Promise<boolean> {
  try {
    const redis = getRedis()
    const patterns = ['today', 'week', 'month', '90d'].map((period) =>
      ANALYTICS_CACHE_KEYS.repProfile(orgId, userId, period),
    )

    const deleted = await redis.del(...patterns)
    logger.info({ orgId, userId, deleted }, 'Rep analytics cache invalidated')
    return deleted > 0
  } catch (error) {
    logger.error(
      { orgId, userId, error },
      'Rep analytics cache invalidation failed',
    )
    return false
  }
}

/**
 * Invalidate campaign analytics cache (all periods)
 */
export async function invalidateCampaignAnalytics(
  orgId: string,
  campaignId: string,
): Promise<boolean> {
  try {
    const redis = getRedis()
    const patterns = ['today', 'week', 'month', '90d'].map((period) =>
      ANALYTICS_CACHE_KEYS.campaignTimeOfDay(orgId, campaignId, period),
    )

    const deleted = await redis.del(...patterns)
    logger.info(
      { orgId, campaignId, deleted },
      'Campaign analytics cache invalidated',
    )
    return deleted > 0
  } catch (error) {
    logger.error(
      { orgId, campaignId, error },
      'Campaign analytics cache invalidation failed',
    )
    return false
  }
}

/**
 * Get TTL for a given period
 */
export function getTTL(period: 'today' | 'week' | 'month' | '90d'): number {
  return CACHE_TTL[period] || CACHE_TTL.week
}

/**
 * Wrapper to get or compute analytics with caching
 */
export async function getOrComputeAnalytics<T>(
  key: string,
  period: 'today' | 'week' | 'month' | '90d',
  computeFn: () => Promise<T>,
  forceRefresh = false,
): Promise<{ data: T; fromCache: boolean }> {
  // Check cache first (unless forcing refresh)
  if (!forceRefresh) {
    const cached = await getCached<T>(key)
    if (cached) {
      return { data: cached.data, fromCache: true }
    }
  }

  // Compute fresh data
  const data = await computeFn()

  // Cache the result
  const ttl = getTTL(period)
  await setCache(key, data, ttl)

  return { data, fromCache: false }
}

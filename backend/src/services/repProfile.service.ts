import * as analyticsRepository from '@/repositories/analytics.repository'
import * as twilioConfigRepository from '@/repositories/twilioConfig.repository'
import {
  ANALYTICS_CACHE_KEYS,
  getOrComputeAnalytics,
  invalidateRepAnalytics,
} from '@/lib/analyticsCache'
import type {
  AnalyticsPeriod,
  RepProfileStatsResponse,
  HourlyActivity,
} from '@shared/types/src/requests/repProfile'

export interface GetRepProfileStatsParams {
  organizationId: string
  userId: string
  period: AnalyticsPeriod
  campaignId?: string
  refresh?: boolean
}

/**
 * Calculate date range for a given period
 */
function getDateRangeForPeriod(period: AnalyticsPeriod): {
  startDate: Date
  endDate: Date
} {
  const now = new Date()
  const endDate = new Date(now)
  endDate.setHours(23, 59, 59, 999)

  let startDate: Date

  switch (period) {
    case 'today':
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'month':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 30)
      startDate.setHours(0, 0, 0, 0)
      break
    case '90d':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 90)
      startDate.setHours(0, 0, 0, 0)
      break
    default:
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      startDate.setHours(0, 0, 0, 0)
  }

  return { startDate, endDate }
}

/**
 * Get rep profile stats with AM/PM analytics
 */
export const getRepProfileStats = async (
  params: GetRepProfileStatsParams,
): Promise<{ data: RepProfileStatsResponse | null; fromCache: boolean }> => {
  const { organizationId, userId, period, campaignId, refresh = false } = params

  // Get twilio config for this organization
  const twilioConfig =
    await twilioConfigRepository.findByOrganizationId(organizationId)

  if (!twilioConfig) {
    return { data: null, fromCache: false }
  }

  const cacheKey = ANALYTICS_CACHE_KEYS.repProfile(
    organizationId,
    userId,
    period,
  )
  const { startDate, endDate } = getDateRangeForPeriod(period)

  const filters = {
    twilioConfigId: twilioConfig.id,
    startDate,
    endDate,
    userId,
    campaignId,
  }

  return getOrComputeAnalytics<RepProfileStatsResponse | null>(
    cacheKey,
    period,
    async () => {
      // Fetch all data in parallel
      const [repStats, timeOfDay, hourlyActivity, campaignStats] =
        await Promise.all([
          analyticsRepository.getRepStats(filters),
          analyticsRepository.getTimeOfDayBreakdown(filters),
          analyticsRepository.getHourlyActivity(filters),
          analyticsRepository.getCampaignTimeOfDayStats(filters),
        ])

      if (!repStats) {
        return null
      }

      // Find peak hour (hour with most calls)
      const peakHour = findPeakHour(hourlyActivity)

      // Determine best time of day
      const bestTimeOfDay = determineBestTimeOfDay(timeOfDay)

      return {
        userId: repStats.userId,
        userName: repStats.userName || 'Unknown',
        userImage: repStats.userImage,
        kpis: {
          totalCalls: repStats.totalCalls,
          totalConnects: repStats.totalConnects,
          connectionRate: repStats.connectionRate,
          totalTalkTimeSeconds: repStats.totalTalkTimeSeconds,
          avgCallDurationSeconds: repStats.avgCallDurationSeconds,
          appointments: repStats.appointments,
        },
        timeOfDay: {
          am: timeOfDay.am,
          pm: timeOfDay.pm,
        },
        hourlyActivity,
        peakHour,
        bestTimeOfDay,
        campaignStats: campaignStats.length > 1 ? campaignStats : undefined,
      }
    },
    refresh,
  )
}

/**
 * Find the peak performing hour from hourly activity
 */
function findPeakHour(
  hourlyActivity: HourlyActivity[],
): { hour: number; calls: number; connects: number } | null {
  if (!hourlyActivity.length) return null

  const peak = hourlyActivity.reduce(
    (best, current) => (current.calls > best.calls ? current : best),
    hourlyActivity[0],
  )

  if (peak.calls === 0) return null

  return {
    hour: peak.hour,
    calls: peak.calls,
    connects: peak.connects,
  }
}

/**
 * Determine best time of day based on connection rate and call volume
 */
function determineBestTimeOfDay(
  timeOfDay: analyticsRepository.TimeOfDayBreakdown,
): 'am' | 'pm' | null {
  const { am, pm } = timeOfDay

  // Need at least 5 calls in each period to make a meaningful comparison
  const amHasEnoughData = am.calls >= 5
  const pmHasEnoughData = pm.calls >= 5

  if (!amHasEnoughData && !pmHasEnoughData) {
    return null
  }

  if (!amHasEnoughData) return 'pm'
  if (!pmHasEnoughData) return 'am'

  // Weight by both connection rate and volume
  const amScore = am.connectionRate * Math.log(am.calls + 1)
  const pmScore = pm.connectionRate * Math.log(pm.calls + 1)

  if (amScore > pmScore * 1.1) return 'am' // 10% margin for AM
  if (pmScore > amScore * 1.1) return 'pm' // 10% margin for PM

  // Too close to call
  return null
}

/**
 * Invalidate rep analytics cache (called after call completion)
 */
export const invalidateRepCache = async (
  organizationId: string,
  userId: string,
): Promise<boolean> => {
  return invalidateRepAnalytics(organizationId, userId)
}

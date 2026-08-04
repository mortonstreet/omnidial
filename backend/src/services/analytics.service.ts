import * as analyticsRepository from '@/repositories/analytics.repository'
import * as twilioConfigRepository from '@/repositories/twilioConfig.repository'

export interface GetAnalyticsParams {
  organizationId: string
  startDate: string
  endDate: string
  userId?: string
  campaignId?: string
  clientId?: string
}

/**
 * Get call analytics data for dashboard
 */
export const getCallAnalytics = async (params: GetAnalyticsParams) => {
  // Get twilio config for this organization
  const twilioConfig = await twilioConfigRepository.findByOrganizationId(
    params.organizationId,
  )

  if (!twilioConfig) {
    // Return empty data if no twilio config
    return {
      metrics: {
        totalCalls: 0,
        outboundCalls: 0,
        inboundCalls: 0,
        connectedCalls: 0,
        connectionRate: 0,
        totalTalkTimeSeconds: 0,
        avgCallDurationSeconds: 0,
      },
      dispositionBreakdown: [],
      callsOverTime: [],
    }
  }

  const filters: analyticsRepository.AnalyticsFilters = {
    twilioConfigId: twilioConfig.id,
    startDate: new Date(params.startDate),
    endDate: new Date(params.endDate),
    userId: params.userId,
    campaignId: params.campaignId,
    clientId: params.clientId,
  }

  // Fetch all analytics data in parallel
  const [metrics, dispositionBreakdown, callsOverTime] = await Promise.all([
    analyticsRepository.getCallMetrics(filters),
    analyticsRepository.getDispositionBreakdown(filters),
    analyticsRepository.getCallsOverTime(filters),
  ])

  return {
    metrics,
    dispositionBreakdown,
    callsOverTime,
  }
}

/**
 * Get leaderboard data for dashboard
 */
export const getLeaderboard = async (params: GetAnalyticsParams) => {
  // Get twilio config for this organization
  const twilioConfig = await twilioConfigRepository.findByOrganizationId(
    params.organizationId,
  )

  if (!twilioConfig) {
    return { leaderboard: [] }
  }

  const filters: analyticsRepository.AnalyticsFilters = {
    twilioConfigId: twilioConfig.id,
    startDate: new Date(params.startDate),
    endDate: new Date(params.endDate),
    campaignId: params.campaignId,
    clientId: params.clientId,
  }

  const leaderboard = await analyticsRepository.getLeaderboard(filters)

  return { leaderboard }
}

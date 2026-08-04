import * as analyticsService from '@/services/analytics.service'
import { AuthRequestHandler } from '@/types/handlers'

export interface GetAnalyticsRequest {
  organizationId: string
  startDate: string
  endDate: string
  userId?: string
  campaignId?: string
  clientId?: string
}

/**
 * Get call analytics data (metrics, charts, disposition breakdown)
 */
export const getCallAnalytics: AuthRequestHandler<GetAnalyticsRequest> = async (
  req,
  res,
) => {
  const { organizationId, startDate, endDate, userId, campaignId, clientId } =
    req.validated

  const data = await analyticsService.getCallAnalytics({
    organizationId,
    startDate,
    endDate,
    userId,
    campaignId,
    clientId,
  })

  res.json({ data })
}

/**
 * Get leaderboard data
 */
export const getLeaderboard: AuthRequestHandler<GetAnalyticsRequest> = async (
  req,
  res,
) => {
  const { organizationId, startDate, endDate, campaignId, clientId } =
    req.validated

  const data = await analyticsService.getLeaderboard({
    organizationId,
    startDate,
    endDate,
    campaignId,
    clientId,
  })

  res.json({ data })
}

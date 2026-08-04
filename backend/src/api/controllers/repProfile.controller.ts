import * as repProfileService from '@/services/repProfile.service'
import { AuthRequestHandler } from '@/types/handlers'
import type { GetRepProfileStatsRequest } from '@shared/types/src/requests/repProfile'

/**
 * Get rep profile stats with AM/PM analytics
 */
export const getRepProfileStats: AuthRequestHandler<
  GetRepProfileStatsRequest
> = async (req, res) => {
  const {
    organizationId,
    userId,
    period = 'week',
    campaignId,
    refresh,
  } = req.validated

  const { data, fromCache } = await repProfileService.getRepProfileStats({
    organizationId,
    userId,
    period,
    campaignId,
    refresh: refresh === true,
  })

  // Set cache headers
  res.set('X-Cache', fromCache ? 'HIT' : 'MISS')

  if (!data) {
    return res.status(404).json({
      error: 'Rep profile not found or no call data available',
    })
  }

  res.json({ data })
}

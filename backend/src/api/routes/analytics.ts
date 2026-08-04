import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  getCallAnalytics,
  getLeaderboard,
} from '@/api/controllers/analytics.controller'
import { GetAnalyticsRequestSchema } from '@shared/types/src'

const router = Router()

// Get call analytics (metrics, charts, disposition breakdown)
router.get(
  '/:organizationId/calls',
  withBetterAuth,
  validateAndMerge(GetAnalyticsRequestSchema),
  authenticatedRoute(getCallAnalytics),
)

// Get leaderboard
router.get(
  '/:organizationId/leaderboard',
  withBetterAuth,
  validateAndMerge(GetAnalyticsRequestSchema),
  authenticatedRoute(getLeaderboard),
)

export default router

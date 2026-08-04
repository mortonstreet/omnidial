import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import { getRepProfileStats } from '@/api/controllers/repProfile.controller'
import { GetRepProfileStatsRequestSchema } from '@shared/types/src/requests/repProfile'

const router = Router()

// Get rep profile stats with AM/PM analytics
router.get(
  '/:organizationId/:userId/stats',
  withBetterAuth,
  validateAndMerge(GetRepProfileStatsRequestSchema),
  authenticatedRoute(getRepProfileStats),
)

export default router

import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import { getActivity } from '@/api/controllers/activity.controller'
import { GetActivityRequestSchema } from '@shared/types/src'

const router = Router()

router.get(
  '/:organizationId',
  withBetterAuth,
  validateAndMerge(GetActivityRequestSchema),
  authenticatedRoute(getActivity),
)

export default router

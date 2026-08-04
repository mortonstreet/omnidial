import { Router } from 'express'
import {
  getUser,
  getAccount,
  completeOnboarding,
  getOnboardingStatusHandler,
} from '@/api/controllers/user.controller'
import { authenticatedRoute } from './utils'
import { withBetterAuth } from '../middlewares/auth'

const router = Router()

router.get('/me', withBetterAuth, authenticatedRoute<{}>(getUser))

router.get('/account', withBetterAuth, authenticatedRoute<{}>(getAccount))

router.post(
  '/onboarding',
  withBetterAuth,
  authenticatedRoute<{}>(completeOnboarding),
)

router.get(
  '/onboarding-status',
  withBetterAuth,
  authenticatedRoute<{}>(getOnboardingStatusHandler),
)

export default router

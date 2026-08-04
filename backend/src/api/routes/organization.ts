import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import { GetCreditBalanceRequestSchema } from '@shared/types/src'
import {
  getOrganizationCreditBalanceController,
  getOrganizationSubscriptionController,
} from '@/api/controllers/organization.controller'

const router = Router()

router.get(
  '/:organizationId/credit-balance',
  withBetterAuth,
  validateAndMerge(GetCreditBalanceRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getOrganizationCreditBalanceController),
)

router.get(
  '/:organizationId/subscription',
  withBetterAuth,
  validateAndMerge(GetCreditBalanceRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getOrganizationSubscriptionController),
)

export default router

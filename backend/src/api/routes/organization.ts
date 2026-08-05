import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
  validateMemberOfOrganizationIs,
} from '../middlewares/auth'
import {
  GetCreditBalanceRequestSchema,
  UpdateOrganizationRequestSchema,
} from '@shared/types/src'
import { OrganizationRole } from '@shared/types/src/organization'
import {
  getOrganizationCreditBalanceController,
  getOrganizationSubscriptionController,
  updateOrganizationController,
} from '@/api/controllers/organization.controller'

const router = Router()
const adminRoles = [OrganizationRole.OWNER, OrganizationRole.ADMIN]

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

router.patch(
  '/:organizationId',
  withBetterAuth,
  validateAndMerge(UpdateOrganizationRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(updateOrganizationController),
)

export default router

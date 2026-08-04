import { Router } from 'express'
import {
  getStatus,
  searchNumbers,
  setupInfrastructure,
  provisionDedicated,
  provisionQuick,
  verifyCaller,
  checkVerification,
} from '@/api/controllers/phoneProvisioning.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import {
  withBetterAuth,
  validateMemberOfOrganizationIs,
} from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  SearchAvailableNumbersRequestSchema,
  ProvisionPhoneNumberRequestSchema,
} from '@shared/types/src'

const router = Router()

// All routes require authentication
router.use(withBetterAuth)

// Get provisioning status (any authenticated member)
router.get('/status', authenticatedRoute(getStatus))

// Search available numbers (owner only)
router.get(
  '/search',
  validateAndMerge(SearchAvailableNumbersRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(searchNumbers),
)

// Setup subaccount infrastructure (owner only)
router.post(
  '/setup',
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(setupInfrastructure),
)

// Provision selected number (owner only)
router.post(
  '/provision',
  validateAndMerge(ProvisionPhoneNumberRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(provisionDedicated),
)

// Quick-provision a random number (owner only)
router.post(
  '/provision/quick',
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(provisionQuick),
)

// Verify caller ID (any authenticated member)
router.post('/verify', authenticatedRoute(verifyCaller))

// Check verification status (any authenticated member)
router.get('/verify/status', authenticatedRoute(checkVerification))

export default router

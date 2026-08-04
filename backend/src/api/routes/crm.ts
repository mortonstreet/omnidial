import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import { withBetterAuth, validateActiveOrganization } from '../middlewares/auth'
import {
  CrmPushRequestSchema,
  CrmPresenceRequestSchema,
  CrmTestRequestSchema,
  CrmConnectedRequestSchema,
} from '@shared/types/src/requests/crmSync'
import {
  pushToCrm,
  getCrmPresence,
  listConnectedCrms,
  testCrmConnection,
} from '@/api/controllers/crm.controller'

const router = Router()

// List connected CRMs for org
router.get(
  '/connected',
  withBetterAuth,
  validateAndMerge(CrmConnectedRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(listConnectedCrms),
)

// Push lead to CRM
router.post(
  '/push',
  withBetterAuth,
  validateAndMerge(CrmPushRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(pushToCrm),
)

// Check lead presence in CRMs
router.get(
  '/presence',
  withBetterAuth,
  validateAndMerge(CrmPresenceRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(getCrmPresence),
)

// Test CRM connection
router.post(
  '/test',
  withBetterAuth,
  validateAndMerge(CrmTestRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(testCrmConnection),
)

export default router

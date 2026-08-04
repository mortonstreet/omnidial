import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import { withBetterAuth, validateActiveOrganization } from '../middlewares/auth'
import {
  CheckLeadRequestSchema,
  QuickContextRequestSchema,
  ExtensionEnrichRequestSchema,
  GetLeadsRequestSchema,
  ExtensionCrmPushRequestSchema,
  ExtensionCrmPresenceRequestSchema,
  ExtensionCrmConnectedRequestSchema,
  CreateListFromLinkedInSelectionRequestSchema,
  ExtensionListBulkEnrichRequestSchema,
  ExtensionJobStatusRequestSchema,
  ExtensionListBulkPushCrmRequestSchema,
} from '@shared/types/src/requests/extension'
import {
  getSession,
  checkLead,
  getQuickContext,
  enrichLead,
  getLeads,
  createListFromLinkedInSelection,
  enqueueListBulkEnrich,
  getJobStatus,
  bulkPushListToCrm,
} from '@/api/controllers/extension.controller'
import {
  pushToCrm,
  getCrmPresence,
  listConnectedCrms,
} from '@/api/controllers/crm.controller'

const router = Router()

// Session check - lightweight auth verification
router.get('/session', withBetterAuth, authenticatedRoute(getSession))

// Check if lead exists by LinkedIn URL
router.get(
  '/check-lead',
  withBetterAuth,
  validateAndMerge(CheckLeadRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(checkLead),
)

// Get quick context (clients, campaigns, phone numbers)
router.get(
  '/quick-context',
  withBetterAuth,
  validateAndMerge(QuickContextRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(getQuickContext),
)

// Create lead and enrich from LinkedIn
router.post(
  '/enrich',
  withBetterAuth,
  validateAndMerge(ExtensionEnrichRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(enrichLead),
)

// Get paginated leads for lead browser
router.get(
  '/leads',
  withBetterAuth,
  validateAndMerge(GetLeadsRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(getLeads),
)

// Create a lead list from LinkedIn selections
router.post(
  '/lists/create-from-linkedin-selection',
  withBetterAuth,
  validateAndMerge(CreateListFromLinkedInSelectionRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(createListFromLinkedInSelection),
)

// Queue async bulk enrichment for all leads in a list
router.post(
  '/lists/:id/bulk-enrich',
  withBetterAuth,
  validateAndMerge(ExtensionListBulkEnrichRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(enqueueListBulkEnrich),
)

// Check async bulk job status
router.get(
  '/jobs/:jobId',
  withBetterAuth,
  validateAndMerge(ExtensionJobStatusRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(getJobStatus),
)

// Bulk push all list leads to CRM
router.post(
  '/lists/:id/bulk-push-crm',
  withBetterAuth,
  validateAndMerge(ExtensionListBulkPushCrmRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(bulkPushListToCrm),
)

// CRM convenience endpoints for extension
router.get(
  '/crm-presence',
  withBetterAuth,
  validateAndMerge(ExtensionCrmPresenceRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(getCrmPresence),
)

router.post(
  '/push-to-crm',
  withBetterAuth,
  validateAndMerge(ExtensionCrmPushRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(pushToCrm),
)

router.get(
  '/connected-crms',
  withBetterAuth,
  validateAndMerge(ExtensionCrmConnectedRequestSchema),
  validateActiveOrganization,
  authenticatedRoute(listConnectedCrms),
)

export default router

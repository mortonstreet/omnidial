import { Router } from 'express'
import {
  listContactMethods,
  createContactMethod,
  updateContactMethod,
  deleteContactMethod,
} from '@/api/controllers/leadContactMethod.controller'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  ListLeadsRequestSchema,
  GetLeadRequestSchema,
  CreateLeadRequestSchema,
  UpdateLeadRequestSchema,
  DeleteLeadRequestSchema,
  MoveLeadRequestSchema,
  LookupLeadRequestSchema,
  BulkCreateLeadsRequestSchema,
  SmartQueryRequestSchema,
  BulkAddToCampaignRequestSchema,
  BulkAddToPipelineRequestSchema,
  GetLeadActivityRequestSchema,
  GetLeadCallsRequestSchema,
  GenerateCompanySummaryRequestSchema,
  ListContactMethodsRequestSchema,
  CreateContactMethodRequestSchema,
  UpdateContactMethodRequestSchema,
  DeleteContactMethodRequestSchema,
} from '@shared/types/src'
import {
  listLeads,
  getLead,
  createLead,
  updateLead,
  deleteLead,
  moveLead,
  lookupLead,
  bulkCreateLeads,
  smartQuery,
  bulkAddToCampaign,
  bulkAddToPipeline,
  getLeadActivity,
  getLeadCalls,
  generateCompanySummary,
  enrichLeadFromWebsite,
} from '@/api/controllers/lead.controller'

const router = Router()

// Lookup lead by phone (for inbound matching)
router.get(
  '/lookup',
  withBetterAuth,
  validateAndMerge(LookupLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(lookupLead),
)

// List leads for an organization
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listLeads),
)

// Get single lead
router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getLead),
)

// Get lead activity timeline
router.get(
  '/:id/activity',
  withBetterAuth,
  validateAndMerge(GetLeadActivityRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getLeadActivity),
)

// Get lead call history with recordings
router.get(
  '/:id/calls',
  withBetterAuth,
  validateAndMerge(GetLeadCallsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getLeadCalls),
)

// Generate AI company summary for a lead
router.post(
  '/:id/company-summary',
  withBetterAuth,
  validateAndMerge(GenerateCompanySummaryRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(generateCompanySummary),
)

// Enrich lead with company info extracted from website (AI)
router.post(
  '/:id/enrich-from-website',
  withBetterAuth,
  validateAndMerge(GenerateCompanySummaryRequestSchema), // Reusing same schema
  validateMemberOfOrganization,
  authenticatedRoute(enrichLeadFromWebsite),
)

// Create lead
router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(createLead),
)

// Bulk create leads (for CSV import)
router.post(
  '/bulk',
  withBetterAuth,
  validateAndMerge(BulkCreateLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(bulkCreateLeads),
)

// Smart query: Parse natural language and return matching leads
router.post(
  '/smart-query',
  withBetterAuth,
  validateAndMerge(SmartQueryRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(smartQuery),
)

// Bulk add existing leads to a campaign
router.post(
  '/bulk-add-to-campaign',
  withBetterAuth,
  validateAndMerge(BulkAddToCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(bulkAddToCampaign),
)

// Bulk add existing leads to a pipeline stage
router.post(
  '/bulk-add-to-pipeline',
  withBetterAuth,
  validateAndMerge(BulkAddToPipelineRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(bulkAddToPipeline),
)

// Update lead
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateLead),
)

// Move lead to different pipeline stage (CRM)
router.patch(
  '/:id/move',
  withBetterAuth,
  validateAndMerge(MoveLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(moveLead),
)

// Delete lead (soft delete)
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteLead),
)

// === Additional contact methods (office line, mobile, secondary email) ===

router.get(
  '/:leadId/contact-methods',
  withBetterAuth,
  validateAndMerge(ListContactMethodsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listContactMethods),
)

router.post(
  '/:leadId/contact-methods',
  withBetterAuth,
  validateAndMerge(CreateContactMethodRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(createContactMethod),
)

router.patch(
  '/contact-methods/:id',
  withBetterAuth,
  validateAndMerge(UpdateContactMethodRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateContactMethod),
)

router.delete(
  '/contact-methods/:id',
  withBetterAuth,
  validateAndMerge(DeleteContactMethodRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteContactMethod),
)

export default router

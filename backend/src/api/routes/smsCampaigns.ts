import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  ListSmsCampaignsRequestSchema,
  GetSmsCampaignRequestSchema,
  CreateSmsCampaignRequestSchema,
  UpdateSmsCampaignRequestSchema,
  DeleteSmsCampaignRequestSchema,
  ActivateSmsCampaignRequestSchema,
  PauseSmsCampaignRequestSchema,
  AddSmsCampaignStepRequestSchema,
  UpdateSmsCampaignStepRequestSchema,
  DeleteSmsCampaignStepRequestSchema,
  AttachSmsCampaignListRequestSchema,
  DetachSmsCampaignListRequestSchema,
  ListSmsCampaignEnrollmentsRequestSchema,
  EnrollLeadsRequestSchema,
  EnrollFromListRequestSchema,
  UnenrollLeadRequestSchema,
  GetSmsCampaignStatsRequestSchema,
} from '@shared/types/src'
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  activateCampaign,
  pauseCampaign,
  addStep,
  updateStep,
  deleteStep,
  attachList,
  detachList,
  listEnrollments,
  enrollLeads,
  enrollFromList,
  unenrollLead,
  getStats,
} from '@/api/controllers/smsCampaign.controller'

const router = Router()

// ============================================
// Campaign CRUD
// ============================================

// List campaigns
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListSmsCampaignsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listCampaigns),
)

// Get single campaign
router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetSmsCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getCampaign),
)

// Create campaign
router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateSmsCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(createCampaign),
)

// Update campaign
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateSmsCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateCampaign),
)

// Delete campaign
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteSmsCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteCampaign),
)

// ============================================
// Campaign Actions
// ============================================

// Activate campaign
router.post(
  '/:id/activate',
  withBetterAuth,
  validateAndMerge(ActivateSmsCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(activateCampaign),
)

// Pause campaign
router.post(
  '/:id/pause',
  withBetterAuth,
  validateAndMerge(PauseSmsCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(pauseCampaign),
)

// ============================================
// Campaign Steps
// ============================================

// Add step
router.post(
  '/:id/steps',
  withBetterAuth,
  validateAndMerge(AddSmsCampaignStepRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(addStep),
)

// Update step
router.patch(
  '/:id/steps/:stepId',
  withBetterAuth,
  validateAndMerge(UpdateSmsCampaignStepRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateStep),
)

// Delete step
router.delete(
  '/:id/steps/:stepId',
  withBetterAuth,
  validateAndMerge(DeleteSmsCampaignStepRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteStep),
)

// ============================================
// Campaign Lists
// ============================================

// Attach list
router.post(
  '/:id/lists',
  withBetterAuth,
  validateAndMerge(AttachSmsCampaignListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(attachList),
)

// Detach list
router.delete(
  '/:id/lists/:listId',
  withBetterAuth,
  validateAndMerge(DetachSmsCampaignListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(detachList),
)

// ============================================
// Enrollments
// ============================================

// List enrollments
router.get(
  '/:id/enrollments',
  withBetterAuth,
  validateAndMerge(ListSmsCampaignEnrollmentsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listEnrollments),
)

// Enroll specific leads
router.post(
  '/:id/enrollments',
  withBetterAuth,
  validateAndMerge(EnrollLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(enrollLeads),
)

// Enroll from list
router.post(
  '/:id/enrollments/from-list',
  withBetterAuth,
  validateAndMerge(EnrollFromListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(enrollFromList),
)

// Unenroll
router.delete(
  '/:id/enrollments/:enrollmentId',
  withBetterAuth,
  validateAndMerge(UnenrollLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(unenrollLead),
)

// ============================================
// Stats
// ============================================

// Get campaign stats
router.get(
  '/:id/stats',
  withBetterAuth,
  validateAndMerge(GetSmsCampaignStatsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getStats),
)

export default router

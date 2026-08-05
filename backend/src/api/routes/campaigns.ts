import { Router } from 'express'
import multer from 'multer'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
  validateMemberOfOrganizationIs,
} from '../middlewares/auth'
import { OrganizationRole } from '@shared/types/src/organization'
import {
  ListCampaignsRequestSchema,
  GetCampaignRequestSchema,
  CreateCampaignRequestSchema,
  UpdateCampaignRequestSchema,
  DeleteCampaignRequestSchema,
  AssignLeadsRequestSchema,
  GetCampaignLeadsRequestSchema,
  UploadCsvRequestSchema,
} from '@shared/types/src'
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  assignLeads,
  getCampaignLeads,
  uploadCsv,
} from '@/api/controllers/campaign.controller'

const router = Router()
const adminRoles = [OrganizationRole.OWNER, OrganizationRole.ADMIN]

// Configure multer for CSV uploads (10MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// List campaigns for an organization
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListCampaignsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listCampaigns),
)

// Get single campaign
router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getCampaign),
)

// Create campaign
router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateCampaignRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(createCampaign),
)

// Update campaign
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateCampaignRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(updateCampaign),
)

// Delete campaign
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteCampaignRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(deleteCampaign),
)

// Assign leads round-robin
router.post(
  '/:id/assign',
  withBetterAuth,
  validateAndMerge(AssignLeadsRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(assignLeads),
)

// Get campaign leads
router.get(
  '/:id/leads',
  withBetterAuth,
  validateAndMerge(GetCampaignLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getCampaignLeads),
)

// Upload CSV to campaign
router.post(
  '/:id/upload',
  withBetterAuth,
  upload.single('file'),
  validateAndMerge(UploadCsvRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(uploadCsv),
)

export default router

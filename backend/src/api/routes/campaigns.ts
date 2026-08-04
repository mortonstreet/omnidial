import { Router } from 'express'
import multer from 'multer'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
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
  validateMemberOfOrganization,
  authenticatedRoute(createCampaign),
)

// Update campaign
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateCampaign),
)

// Delete campaign
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteCampaign),
)

// Assign leads round-robin
router.post(
  '/:id/assign',
  withBetterAuth,
  validateAndMerge(AssignLeadsRequestSchema),
  validateMemberOfOrganization,
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
  validateMemberOfOrganization,
  authenticatedRoute(uploadCsv),
)

export default router

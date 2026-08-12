import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  ListDncRequestSchema,
  MarkLeadsDncRequestSchema,
  RemoveCampaignLeadsRequestSchema,
  UnmarkDncRequestSchema,
} from '@shared/types/src/requests/dnc'
import {
  listDnc,
  markLeadsDnc,
  removeCampaignLeads,
  unmarkDnc,
} from '@/api/controllers/dnc.controller'

const router = Router()

router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListDncRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listDnc),
)

// Suppress leads and pull them out of anything that would dial them
router.post(
  '/mark',
  withBetterAuth,
  validateAndMerge(MarkLeadsDncRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(markLeadsDnc),
)

router.post(
  '/unmark',
  withBetterAuth,
  validateAndMerge(UnmarkDncRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(unmarkDnc),
)

// Plain removal from a campaign - the lead record and its history survive
router.post(
  '/remove-campaign-leads',
  withBetterAuth,
  validateAndMerge(RemoveCampaignLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(removeCampaignLeads),
)

export default router

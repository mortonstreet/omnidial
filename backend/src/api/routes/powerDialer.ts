import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  GetPowerDialerProgressRequestSchema,
  UpdatePowerDialerProgressRequestSchema,
  GetNextLeadRequestSchema,
  SkipLeadRequestSchema,
  StartPowerDialerRequestSchema,
  StopPowerDialerRequestSchema,
} from '@shared/types/src'
import {
  getProgress,
  updateProgress,
  getNextLead,
  skipLead,
  startSession,
  stopSession,
  advanceToNext,
  goToPrevious,
} from '@/api/controllers/powerDialer.controller'

const router = Router()

// Get power dialer progress
router.get(
  '/progress',
  withBetterAuth,
  validateAndMerge(GetPowerDialerProgressRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getProgress),
)

// Update power dialer progress
router.post(
  '/progress',
  withBetterAuth,
  validateAndMerge(UpdatePowerDialerProgressRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateProgress),
)

// Start power dialer session
router.post(
  '/start',
  withBetterAuth,
  validateAndMerge(StartPowerDialerRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(startSession),
)

// Stop power dialer session
router.post(
  '/stop',
  withBetterAuth,
  validateAndMerge(StopPowerDialerRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(stopSession),
)

// Get next lead in power dialer queue
router.get(
  '/next-lead',
  withBetterAuth,
  validateAndMerge(GetNextLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getNextLead),
)

// Skip current lead
router.post(
  '/skip',
  withBetterAuth,
  validateAndMerge(SkipLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(skipLead),
)

// Advance to next (after completing a call)
router.post(
  '/advance',
  withBetterAuth,
  validateAndMerge(SkipLeadRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(advanceToNext),
)

// Go to previous lead
router.post(
  '/previous',
  withBetterAuth,
  validateAndMerge(SkipLeadRequestSchema), // Same schema as skip
  validateMemberOfOrganization,
  authenticatedRoute(goToPrevious),
)

export default router

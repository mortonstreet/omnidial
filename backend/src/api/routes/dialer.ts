import { Router } from 'express'
import {
  getTwilioConfig,
  createTwilioConfig,
  updateTwilioConfig,
  getCapabilityToken,
  listPhoneNumbers,
  listPhoneNumbersWithAssignments,
  assignPhoneNumber,
  unassignPhoneNumber,
  getDialablePhoneNumbers,
  startDialerSession,
  endDialerSession,
  getActiveSessions,
  getMyActiveSession,
} from '@/api/controllers/dialer.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import {
  withBetterAuth,
  validateMemberOfOrganization,
  validateMemberOfOrganizationIs,
} from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  GetTwilioConfigRequestSchema,
  CreateTwilioConfigRequestSchema,
  UpdateTwilioConfigRequestSchema,
  GetCapabilityTokenRequestSchema,
  ListPhoneNumberAssignmentsRequestSchema,
  AssignPhoneNumberRequestSchema,
  UnassignPhoneNumberRequestSchema,
  GetDialablePhoneNumbersRequestSchema,
  StartDialerSessionRequestSchema,
  EndDialerSessionRequestSchema,
  GetActiveSessionsRequestSchema,
} from '@shared/types/src'

const router = Router()

// All routes require authentication
router.use(withBetterAuth)

// Get Twilio config for organization (returns limited data for non-admins)
router.get(
  '/config/:organizationId',
  validateAndMerge(GetTwilioConfigRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getTwilioConfig),
)

// Create Twilio config (owner only)
router.post(
  '/config',
  validateAndMerge(CreateTwilioConfigRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(createTwilioConfig),
)

// Update Twilio config (owner only)
router.patch(
  '/config/:organizationId',
  validateAndMerge(UpdateTwilioConfigRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(updateTwilioConfig),
)

// List phone numbers from Twilio account (owner only)
router.get(
  '/phone-numbers/:organizationId',
  validateAndMerge(GetTwilioConfigRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(listPhoneNumbers),
)

// === Client Phone Number Assignment Routes ===

// List all phone numbers with their client assignments (owner only)
router.get(
  '/phone-numbers/:organizationId/assignments',
  validateAndMerge(ListPhoneNumberAssignmentsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(listPhoneNumbersWithAssignments),
)

// Assign phone number to client (owner only)
router.post(
  '/phone-numbers/assign',
  validateAndMerge(AssignPhoneNumberRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(assignPhoneNumber),
)

// Unassign phone number (owner only)
router.delete(
  '/phone-numbers/:organizationId/assign/:phoneNumber',
  validateAndMerge(UnassignPhoneNumberRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(unassignPhoneNumber),
)

// Get dialable phone numbers for a client (all members)
router.get(
  '/phone-numbers/:organizationId/dialable/:clientId',
  validateAndMerge(GetDialablePhoneNumbersRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getDialablePhoneNumbers),
)

// Get capability token for browser calling
router.get(
  '/token',
  validateAndMerge(GetCapabilityTokenRequestSchema),
  authenticatedRoute(getCapabilityToken),
)

// === Active Dialer Session Routes ===

// Start a dialer session (notifies managers)
router.post(
  '/sessions',
  validateAndMerge(StartDialerSessionRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(startDialerSession),
)

// End a dialer session
router.post(
  '/sessions/:sessionId/end',
  validateAndMerge(EndDialerSessionRequestSchema),
  authenticatedRoute(endDialerSession),
)

// Get active sessions for organization (owner only)
router.get(
  '/sessions/:organizationId',
  validateAndMerge(GetActiveSessionsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getActiveSessions),
)

// Get my active session
router.get('/sessions/me', authenticatedRoute(getMyActiveSession))

export default router

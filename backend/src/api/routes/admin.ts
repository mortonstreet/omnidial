import { Router } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { adminOnlyRoute } from './utils'
import { adminRateLimit } from '../middlewares/rateLimiterMiddleware'
import {
  getAdminStats,
  getAdminUsers,
  getAdminOrganizations,
  addOrganizationCredits,
  findLeadsByCustomField,
  bulkHardDeleteLeads,
  findDuplicateLeads,
  resolveDuplicateLeads,
  deleteUser,
  deleteOrganization,
  reassignUser,
  createOrganization,
  removeUserFromOrganization,
  getOrganizationMembers,
  switchOrg,
  provisionOrganization,
  markOrganizationMainAccount,
  releaseOrganizationNumber,
} from '@/api/controllers/admin.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import {
  AddOrganizationCreditsRequestSchema,
  AddOrganizationCreditsRequest,
  FindLeadsByCustomFieldRequestSchema,
  FindLeadsByCustomFieldRequest,
  BulkHardDeleteLeadsRequestSchema,
  BulkHardDeleteLeadsRequest,
  FindDuplicateLeadsRequestSchema,
  FindDuplicateLeadsRequest,
  ResolveDuplicateLeadsRequestSchema,
  ResolveDuplicateLeadsRequest,
  DeleteUserRequestSchema,
  DeleteUserRequest,
  DeleteOrganizationRequestSchema,
  DeleteOrganizationRequest,
  ReassignUserRequestSchema,
  ReassignUserRequest,
  CreateOrganizationRequestSchema,
  CreateOrganizationRequest,
  RemoveUserFromOrganizationRequestSchema,
  RemoveUserFromOrganizationRequest,
  GetOrganizationMembersRequestSchema,
  GetOrganizationMembersRequest,
  SwitchOrgRequestSchema,
  SwitchOrgRequest,
  AdminProvisionOrganizationRequestSchema,
  AdminProvisionOrganizationRequest,
  AdminMarkMainAccountRequestSchema,
  AdminMarkMainAccountRequest,
  AdminReleaseNumberRequestSchema,
  AdminReleaseNumberRequest,
  GetErrorLogsRequestSchema,
  GetErrorLogsRequest,
  GetErrorLogDetailRequestSchema,
  GetErrorLogDetailRequest,
  GetErrorLogStatsRequestSchema,
  GetErrorLogStatsRequest,
  UpdateErrorLogStatusRequestSchema,
  UpdateErrorLogStatusRequest,
  GetAdminCallsRequestSchema,
  GetAdminCallsRequest,
  GetAdminCallDetailRequestSchema,
  GetAdminCallDetailRequest,
  GetAdminRecordingsRequestSchema,
  GetAdminRecordingsRequest,
  GetAdminTranscriptionsRequestSchema,
  GetAdminTranscriptionsRequest,
  GetAdminTranscriptionDetailRequestSchema,
  GetAdminTranscriptionDetailRequest,
  GetAdminActivityRequestSchema,
  GetAdminActivityRequest,
} from '@shared/types/src'
import {
  getErrorLogs,
  getErrorLogDetail,
  getErrorLogStats,
  updateErrorLogStatus,
} from '@/api/controllers/errorLog.controller'
import {
  getAdminCalls,
  getAdminCallDetail,
  getAdminRecordings,
  getAdminTranscriptions,
  getAdminTranscriptionDetail,
  getAdminActivity,
} from '@/api/controllers/adminLog.controller'
import { getAdminPhoneProvisioning } from '@/api/controllers/phoneProvisioning.controller'

const router = Router()

// Auth must run before rate limiter so perUser key uses actual user ID
router.use(withBetterAuth, adminRateLimit)

router.get('/stats', adminOnlyRoute<{}>(getAdminStats))
router.get('/users', adminOnlyRoute<{}>(getAdminUsers))
router.get('/organizations', adminOnlyRoute<{}>(getAdminOrganizations))
router.post(
  '/organizations/:organizationId/credits',
  validateAndMerge(AddOrganizationCreditsRequestSchema),
  adminOnlyRoute<AddOrganizationCreditsRequest>(addOrganizationCredits),
)

// Data cleanup endpoints
router.post(
  '/cleanup/find-leads-by-custom-field',
  validateAndMerge(FindLeadsByCustomFieldRequestSchema),
  adminOnlyRoute<FindLeadsByCustomFieldRequest>(findLeadsByCustomField),
)
router.post(
  '/cleanup/bulk-hard-delete-leads',
  validateAndMerge(BulkHardDeleteLeadsRequestSchema),
  adminOnlyRoute<BulkHardDeleteLeadsRequest>(bulkHardDeleteLeads),
)

// Deduplication endpoints
router.post(
  '/cleanup/find-duplicates',
  validateAndMerge(FindDuplicateLeadsRequestSchema),
  adminOnlyRoute<FindDuplicateLeadsRequest>(findDuplicateLeads),
)
router.post(
  '/cleanup/resolve-duplicates',
  validateAndMerge(ResolveDuplicateLeadsRequestSchema),
  adminOnlyRoute<ResolveDuplicateLeadsRequest>(resolveDuplicateLeads),
)

// ============================================================================
// Super Admin User Management
// ============================================================================

// Delete a user
router.delete(
  '/users/:userId',
  validateAndMerge(DeleteUserRequestSchema),
  adminOnlyRoute<DeleteUserRequest>(deleteUser),
)

// Delete an organization
router.delete(
  '/organizations/:organizationId',
  validateAndMerge(DeleteOrganizationRequestSchema),
  adminOnlyRoute<DeleteOrganizationRequest>(deleteOrganization),
)

// Reassign a user to a different organization
router.post(
  '/users/:userId/reassign',
  validateAndMerge(ReassignUserRequestSchema),
  adminOnlyRoute<ReassignUserRequest>(reassignUser),
)

// Create a new organization (super admin only)
router.post(
  '/organizations',
  validateAndMerge(CreateOrganizationRequestSchema),
  adminOnlyRoute<CreateOrganizationRequest>(createOrganization),
)

// Remove a user from an organization
router.delete(
  '/organizations/:organizationId/members/:userId',
  validateAndMerge(RemoveUserFromOrganizationRequestSchema),
  adminOnlyRoute<RemoveUserFromOrganizationRequest>(removeUserFromOrganization),
)

// Get organization members
router.get(
  '/organizations/:organizationId/members',
  validateAndMerge(GetOrganizationMembersRequestSchema),
  adminOnlyRoute<GetOrganizationMembersRequest>(getOrganizationMembers),
)

// Switch active organization (super admin only - virtual access)
router.post(
  '/switch-org',
  validateAndMerge(SwitchOrgRequestSchema),
  adminOnlyRoute<SwitchOrgRequest>(switchOrg),
)

// ============================================================================
// Error Logs
// ============================================================================

// Get error logs (paginated, filterable)
router.get(
  '/error-logs',
  validateAndMerge(GetErrorLogsRequestSchema),
  adminOnlyRoute<GetErrorLogsRequest>(getErrorLogs),
)

// Get error log stats (for trend chart)
router.get(
  '/error-logs/stats',
  validateAndMerge(GetErrorLogStatsRequestSchema),
  adminOnlyRoute<GetErrorLogStatsRequest>(getErrorLogStats),
)

// Get error log detail
router.get(
  '/error-logs/:id',
  validateAndMerge(GetErrorLogDetailRequestSchema),
  adminOnlyRoute<GetErrorLogDetailRequest>(getErrorLogDetail),
)

// Update error log status (acknowledge/resolve)
router.patch(
  '/error-logs/:id/status',
  validateAndMerge(UpdateErrorLogStatusRequestSchema),
  adminOnlyRoute<UpdateErrorLogStatusRequest>(updateErrorLogStatus),
)

// ============================================================================
// Admin Logs (Calls, Recordings, Transcriptions, Activity)
// ============================================================================

// Get all calls (admin view across all orgs)
router.get(
  '/logs/calls',
  validateAndMerge(GetAdminCallsRequestSchema),
  adminOnlyRoute<GetAdminCallsRequest>(getAdminCalls),
)

// Get call detail
router.get(
  '/logs/calls/:id',
  validateAndMerge(GetAdminCallDetailRequestSchema),
  adminOnlyRoute<GetAdminCallDetailRequest>(getAdminCallDetail),
)

// Get all recordings
router.get(
  '/logs/recordings',
  validateAndMerge(GetAdminRecordingsRequestSchema),
  adminOnlyRoute<GetAdminRecordingsRequest>(getAdminRecordings),
)

// Get all transcriptions
router.get(
  '/logs/transcriptions',
  validateAndMerge(GetAdminTranscriptionsRequestSchema),
  adminOnlyRoute<GetAdminTranscriptionsRequest>(getAdminTranscriptions),
)

// Get transcription detail
router.get(
  '/logs/transcriptions/:id',
  validateAndMerge(GetAdminTranscriptionDetailRequestSchema),
  adminOnlyRoute<GetAdminTranscriptionDetailRequest>(
    getAdminTranscriptionDetail,
  ),
)

// Get activity feed
router.get(
  '/logs/activity',
  validateAndMerge(GetAdminActivityRequestSchema),
  adminOnlyRoute<GetAdminActivityRequest>(getAdminActivity),
)

// ============================================================================
// Phone Provisioning
// ============================================================================

router.get('/phone-provisioning', adminOnlyRoute<{}>(getAdminPhoneProvisioning))

// Provision a Twilio subaccount for an organization
router.post(
  '/organizations/:organizationId/provision',
  validateAndMerge(AdminProvisionOrganizationRequestSchema),
  adminOnlyRoute<AdminProvisionOrganizationRequest>(provisionOrganization),
)

// Flag an org as using ISV main account (legacy orgs)
router.post(
  '/organizations/:organizationId/mark-main-account',
  validateAndMerge(AdminMarkMainAccountRequestSchema),
  adminOnlyRoute<AdminMarkMainAccountRequest>(markOrganizationMainAccount),
)

// Release a phone number (keeps subaccount infrastructure)
router.post(
  '/organizations/:organizationId/release-number',
  validateAndMerge(AdminReleaseNumberRequestSchema),
  adminOnlyRoute<AdminReleaseNumberRequest>(releaseOrganizationNumber),
)

export default router

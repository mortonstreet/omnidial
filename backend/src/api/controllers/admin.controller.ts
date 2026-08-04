import { AuthRequestHandler } from '@/types/handlers'
import * as adminService from '@/services/admin.service'
import * as leadService from '@/services/lead.service'
import {
  AdminUsersRequestSchema,
  AdminOrganizationsRequestSchema,
  type AdminUsersResponse,
  type AdminOrganizationsResponse,
  type AdminStats,
  type AddOrganizationCreditsRequest,
  type FindLeadsByCustomFieldRequest,
  type FindLeadsByCustomFieldResponse,
  type BulkHardDeleteLeadsRequest,
  type BulkHardDeleteLeadsResponse,
  type FindDuplicateLeadsRequest,
  type FindDuplicateLeadsResponse,
  type ResolveDuplicateLeadsRequest,
  type ResolveDuplicateLeadsResponse,
  type DeleteUserRequest,
  type DeleteUserResponse,
  type DeleteOrganizationRequest,
  type DeleteOrganizationResponse,
  type ReassignUserRequest,
  type ReassignUserResponse,
  type CreateOrganizationRequest,
  type CreateOrganizationResponse,
  type RemoveUserFromOrganizationRequest,
  type RemoveUserFromOrganizationResponse,
  type GetOrganizationMembersRequest,
  type GetOrganizationMembersResponse,
  type SwitchOrgRequest,
  type SwitchOrgResponse,
  type AdminProvisionOrganizationRequest,
  type AdminMarkMainAccountRequest,
  type AdminReleaseNumberRequest,
} from '@shared/types/src'

export const getAdminStats: AuthRequestHandler<{}> = async (req, res) => {
  const stats = await adminService.getStats()
  const response: AdminStats = stats
  res.json(response)
}

export const getAdminUsers: AuthRequestHandler<{}> = async (req, res) => {
  const params = AdminUsersRequestSchema.parse(req.query)
  const result = await adminService.getUsers(params)
  const response: AdminUsersResponse = result
  res.json(response)
}

export const getAdminOrganizations: AuthRequestHandler<{}> = async (
  req,
  res,
) => {
  const params = AdminOrganizationsRequestSchema.parse(req.query)
  const result = await adminService.getOrganizations(params)
  const response: AdminOrganizationsResponse = result
  res.json(response)
}

export const addOrganizationCredits: AuthRequestHandler<
  AddOrganizationCreditsRequest
> = async (req, res) => {
  const { organizationId, amount, reason } = req.validated
  const result = await adminService.addOrganizationCredits({
    organizationId,
    amount,
    reason,
    addedBy: req.user.id,
    addedByEmail: req.user.email,
  })
  res.json(result)
}

// Data cleanup: Find leads with a specific custom field key (for identifying bad imports)
export const findLeadsByCustomField: AuthRequestHandler<
  FindLeadsByCustomFieldRequest
> = async (req, res) => {
  const { organizationId, customFieldKey } = req.validated
  const leads = await leadService.findLeadsByCustomField({
    organizationId,
    customFieldKey,
  })

  const response: FindLeadsByCustomFieldResponse = {
    leads: leads.map((lead) => ({
      id: lead.id,
      phone: lead.phone,
      customFields:
        typeof lead.customFields === 'string'
          ? JSON.parse(lead.customFields)
          : lead.customFields,
    })),
    count: leads.length,
  }
  res.json(response)
}

// Data cleanup: Bulk hard delete leads (preserves call history)
export const bulkHardDeleteLeads: AuthRequestHandler<
  BulkHardDeleteLeadsRequest
> = async (req, res) => {
  const { organizationId, leadIds } = req.validated
  const result = await adminService.bulkHardDelete({
    organizationId,
    leadIds,
  })

  const response: BulkHardDeleteLeadsResponse = result
  res.json(response)
}

// Data cleanup: Find duplicate leads by normalized phone
export const findDuplicateLeads: AuthRequestHandler<
  FindDuplicateLeadsRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const result = await adminService.findDuplicateLeads(organizationId)

  const response: FindDuplicateLeadsResponse = result
  res.json(response)
}

// Data cleanup: Resolve duplicate leads (keep one, delete others)
export const resolveDuplicateLeads: AuthRequestHandler<
  ResolveDuplicateLeadsRequest
> = async (req, res) => {
  const { organizationId, resolutions } = req.validated
  const result = await adminService.resolveDuplicateLeads({
    organizationId,
    resolutions,
  })

  const response: ResolveDuplicateLeadsResponse = result
  res.json(response)
}

// ============================================================================
// Super Admin User Management
// ============================================================================

export const deleteUser: AuthRequestHandler<DeleteUserRequest> = async (
  req,
  res,
) => {
  const { userId } = req.validated
  const result = await adminService.deleteUser(userId, req.user.id)
  const response: DeleteUserResponse = result
  res.json(response)
}

export const deleteOrganization: AuthRequestHandler<
  DeleteOrganizationRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const result = await adminService.deleteOrganization(
    organizationId,
    req.user.id,
  )
  const response: DeleteOrganizationResponse = result
  res.json(response)
}

export const reassignUser: AuthRequestHandler<ReassignUserRequest> = async (
  req,
  res,
) => {
  const { userId, fromOrganizationId, toOrganizationId, role } = req.validated
  const result = await adminService.reassignUser({
    userId,
    fromOrganizationId,
    toOrganizationId,
    role,
    adminUserId: req.user.id,
  })
  const response: ReassignUserResponse = result
  res.json(response)
}

export const createOrganization: AuthRequestHandler<
  CreateOrganizationRequest
> = async (req, res) => {
  const { name, slug, provisionPhone } = req.validated
  const result = await adminService.createOrganization({
    name,
    slug,
    provisionPhone,
    adminUserId: req.user.id,
  })
  const response: CreateOrganizationResponse = result
  res.json(response)
}

export const removeUserFromOrganization: AuthRequestHandler<
  RemoveUserFromOrganizationRequest
> = async (req, res) => {
  const { organizationId, userId } = req.validated
  const result = await adminService.removeUserFromOrganization(
    organizationId,
    userId,
    req.user.id,
  )
  const response: RemoveUserFromOrganizationResponse = result
  res.json(response)
}

export const getOrganizationMembers: AuthRequestHandler<
  GetOrganizationMembersRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const result = await adminService.getOrganizationMembers(organizationId)
  const response: GetOrganizationMembersResponse = result
  res.json(response)
}

export const switchOrg: AuthRequestHandler<SwitchOrgRequest> = async (
  req,
  res,
) => {
  const { organizationId } = req.validated
  const sessionId = (req.session as any)?.session?.id ?? req.session?.id
  const result = await adminService.switchOrg(
    organizationId,
    req.user.id,
    sessionId,
  )
  const response: SwitchOrgResponse = result
  res.json(response)
}

// ============================================================================
// Phone Provisioning Admin Actions
// ============================================================================

export const provisionOrganization: AuthRequestHandler<
  AdminProvisionOrganizationRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const result = await adminService.provisionOrganization(
    organizationId,
    req.user.id,
  )
  res.json(result)
}

export const markOrganizationMainAccount: AuthRequestHandler<
  AdminMarkMainAccountRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const result = await adminService.markOrganizationMainAccount(
    organizationId,
    req.user.id,
  )
  res.json(result)
}

export const releaseOrganizationNumber: AuthRequestHandler<
  AdminReleaseNumberRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const result = await adminService.releaseOrganizationNumber(
    organizationId,
    req.user.id,
  )
  res.json(result)
}

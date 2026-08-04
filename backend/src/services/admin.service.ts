import * as adminRepository from '@/repositories/admin.repository'
import * as leadRepo from '@/repositories/lead.repository'
import * as authRepository from '@/repositories/auth.repository'
import * as phoneProvisioningService from '@/services/phoneProvisioning.service'
import { logAdminAction } from '@/services/adminAuditLog.service'
import { db } from '@/lib/db'
import logger from '@/lib/logger'
import type {
  DuplicateLead,
  DuplicateGroup,
  FindDuplicateLeadsResponse,
  ResolveDuplicateLeadsResponse,
  SwitchOrgResponse,
} from '@shared/types/src'

export interface GetUsersParams {
  page: number
  limit: number
  search?: string
}

export interface GetOrganizationsParams {
  page: number
  limit: number
  search?: string
}

export interface AddCreditsParams {
  organizationId: string
  amount: number
  reason?: string
  addedBy: string
  addedByEmail: string
}

export const getStats = async () => {
  return adminRepository.getStats()
}

// SUPERADMIN ONLY: Bulk hard delete leads
// This CASCADE deletes from campaign_lead and lead_list_entry
// Call records are preserved (no FK constraint)
export interface BulkHardDeleteParams {
  organizationId: string
  leadIds: string[]
}

export const bulkHardDelete = async (
  params: BulkHardDeleteParams,
): Promise<{ deleted: number }> => {
  const { organizationId, leadIds } = params
  const deleted = await leadRepo.bulkHardDelete(organizationId, leadIds)
  return { deleted }
}

export const getUsers = async (params: GetUsersParams) => {
  const { users, total } = await adminRepository.findUsers(params)
  const totalPages = Math.ceil(total / params.limit)

  return {
    data: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt.toISOString(),
      role: u.role,
      emailVerified: u.emailVerified,
      organizations: u.organizations ? u.organizations.split(', ') : [],
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  }
}

export const getOrganizations = async (params: GetOrganizationsParams) => {
  const { organizations, total } =
    await adminRepository.findOrganizations(params)
  const totalPages = Math.ceil(total / params.limit)

  return {
    data: organizations.map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      createdAt: o.createdAt.toISOString(),
      memberCount: o.memberCount,
      creditBalance: o.creditBalance,
      managedBySuperadmin: o.managedBySuperadmin,
    })),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  }
}

export const addOrganizationCredits = async (params: AddCreditsParams) => {
  await adminRepository.createCreditTransaction(params)
  const newBalance = await adminRepository.getOrganizationCreditBalance(
    params.organizationId,
  )

  await logAdminAction(
    params.addedBy,
    'addOrganizationCredits',
    'organization',
    params.organizationId,
    {
      amount: params.amount,
      reason: params.reason,
      newBalance,
    },
  )

  return {
    success: true,
    newBalance,
  }
}

// Calculate completeness score for a lead
function calculateCompletenessScore(lead: leadRepo.DuplicateLeadData): number {
  let score = 0
  if (lead.firstName) score += 2
  if (lead.lastName) score += 2
  if (lead.email) score += 2
  if (lead.company) score += 1
  if (lead.title) score += 1
  if (lead.linkedInUrl) score += 1
  return score
}

// Find duplicate leads by normalized phone
export const findDuplicateLeads = async (
  organizationId: string,
): Promise<FindDuplicateLeadsResponse> => {
  const duplicateGroups = await leadRepo.findDuplicates(organizationId)

  const groups: DuplicateGroup[] = []
  let totalDuplicates = 0

  for (const [normalizedPhone, leads] of duplicateGroups) {
    // Calculate completeness scores and find recommended lead to keep
    const leadsWithScores: DuplicateLead[] = leads.map((lead) => ({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      normalizedPhone: lead.normalizedPhone,
      company: lead.company,
      title: lead.title,
      linkedInUrl: lead.linkedInUrl,
      createdAt: lead.createdAt.toISOString(),
      completenessScore: calculateCompletenessScore(lead),
    }))

    // Sort by completeness score (desc), then by creation date (asc) for ties
    leadsWithScores.sort((a, b) => {
      if (b.completenessScore !== a.completenessScore) {
        return b.completenessScore - a.completenessScore
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })

    const recommendedKeepId = leadsWithScores[0].id

    groups.push({
      normalizedPhone,
      leads: leadsWithScores,
      recommendedKeepId,
    })

    // Count duplicates (all leads minus the one we'd keep per group)
    totalDuplicates += leadsWithScores.length - 1
  }

  return {
    groups,
    totalDuplicates,
    totalGroups: groups.length,
  }
}

// Resolve duplicate leads by keeping one and deleting others
export interface ResolveDuplicatesParams {
  organizationId: string
  resolutions: {
    normalizedPhone: string
    keepLeadId: string
    deleteLeadIds: string[]
    mergeData: boolean
  }[]
}

export const resolveDuplicateLeads = async (
  params: ResolveDuplicatesParams,
): Promise<ResolveDuplicateLeadsResponse> => {
  const { organizationId, resolutions } = params

  let resolved = 0
  let deleted = 0
  let merged = 0
  const allDeletedIds: string[] = []

  for (const resolution of resolutions) {
    const { keepLeadId, deleteLeadIds, mergeData } = resolution

    // If mergeData is true, merge data from deleted leads into kept lead
    if (mergeData) {
      await leadRepo.mergeLeadData(keepLeadId, deleteLeadIds, organizationId)
      merged++
    }

    // Hard delete the duplicate leads
    // Note: This preserves call history (no FK constraint on calls)
    // but cascades to campaign_lead and lead_list_entry
    const deletedCount = await leadRepo.bulkHardDelete(
      organizationId,
      deleteLeadIds,
    )

    allDeletedIds.push(...deleteLeadIds)
    deleted += deletedCount
    resolved++
  }

  // Audit log: we don't have adminUserId here, but the caller can add it
  // The controller has req.user.id available

  return {
    resolved,
    deleted,
    merged,
  }
}

// ============================================================================
// Super Admin User Management
// ============================================================================

export const deleteUser = async (userId: string, adminUserId?: string) => {
  // Check if user exists
  const user = await adminRepository.getUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  // Prevent deleting super admin users (safety check)
  if (user.role === 'superadmin') {
    throw new Error('Cannot delete super admin users')
  }

  await adminRepository.deleteUser(userId)

  if (adminUserId) {
    await logAdminAction(adminUserId, 'deleteUser', 'user', userId, {
      email: user.email,
    })
  }

  return { success: true, deletedUserId: userId }
}

export const deleteOrganization = async (
  organizationId: string,
  adminUserId?: string,
) => {
  // Check if organization exists
  const org = await adminRepository.getOrganizationById(organizationId)
  if (!org) {
    throw new Error('Organization not found')
  }

  await adminRepository.deleteOrganization(organizationId)

  if (adminUserId) {
    await logAdminAction(
      adminUserId,
      'deleteOrganization',
      'organization',
      organizationId,
      { name: org.name },
    )
  }

  return { success: true, deletedOrganizationId: organizationId }
}

export interface ReassignUserParams {
  userId: string
  fromOrganizationId?: string
  toOrganizationId: string
  role: string
}

export const reassignUser = async (
  params: ReassignUserParams & { adminUserId?: string },
) => {
  const { userId, fromOrganizationId, toOrganizationId, role, adminUserId } =
    params

  // Check if user exists
  const user = await adminRepository.getUserById(userId)
  if (!user) {
    throw new Error('User not found')
  }

  // Check if target organization exists
  const targetOrg = await adminRepository.getOrganizationById(toOrganizationId)
  if (!targetOrg) {
    throw new Error('Target organization not found')
  }

  // Remove from source organization if specified
  if (fromOrganizationId) {
    await adminRepository.removeUserFromOrganization(fromOrganizationId, userId)
  }

  // Check if user is already a member of target organization
  const existingMembership = await adminRepository.checkUserMembership(
    toOrganizationId,
    userId,
  )
  if (existingMembership) {
    throw new Error('User is already a member of the target organization')
  }

  // Add to target organization
  await adminRepository.addUserToOrganization(toOrganizationId, userId, role)

  if (adminUserId) {
    await logAdminAction(adminUserId, 'reassignUser', 'user', userId, {
      fromOrganizationId,
      toOrganizationId,
      role,
    })
  }

  return {
    success: true,
    userId,
    newOrganizationId: toOrganizationId,
    role,
  }
}

export interface CreateOrganizationParams {
  name: string
  slug: string
  provisionPhone?: boolean
}

export const createOrganization = async (
  params: CreateOrganizationParams & { adminUserId?: string },
) => {
  const { name, slug, provisionPhone, adminUserId } = params

  // Check if slug already exists
  const existing = await adminRepository.getOrganizationBySlug(slug)
  if (existing) {
    throw new Error('An organization with this slug already exists')
  }

  const org = await adminRepository.createOrganization(name, slug, true)

  // Admin-created orgs use the main Twilio account (env vars), not subaccounts
  if (provisionPhone !== false) {
    phoneProvisioningService.markAsMainAccount(org.id).catch((err) => {
      logger.error('Failed to set up main account for admin-created org', {
        organizationId: org.id,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  if (adminUserId) {
    await logAdminAction(
      adminUserId,
      'createOrganization',
      'organization',
      org.id,
      { name, slug },
    )
  }

  return {
    success: true,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      createdAt: org.createdAt.toISOString(),
    },
  }
}

export const removeUserFromOrganization = async (
  organizationId: string,
  userId: string,
  adminUserId?: string,
) => {
  // Check if membership exists
  const membership = await adminRepository.checkUserMembership(
    organizationId,
    userId,
  )
  if (!membership) {
    throw new Error('User is not a member of this organization')
  }

  await adminRepository.removeUserFromOrganization(organizationId, userId)

  if (adminUserId) {
    await logAdminAction(
      adminUserId,
      'removeUserFromOrganization',
      'user',
      userId,
      { organizationId },
    )
  }

  return {
    success: true,
    removedUserId: userId,
    organizationId,
  }
}

export const getOrganizationMembers = async (organizationId: string) => {
  // Check if organization exists
  const org = await adminRepository.getOrganizationById(organizationId)
  if (!org) {
    throw new Error('Organization not found')
  }

  const members = await adminRepository.getOrganizationMembers(organizationId)

  return {
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.email,
      name: m.name,
      role: m.role,
      joinedAt: m.joinedAt.toISOString(),
    })),
    organizationId,
    organizationName: org.name,
  }
}

/**
 * Switch the superadmin's active organization (virtual access)
 * Updates the session's activeOrganizationId and the user's lastActiveOrganizationId
 */
export const switchOrg = async (
  organizationId: string,
  userId: string,
  sessionId: string,
): Promise<SwitchOrgResponse> => {
  // Verify org exists
  const org = await adminRepository.getOrganizationById(organizationId)
  if (!org) {
    throw new Error('Organization not found')
  }

  // Update session's activeOrganizationId directly
  await db
    .updateTable('session')
    .set({ activeOrganizationId: organizationId })
    .where('id', '=', sessionId)
    .execute()

  // Update user's lastActiveOrganizationId
  await authRepository.updateUserLastActiveOrganizationId(
    userId,
    organizationId,
  )

  await logAdminAction(userId, 'switchOrg', 'organization', organizationId, {
    organizationName: org.name,
  })

  return {
    success: true,
    organizationId: org.id,
    organizationName: org.name,
  }
}

// ============================================================================
// Phone Provisioning Admin Actions
// ============================================================================

export const provisionOrganization = async (
  organizationId: string,
  adminUserId?: string,
) => {
  const org = await adminRepository.getOrganizationById(organizationId)
  if (!org) {
    throw new Error('Organization not found')
  }

  const result =
    await phoneProvisioningService.setupSubaccountInfrastructure(organizationId)

  if (adminUserId) {
    await logAdminAction(
      adminUserId,
      'provisionOrganization',
      'organization',
      organizationId,
      { name: org.name },
    )
  }

  return { success: true, data: result }
}

export const releaseOrganizationNumber = async (
  organizationId: string,
  adminUserId?: string,
) => {
  const org = await adminRepository.getOrganizationById(organizationId)
  if (!org) {
    throw new Error('Organization not found')
  }

  const result =
    await phoneProvisioningService.adminReleaseNumber(organizationId)

  if (adminUserId) {
    await logAdminAction(
      adminUserId,
      'releaseOrganizationNumber',
      'organization',
      organizationId,
      { name: org.name },
    )
  }

  return result
}

export const markOrganizationMainAccount = async (
  organizationId: string,
  adminUserId?: string,
) => {
  const org = await adminRepository.getOrganizationById(organizationId)
  if (!org) {
    throw new Error('Organization not found')
  }

  await phoneProvisioningService.markAsMainAccount(organizationId)

  // Also flag the org as managed by superadmin
  await db
    .updateTable('organization')
    .set({ managedBySuperadmin: true })
    .where('id', '=', organizationId)
    .execute()

  if (adminUserId) {
    await logAdminAction(
      adminUserId,
      'markOrganizationMainAccount',
      'organization',
      organizationId,
      { name: org.name },
    )
  }

  return { success: true }
}

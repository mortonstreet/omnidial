import * as clientUserAssignmentRepo from '@/repositories/clientUserAssignment.repository'
import * as clientRepo from '@/repositories/client.repository'
import { doesMemberHaveRole } from './organization.service'
import { OrganizationRole } from '@shared/types/src/organization'

const ADMIN_ROLES: OrganizationRole[] = ['owner', 'admin']

export const assignUserToClient = async (params: {
  organizationId: string
  clientId: string
  userId: string
}) => {
  // Check if assignment already exists
  const existing = await clientUserAssignmentRepo.findAssignment(
    params.clientId,
    params.userId,
  )
  if (existing) {
    throw new Error('User is already assigned to this client')
  }

  return clientUserAssignmentRepo.create(params)
}

export const unassignUserFromClient = async (params: {
  clientId: string
  userId: string
}) => {
  const success = await clientUserAssignmentRepo.remove(
    params.clientId,
    params.userId,
  )
  if (!success) {
    throw new Error('Assignment not found')
  }
  return { success: true }
}

export const getAssignedClients = async (
  organizationId: string,
  userId: string,
) => {
  // Check if user is admin/owner - they see all clients
  const isAdmin = await doesMemberHaveRole(userId, organizationId, ADMIN_ROLES)

  if (isAdmin) {
    // Return all clients for admins
    return clientRepo.findByOrganization(organizationId)
  }

  // Return only assigned clients for members
  const clients = await clientUserAssignmentRepo.findClientsForUser(
    organizationId,
    userId,
  )

  // If member has no explicit assignments, fall back to all clients
  // (assignments haven't been configured yet)
  if (clients.length === 0) {
    return clientRepo.findByOrganization(organizationId)
  }

  // Get campaign counts for each client
  const clientsWithCounts = await Promise.all(
    clients.map(async (client) => {
      const campaignCount = await clientRepo.getCampaignCount(client.id)
      return {
        ...client,
        campaignCount,
      }
    }),
  )

  return clientsWithCounts
}

export const getClientAssignments = async (
  organizationId: string,
  clientId: string,
) => {
  return clientUserAssignmentRepo.findByClient(organizationId, clientId)
}

export const getUserAssignments = async (
  organizationId: string,
  userId: string,
) => {
  return clientUserAssignmentRepo.findByUser(organizationId, userId)
}

export const isUserAssignedToClient = async (
  organizationId: string,
  userId: string,
  clientId: string,
): Promise<boolean> => {
  // Admins have access to all clients
  const isAdmin = await doesMemberHaveRole(userId, organizationId, ADMIN_ROLES)
  if (isAdmin) return true

  const assignment = await clientUserAssignmentRepo.findAssignment(
    clientId,
    userId,
  )
  return !!assignment
}

export const isUserAdminOrOwner = async (
  userId: string,
  organizationId: string,
): Promise<boolean> => {
  return doesMemberHaveRole(userId, organizationId, ADMIN_ROLES)
}

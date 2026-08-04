import * as clientUserAssignmentService from '@/services/clientUserAssignment.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  GetMyAssignedClientsRequest,
  GetClientUsersRequest,
  GetUserClientsRequest,
  AssignUserToClientRequest,
  UnassignUserFromClientRequest,
} from '@shared/types/src'

export const getMyAssignedClients: AuthRequestHandler<
  GetMyAssignedClientsRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const userId = req.user.id

  try {
    const clients = await clientUserAssignmentService.getAssignedClients(
      organizationId,
      userId,
    )
    res.json({ data: clients })
  } catch (error) {
    console.error('Failed to get assigned clients:', error)
    res.status(500).json({ error: 'Failed to get assigned clients' })
  }
}

export const getClientUsers: AuthRequestHandler<GetClientUsersRequest> = async (
  req,
  res,
) => {
  const { organizationId, clientId } = req.validated

  try {
    const assignments = await clientUserAssignmentService.getClientAssignments(
      organizationId,
      clientId,
    )
    res.json({ data: assignments })
  } catch (error) {
    console.error('Failed to get client users:', error)
    res.status(500).json({ error: 'Failed to get client users' })
  }
}

export const getUserClients: AuthRequestHandler<GetUserClientsRequest> = async (
  req,
  res,
) => {
  const { organizationId, userId } = req.validated

  try {
    const assignments = await clientUserAssignmentService.getUserAssignments(
      organizationId,
      userId,
    )
    res.json({ data: assignments })
  } catch (error) {
    console.error('Failed to get user clients:', error)
    res.status(500).json({ error: 'Failed to get user clients' })
  }
}

export const assignUserToClient: AuthRequestHandler<
  AssignUserToClientRequest
> = async (req, res) => {
  const { organizationId, clientId, userId } = req.validated

  try {
    const assignment = await clientUserAssignmentService.assignUserToClient({
      organizationId,
      clientId,
      userId,
    })
    res.status(201).json(assignment)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to assign user'
    res.status(400).json({ error: message })
  }
}

export const unassignUserFromClient: AuthRequestHandler<
  UnassignUserFromClientRequest
> = async (req, res) => {
  const { clientId, userId } = req.validated

  try {
    await clientUserAssignmentService.unassignUserFromClient({
      clientId,
      userId,
    })
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'Assignment not found' })
  }
}

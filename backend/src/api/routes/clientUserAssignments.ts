import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
  validateMemberOfOrganizationIs,
} from '../middlewares/auth'
import {
  GetMyAssignedClientsRequestSchema,
  GetClientUsersRequestSchema,
  GetUserClientsRequestSchema,
  AssignUserToClientRequestSchema,
  UnassignUserFromClientRequestSchema,
} from '@shared/types/src'
import {
  getMyAssignedClients,
  getClientUsers,
  getUserClients,
  assignUserToClient,
  unassignUserFromClient,
} from '@/api/controllers/clientUserAssignment.controller'

const router = Router()

// Get assigned clients for current user (role-aware: owners get all, members get assigned only)
router.get(
  '/my-clients',
  withBetterAuth,
  validateAndMerge(GetMyAssignedClientsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getMyAssignedClients),
)

// Get users assigned to a client (owner only)
router.get(
  '/clients/:clientId/users',
  withBetterAuth,
  validateAndMerge(GetClientUsersRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getClientUsers),
)

// Get clients assigned to a user (owner only)
router.get(
  '/users/:userId/clients',
  withBetterAuth,
  validateAndMerge(GetUserClientsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getUserClients),
)

// Assign user to client (owner only)
router.post(
  '/assign',
  withBetterAuth,
  validateAndMerge(AssignUserToClientRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(assignUserToClient),
)

// Unassign user from client (owner only)
router.delete(
  '/clients/:clientId/users/:userId',
  withBetterAuth,
  validateAndMerge(UnassignUserFromClientRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(unassignUserFromClient),
)

export default router

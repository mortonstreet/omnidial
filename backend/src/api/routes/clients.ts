import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
  validateMemberOfOrganizationIs,
} from '../middlewares/auth'
import { OrganizationRole } from '@shared/types/src/organization'
import {
  ListClientsRequestSchema,
  GetClientRequestSchema,
  CreateClientRequestSchema,
  UpdateClientRequestSchema,
  DeleteClientRequestSchema,
} from '@shared/types/src'
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from '@/api/controllers/client.controller'

const router = Router()
const adminRoles = [OrganizationRole.OWNER, OrganizationRole.ADMIN]

// List clients for an organization
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListClientsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listClients),
)

// Get single client
router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetClientRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getClient),
)

// Create client
router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateClientRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(createClient),
)

// Update client
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateClientRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(updateClient),
)

// Delete client
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteClientRequestSchema),
  validateMemberOfOrganizationIs(adminRoles),
  authenticatedRoute(deleteClient),
)

export default router

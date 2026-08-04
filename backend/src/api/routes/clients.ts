import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
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
  validateMemberOfOrganization,
  authenticatedRoute(createClient),
)

// Update client
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateClientRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateClient),
)

// Delete client
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteClientRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteClient),
)

export default router

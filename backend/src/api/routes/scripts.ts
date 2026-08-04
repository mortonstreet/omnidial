import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  ListScriptsRequestSchema,
  GetScriptRequestSchema,
  CreateScriptRequestSchema,
  UpdateScriptRequestSchema,
  DeleteScriptRequestSchema,
} from '@shared/types/src'
import {
  listScripts,
  getScript,
  createScript,
  updateScript,
  deleteScript,
} from '@/api/controllers/script.controller'

const router = Router()

// List scripts for an organization
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListScriptsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listScripts),
)

// Get single script
router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetScriptRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getScript),
)

// Create script
router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateScriptRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(createScript),
)

// Update script
router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateScriptRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateScript),
)

// Delete script
router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteScriptRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteScript),
)

export default router

import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganizationIs,
} from '../middlewares/auth'
import {
  ListApiKeysRequestSchema,
  GetApiKeyRequestSchema,
  CreateApiKeyRequestSchema,
  RevokeApiKeyRequestSchema,
  GetApiKeyUsageRequestSchema,
} from '@shared/types/src'
import {
  listApiKeys,
  getApiKey,
  createApiKey,
  revokeApiKey,
  getApiKeyUsage,
} from '@/api/controllers/apiKey.controller'

const router = Router()

// All routes require owner
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListApiKeysRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(listApiKeys),
)

router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetApiKeyRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getApiKey),
)

router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateApiKeyRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(createApiKey),
)

router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(RevokeApiKeyRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(revokeApiKey),
)

router.get(
  '/:id/usage',
  withBetterAuth,
  validateAndMerge(GetApiKeyUsageRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getApiKeyUsage),
)

export default router

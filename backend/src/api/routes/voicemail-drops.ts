import { Router } from 'express'
import {
  listVoicemailDrops,
  createVoicemailDrop,
  deleteVoicemailDrop,
} from '@/api/controllers/dialer.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { withBetterAuth } from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  ListVoicemailDropsRequestSchema,
  CreateVoicemailDropRequestSchema,
  DeleteVoicemailDropRequestSchema,
} from '@shared/types/src'

const router = Router()

// All routes require authentication
router.use(withBetterAuth)

// List voicemail drops
router.get(
  '/',
  validateAndMerge(ListVoicemailDropsRequestSchema),
  authenticatedRoute(listVoicemailDrops),
)

// Create a new voicemail drop
router.post(
  '/',
  validateAndMerge(CreateVoicemailDropRequestSchema),
  authenticatedRoute(createVoicemailDrop),
)

// Delete a voicemail drop
router.delete(
  '/:id',
  validateAndMerge(DeleteVoicemailDropRequestSchema),
  authenticatedRoute(deleteVoicemailDrop),
)

export default router

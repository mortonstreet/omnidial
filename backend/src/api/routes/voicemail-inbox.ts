import { Router } from 'express'
import {
  listVoicemails,
  markVoicemailRead,
  markAllVoicemailsRead,
} from '@/api/controllers/dialer.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { withBetterAuth } from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  ListVoicemailsRequestSchema,
  MarkVoicemailReadRequestSchema,
  MarkAllVoicemailsReadRequestSchema,
} from '@shared/types/src'

const router = Router()

router.use(withBetterAuth)

// List voicemails
router.get(
  '/',
  validateAndMerge(ListVoicemailsRequestSchema),
  authenticatedRoute(listVoicemails),
)

// Mark a voicemail as read
router.post(
  '/:id/read',
  validateAndMerge(MarkVoicemailReadRequestSchema),
  authenticatedRoute(markVoicemailRead),
)

// Mark all voicemails as read
router.post(
  '/read-all',
  validateAndMerge(MarkAllVoicemailsReadRequestSchema),
  authenticatedRoute(markAllVoicemailsRead),
)

export default router

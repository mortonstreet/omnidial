import { Router } from 'express'
import {
  listVoicemailGreetings,
  createVoicemailGreeting,
  setActiveVoicemailGreeting,
  deleteVoicemailGreeting,
} from '@/api/controllers/dialer.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { withBetterAuth } from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  ListVoicemailGreetingsRequestSchema,
  CreateVoicemailGreetingRequestSchema,
  SetActiveVoicemailGreetingRequestSchema,
  DeleteVoicemailGreetingRequestSchema,
} from '@shared/types/src'

const router = Router()

router.use(withBetterAuth)

// List voicemail greetings
router.get(
  '/',
  validateAndMerge(ListVoicemailGreetingsRequestSchema),
  authenticatedRoute(listVoicemailGreetings),
)

// Create a new voicemail greeting
router.post(
  '/',
  validateAndMerge(CreateVoicemailGreetingRequestSchema),
  authenticatedRoute(createVoicemailGreeting),
)

// Activate a voicemail greeting
router.post(
  '/:id/activate',
  validateAndMerge(SetActiveVoicemailGreetingRequestSchema),
  authenticatedRoute(setActiveVoicemailGreeting),
)

// Delete a voicemail greeting
router.delete(
  '/:id',
  validateAndMerge(DeleteVoicemailGreetingRequestSchema),
  authenticatedRoute(deleteVoicemailGreeting),
)

export default router

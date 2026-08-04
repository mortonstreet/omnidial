import { Router } from 'express'
import {
  initiateCall,
  endCall,
  getCall,
  listCalls,
  setCallDisposition,
  dropVoicemail,
  getCallRecording,
  suggestDisposition,
} from '@/api/controllers/dialer.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { withBetterAuth } from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  InitiateCallRequestSchema,
  GetCallRequestSchema,
  ListCallsRequestSchema,
  UpdateCallDispositionRequestSchema,
  DropVoicemailRequestSchema,
  SuggestDispositionRequestSchema,
} from '@shared/types/src'

const router = Router()

// All routes require authentication
router.use(withBetterAuth)

// List calls
router.get(
  '/',
  validateAndMerge(ListCallsRequestSchema),
  authenticatedRoute(listCalls),
)

// Initiate a new call
router.post(
  '/',
  validateAndMerge(InitiateCallRequestSchema),
  authenticatedRoute(initiateCall),
)

// Get a specific call
router.get(
  '/:id',
  validateAndMerge(GetCallRequestSchema),
  authenticatedRoute(getCall),
)

// End a call
router.post(
  '/:id/end',
  validateAndMerge(GetCallRequestSchema),
  authenticatedRoute(endCall),
)

// Set call disposition
router.patch(
  '/:id/disposition',
  validateAndMerge(UpdateCallDispositionRequestSchema),
  authenticatedRoute(setCallDisposition),
)

// Drop voicemail
router.post(
  '/:callId/voicemail-drop',
  validateAndMerge(DropVoicemailRequestSchema),
  authenticatedRoute(dropVoicemail),
)

// Get call recording
router.get(
  '/:id/recording',
  validateAndMerge(GetCallRequestSchema),
  authenticatedRoute(getCallRecording),
)

// Get AI-powered disposition suggestions for a call
router.post(
  '/:id/suggest-disposition',
  validateAndMerge(SuggestDispositionRequestSchema),
  authenticatedRoute(suggestDisposition),
)

export default router

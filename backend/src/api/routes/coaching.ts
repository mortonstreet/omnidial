import { Router, Request, Response, NextFunction } from 'express'
import * as coachingController from '@/api/controllers/coaching.controller'
import { withBetterAuth } from '@/api/middlewares/auth'
import { requireFeature } from '@/api/middlewares/featureGate'
import { AuthRequest } from '@/types/handlers'

const router = Router()

// Middleware to extract organizationId and userId from session
const extractOrgAndUser = (req: Request, res: Response, next: NextFunction) => {
  const authReq = req as AuthRequest<unknown>
  const organizationId =
    (authReq.session as any)?.session?.activeOrganizationId ?? null
  const userId = authReq.user?.id ?? null

  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  req.organizationId = organizationId
  req.userId = userId
  next()
}

// Apply auth middleware and feature gate to all routes
router.use(withBetterAuth, extractOrgAndUser, requireFeature('coaching'))

// Get coaching stats for the organization
router.get('/stats', coachingController.getCoachingStats)

// Get recent coaching for the organization
router.get('/recent', coachingController.getRecentCoaching)

// Get coaching history for the current user
router.get('/history', coachingController.getUserCoachingHistory)

// Get uncoached eligible calls
router.get('/uncoached', coachingController.getUncoachedCalls)

// Get coaching for a specific lead
router.get('/leads/:leadId', coachingController.getLeadCoaching)

// Check if a call is eligible for coaching
router.get('/calls/:callId/eligibility', coachingController.checkEligibility)

// Get coaching for a specific call
router.get('/calls/:callId', coachingController.getCallCoaching)

// Generate coaching for a call
router.post('/calls/:callId/generate', coachingController.generateCoaching)

export default router

import { Router, Request, Response, NextFunction } from 'express'
import * as callIntelligenceController from '@/api/controllers/callIntelligence.controller'
import { withBetterAuth } from '@/api/middlewares/auth'
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

// Apply auth middleware to all routes
router.use(withBetterAuth, extractOrgAndUser)

// Check if a call is eligible for intelligence extraction
router.get(
  '/calls/:callId/eligibility',
  callIntelligenceController.checkEligibility,
)

// Get intelligence for a specific call
router.get('/calls/:callId', callIntelligenceController.getCallIntelligence)

// Generate intelligence for a call
router.post(
  '/calls/:callId/generate',
  callIntelligenceController.generateIntelligence,
)

// Get intelligence for a specific lead
router.get('/leads/:leadId', callIntelligenceController.getLeadIntelligence)

export default router

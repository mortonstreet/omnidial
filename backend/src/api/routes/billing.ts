import { Router, Request, Response, NextFunction } from 'express'
import * as billingController from '@/api/controllers/billing.controller'
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

// Usage dashboard - current cycle + projection
router.get('/usage', billingController.getUsageDashboard)

// Usage history - past 6 cycles
router.get('/usage/history', billingController.getUsageHistory)

// Acknowledge overage cap
router.post('/overage-cap/acknowledge', billingController.acknowledgeOverageCap)

export default router

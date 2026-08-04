import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { AuthRequest } from '@/types/handlers'
import * as parallelDialerService from '@/services/parallelDialer.service'
import {
  StartParallelDialSessionRequestSchema,
  EndParallelDialSessionRequestSchema,
  ListParallelDialSessionsRequestSchema,
  GetAbandonedCallsReportRequestSchema,
} from '@shared/types/src'

const router = Router()

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// Start parallel dial session
router.post(
  '/sessions',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, campaignId, listId, lineCount } =
        StartParallelDialSessionRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.body,
        })

      const session = await parallelDialerService.startSession(
        organizationId,
        authReq.user.id,
        { campaignId, listId, lineCount },
      )

      res.json(session)
    } catch (error) {
      const err = error as Error & {
        code?: string
        guardResult?: {
          retryable?: boolean
          httpStatus?: number
          correlationId?: string
        }
      }
      const guardCodes: Record<string, number> = {
        NO_ACTIVE_SUBSCRIPTION: 402,
        ACCOUNT_SUSPENDED: 403,
        ACCOUNT_CANCELED: 403,
        OVERAGE_CAP_HIT: 402,
        DAILY_LIMIT_REACHED: 429,
        BILLING_GUARD_UNAVAILABLE: 503,
      }
      const status =
        err.guardResult?.httpStatus || (err.code && guardCodes[err.code]) || 0
      if (status > 0) {
        return res.status(status).json({
          error: err.message || 'Failed to start parallel dial session',
          code: err.code,
          retryable: err.guardResult?.retryable,
          correlationId: err.guardResult?.correlationId,
        })
      }
      next(error)
    }
  },
)

// End parallel dial session
router.post(
  '/sessions/:id/end',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      // Validate the request params
      EndParallelDialSessionRequestSchema.parse({
        sessionId: req.params.id,
      })

      const session = await parallelDialerService.endSession(req.params.id)
      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

// Pause session
router.post(
  '/sessions/:id/pause',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const session = await parallelDialerService.pauseSession(req.params.id)
      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

// Resume session
router.post(
  '/sessions/:id/resume',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const session = await parallelDialerService.resumeSession(req.params.id)
      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

// Get session details
router.get(
  '/sessions/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const session = await parallelDialerService.getSession(req.params.id)
      if (!session) {
        return res.status(404).json({ error: 'Session not found' })
      }
      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

// List sessions
router.get(
  '/sessions',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, status, userId, page, limit } =
        ListParallelDialSessionsRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await parallelDialerService.listSessions(
        organizationId,
        { status, userId },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// Dial next batch
router.post(
  '/sessions/:id/dial',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { fromNumber } = req.body
      if (!fromNumber) {
        return res.status(400).json({ error: 'fromNumber is required' })
      }
      const orgId = getOrgId(authReq)
      if (!orgId) {
        return res.status(400).json({ error: 'No active organization' })
      }

      const attempts = await parallelDialerService.dialNextBatch(
        req.params.id,
        orgId,
        fromNumber,
      )

      res.json({ attempts })
    } catch (error) {
      next(error)
    }
  },
)

// Join conference (returns TwiML for rep's browser to join)
router.post(
  '/sessions/:id/join',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const session = await parallelDialerService.getSession(req.params.id)
      if (!session) {
        return res.status(404).json({ error: 'Session not found' })
      }

      if (!session.conferenceId) {
        return res.status(400).json({ error: 'Session has no conference' })
      }

      // Return the conference ID for the frontend to use
      // The actual TwiML will be generated by the Twilio voice webhook
      res.json({
        conferenceId: session.conferenceId,
        sessionId: session.id,
      })
    } catch (error) {
      next(error)
    }
  },
)

// Abandoned calls compliance report
router.get(
  '/abandoned-calls',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, startDate, endDate, page, limit } =
        GetAbandonedCallsReportRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await parallelDialerService.getAbandonedCallsReport(
        organizationId,
        { startDate, endDate },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

export default router

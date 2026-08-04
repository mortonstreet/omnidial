import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { AuthRequest } from '@/types/handlers'
import * as salesFloorService from '@/services/salesFloor.service'
import * as callBlitzService from '@/services/callBlitz.service'
import * as managerListenService from '@/services/managerListen.service'
import {
  GetSalesFloorStatusRequestSchema,
  GetLeaderboardRequestSchema,
  CreateBlitzRequestSchema,
  UpdateBlitzRequestSchema,
  StartBlitzRequestSchema,
  EndBlitzRequestSchema,
  JoinBlitzRequestSchema,
  ListBlitzesRequestSchema,
  StartListenSessionRequestSchema,
  ChangeListenModeRequestSchema,
  EndListenSessionRequestSchema,
} from '@shared/types/src'

const router = Router()

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// === Sales Floor Status ===

router.get(
  '/status',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId } = GetSalesFloorStatusRequestSchema.parse({
        organizationId: getOrgId(authReq),
      })

      const status = await salesFloorService.getSalesFloorStatus(organizationId)
      res.json(status)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/leaderboard',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, period, metric } =
        GetLeaderboardRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const leaderboard = await salesFloorService.getLeaderboard(
        organizationId,
        period,
        metric,
      )
      res.json(leaderboard)
    } catch (error) {
      next(error)
    }
  },
)

// === Call Blitz ===

router.post(
  '/blitz',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = CreateBlitzRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const blitz = await callBlitzService.createBlitz(
        data.organizationId,
        authReq.user.id,
        {
          name: data.name,
          description: data.description,
          startAt: new Date(data.startAt),
          endAt: new Date(data.endAt),
          goalType: data.goalType,
          goalTarget: data.goalTarget,
          prizeDescription: data.prizeDescription,
        },
      )

      res.status(201).json(blitz)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/blitz',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, status, page, limit } =
        ListBlitzesRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await callBlitzService.listBlitzes(
        organizationId,
        { status },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/blitz/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const blitz = await callBlitzService.getBlitz(req.params.id)
      if (!blitz) {
        return res.status(404).json({ error: 'Blitz not found' })
      }
      res.json(blitz)
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/blitz/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const data = UpdateBlitzRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const blitz = await callBlitzService.updateBlitz(data.id, {
        name: data.name,
        description: data.description,
        startAt: data.startAt ? new Date(data.startAt) : undefined,
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        goalType: data.goalType,
        goalTarget: data.goalTarget,
        prizeDescription: data.prizeDescription,
      })

      res.json(blitz)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/blitz/:id/start',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const blitz = await callBlitzService.startBlitz(req.params.id)
      res.json(blitz)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/blitz/:id/end',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const blitz = await callBlitzService.endBlitz(req.params.id)
      res.json(blitz)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/blitz/:id/join',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const participant = await callBlitzService.joinBlitz(
        req.params.id,
        authReq.user.id,
      )
      res.json(participant)
    } catch (error) {
      next(error)
    }
  },
)

// === Manager Listen ===

router.post(
  '/listen/start',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = StartListenSessionRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const session = await managerListenService.startListenSession(
        data.organizationId,
        authReq.user.id,
        data.repId,
        data.callId,
        data.mode,
      )

      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/listen/:id/mode',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const data = ChangeListenModeRequestSchema.parse({
        sessionId: req.params.id,
        ...req.body,
      })

      const session = await managerListenService.changeListenMode(
        data.sessionId,
        data.mode,
      )

      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/listen/:id/end',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const session = await managerListenService.endListenSession(req.params.id)
      res.json(session)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/listen/active',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const orgId = getOrgId(authReq)
      if (!orgId) {
        return res.status(400).json({ error: 'No active organization' })
      }
      const sessions = await managerListenService.getActiveListenSessions(orgId)
      res.json({ data: sessions })
    } catch (error) {
      next(error)
    }
  },
)

export default router

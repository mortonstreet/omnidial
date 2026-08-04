import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { AuthRequest } from '@/types/handlers'
import * as liveCoachService from '@/services/liveCoach.service'
import {
  CreateCoachCardRequestSchema,
  UpdateCoachCardRequestSchema,
  ListCoachCardsRequestSchema,
  GetLiveTranscriptRequestSchema,
  SubmitTriggerFeedbackRequestSchema,
  GetTriggerStatsRequestSchema,
} from '@shared/types/src'

const router = Router()

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// === Coach Cards CRUD ===

router.post(
  '/cards',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = CreateCoachCardRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const card = await liveCoachService.createCoachCard(
        data.organizationId,
        authReq.user.id,
        {
          title: data.title,
          category: data.category,
          triggerPhrases: data.triggerPhrases,
          content: data.content,
          tips: data.tips,
          sortOrder: data.sortOrder,
        },
      )

      res.status(201).json(card)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/cards',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, category, isActive, page, limit } =
        ListCoachCardsRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await liveCoachService.listCoachCards(
        organizationId,
        { category, isActive },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/cards/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const card = await liveCoachService.getCoachCard(req.params.id)
      if (!card) {
        return res.status(404).json({ error: 'Coach card not found' })
      }
      res.json(card)
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/cards/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const data = UpdateCoachCardRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const card = await liveCoachService.updateCoachCard(data.id, {
        title: data.title,
        category: data.category,
        triggerPhrases: data.triggerPhrases,
        content: data.content,
        tips: data.tips,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      })

      res.json(card)
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/cards/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      await liveCoachService.deleteCoachCard(req.params.id)
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)

// === Live Transcript ===

router.get(
  '/transcript/:callId',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const { callId, afterMs } = GetLiveTranscriptRequestSchema.parse({
        callId: req.params.callId,
        ...req.query,
      })

      const segments = await liveCoachService.getLiveTranscript(callId, afterMs)

      res.json({
        callId,
        segments,
        totalDurationMs:
          segments.length > 0 ? segments[segments.length - 1].endMs : 0,
        isTranscribing: true, // Would check actual transcription status
      })
    } catch (error) {
      next(error)
    }
  },
)

// === Trigger Feedback ===

router.post(
  '/triggers/:id/feedback',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const data = SubmitTriggerFeedbackRequestSchema.parse({
        triggerId: req.params.id,
        ...req.body,
      })

      await liveCoachService.submitTriggerFeedback(
        data.triggerId,
        data.wasHelpful,
      )
      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/trigger-stats',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, coachCardId, startDate, endDate } =
        GetTriggerStatsRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const stats = await liveCoachService.getTriggerStats(organizationId, {
        coachCardId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
      })

      res.json(stats)
    } catch (error) {
      next(error)
    }
  },
)

export default router

import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { AuthRequest } from '@/types/handlers'
import * as predictiveScoringService from '@/services/predictiveScoring.service'
import {
  CalculatePredictiveScoresRequestSchema,
  ReorderByCampaignScoreRequestSchema,
  GetLeadScoreRequestSchema,
  GetCallAnswerPatternsRequestSchema,
  DetectPhoneTypeRequestSchema,
} from '@shared/types/src'

const router = Router()

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// Calculate scores for a list
router.post(
  '/calculate/:listId',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = CalculatePredictiveScoresRequestSchema.parse({
        organizationId: getOrgId(authReq),
        listId: req.params.listId,
      })

      const result = await predictiveScoringService.calculateScoresForList(
        data.organizationId,
        data.listId,
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// Reorder campaign leads by score
router.post(
  '/reorder/:campaignId/:listId',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = ReorderByCampaignScoreRequestSchema.parse({
        organizationId: getOrgId(authReq),
        campaignId: req.params.campaignId,
        listId: req.params.listId,
      })

      const result = await predictiveScoringService.reorderCampaignByScore(
        data.organizationId,
        data.campaignId,
        data.listId,
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// Get score for a single lead
router.get(
  '/lead/:leadId',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const score = await predictiveScoringService.getLeadScore(
        req.params.leadId,
      )
      if (!score) {
        return res.status(404).json({ error: 'Score not found for this lead' })
      }
      res.json(score)
    } catch (error) {
      next(error)
    }
  },
)

// Get call answer patterns for the organization
router.get(
  '/patterns',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId } = GetCallAnswerPatternsRequestSchema.parse({
        organizationId: getOrgId(authReq),
      })

      const patterns =
        await predictiveScoringService.getCallAnswerPatterns(organizationId)

      res.json(patterns)
    } catch (error) {
      next(error)
    }
  },
)

// Detect phone type for a number
router.get(
  '/phone-type',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { phoneNumber } = DetectPhoneTypeRequestSchema.parse(req.query)
      const orgId = getOrgId(authReq)
      if (!orgId) {
        return res.status(400).json({ error: 'No active organization' })
      }

      const result = await predictiveScoringService.detectPhoneType(
        orgId,
        phoneNumber,
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

export default router

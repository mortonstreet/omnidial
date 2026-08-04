import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { AuthRequest } from '@/types/handlers'
import * as localPresenceService from '@/services/localPresence.service'
import {
  ListPhonePoolRequestSchema,
  SyncPhonePoolFromTwilioRequestSchema,
  UpdatePoolNumberRequestSchema,
  PreviewLocalPresenceRequestSchema,
  GetCallbackRoutesRequestSchema,
  GetAreaCodeCoverageRequestSchema,
  GetMissingAreaCodesRequestSchema,
} from '@shared/types/src'

const router = Router()

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// === Phone Number Pool ===

router.get(
  '/phone-pool',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, areaCode, isActive, page, limit } =
        ListPhonePoolRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await localPresenceService.listPhonePool(
        organizationId,
        { areaCode, isActive },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/phone-pool/sync',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId } = SyncPhonePoolFromTwilioRequestSchema.parse({
        organizationId: getOrgId(authReq),
      })

      const result =
        await localPresenceService.syncPhonePoolFromTwilio(organizationId)
      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/phone-pool/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const data = UpdatePoolNumberRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const number = await localPresenceService.updatePoolNumber(data.id, {
        friendlyName: data.friendlyName,
        isActive: data.isActive,
      })

      res.json(number)
    } catch (error) {
      next(error)
    }
  },
)

// === Local Presence Preview ===

router.get(
  '/preview',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, leadPhone } =
        PreviewLocalPresenceRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const preview = await localPresenceService.selectLocalPresenceNumber(
        organizationId,
        leadPhone,
      )

      res.json(preview)
    } catch (error) {
      next(error)
    }
  },
)

// === Callback Routes ===

router.get(
  '/callback-routes',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, repUserId, page, limit } =
        GetCallbackRoutesRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      // Would need to implement this method
      res.json({ data: [], total: 0, page, limit })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/callback-routes/clear-expired',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const orgId = getOrgId(authReq)
      if (!orgId) {
        return res.status(400).json({ error: 'No active organization' })
      }
      const cleared = await localPresenceService.clearExpiredRoutes(orgId)
      res.json({ cleared })
    } catch (error) {
      next(error)
    }
  },
)

// === Area Code Coverage ===

router.get(
  '/coverage',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId } = GetAreaCodeCoverageRequestSchema.parse({
        organizationId: getOrgId(authReq),
      })

      const coverage =
        await localPresenceService.getAreaCodeCoverage(organizationId)
      res.json(coverage)
    } catch (error) {
      next(error)
    }
  },
)

router.get(
  '/missing-area-codes',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, listId } = GetMissingAreaCodesRequestSchema.parse(
        {
          organizationId: getOrgId(authReq),
          ...req.query,
        },
      )

      const missing = await localPresenceService.getMissingAreaCodes(
        organizationId,
        listId,
      )

      res.json(missing)
    } catch (error) {
      next(error)
    }
  },
)

export default router

import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import {
  bulkEnrichmentRateLimit,
  generalApiRateLimit,
  interactiveEnrichmentRateLimit,
} from '../middlewares/rateLimiterMiddleware'
import { AuthRequest } from '@/types/handlers'
import * as enrichmentService from '@/services/enrichment.service'
import {
  ConnectVendorRequestSchema,
  UpdateVendorConnectionRequestSchema,
  ListVendorConnectionsRequestSchema,
  EnrichLeadRequestSchema,
  BulkEnrichRequestSchema,
  BulkProspeoListMobileEnrichRequestSchema,
  GetEnrichmentHistoryRequestSchema,
} from '@shared/types/src'

const router = Router()

// Read endpoints use general rate limit; expensive mutations get their own below
router.use(generalApiRateLimit)

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// === Vendor Connections ===

router.get(
  '/vendors',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, isActive } =
        ListVendorConnectionsRequestSchema.parse({
          ...req.query,
          organizationId: getOrgId(authReq),
        })

      const connections = await enrichmentService.listVendorConnections(
        organizationId,
        { isActive },
      )

      res.json({ data: connections })
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/vendors',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = ConnectVendorRequestSchema.parse({
        ...req.body,
        organizationId: getOrgId(authReq),
      })

      const connection = await enrichmentService.connectVendor(
        data.organizationId,
        authReq.user.id,
        {
          provider: data.provider,
          apiKey: data.apiKey,
          priority: data.priority,
          creditsLimit: data.creditsLimit,
          enabledDataTypes: data.enabledDataTypes,
        },
      )

      res.status(201).json(connection)
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/vendors/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const data = UpdateVendorConnectionRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const connection = await enrichmentService.updateVendorConnection(
        data.id,
        {
          apiKey: data.apiKey,
          isActive: data.isActive,
          priority: data.priority,
          creditsLimit: data.creditsLimit,
          enabledDataTypes: data.enabledDataTypes,
        },
      )

      res.json(connection)
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/vendors/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      await enrichmentService.disconnectVendor(req.params.id)
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/vendors/:id/test',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const result = await enrichmentService.testVendorConnection(req.params.id)
      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// === Lead Enrichment ===

router.post(
  '/leads/:leadId/enrich',
  withBetterAuth,
  interactiveEnrichmentRateLimit,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = EnrichLeadRequestSchema.parse({
        leadId: req.params.leadId,
        ...req.body,
        organizationId: getOrgId(authReq),
      })

      const result = await enrichmentService.enrichLead(
        data.organizationId,
        data.leadId,
        {
          providers: data.providers,
          dataTypes: data.dataTypes,
          forceRefresh: data.forceRefresh,
        },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/bulk-enrich',
  withBetterAuth,
  bulkEnrichmentRateLimit,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = BulkEnrichRequestSchema.parse({
        ...req.body,
        organizationId: getOrgId(authReq),
      })

      const result = await enrichmentService.bulkEnrich(
        data.organizationId,
        data.leadIds,
        {
          providers: data.providers,
          dataTypes: data.dataTypes,
          forceRefresh: data.forceRefresh,
        },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.post(
  '/lists/:listId/prospeo-mobile',
  withBetterAuth,
  bulkEnrichmentRateLimit,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = BulkProspeoListMobileEnrichRequestSchema.parse({
        listId: req.params.listId,
        ...req.body,
        organizationId: getOrgId(authReq),
      })

      const result = await enrichmentService.bulkProspeoMobileEnrichList(
        data.organizationId,
        data.listId,
        {
          leadIds: data.leadIds,
        },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// === Contact Info ===

router.get(
  '/leads/:leadId/contacts',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const contacts = await enrichmentService.getLeadContactInfo(
        req.params.leadId,
      )
      res.json({ leadId: req.params.leadId, contacts })
    } catch (error) {
      next(error)
    }
  },
)

// === Enrichment History ===

router.get(
  '/history',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const {
        organizationId,
        leadId,
        provider,
        startDate,
        endDate,
        page,
        limit,
      } = GetEnrichmentHistoryRequestSchema.parse({
        ...req.query,
        organizationId: getOrgId(authReq),
      })

      const result = await enrichmentService.getEnrichmentHistory(
        organizationId,
        {
          leadId,
          provider,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

export default router

import { AuthRequest } from '@/types/handlers'
import { Response } from 'express'
import * as extensionService from '@/services/extension.service'
import type {
  CheckLeadRequest,
  CreateListFromLinkedInSelectionRequest,
  ExtensionEnrichRequest,
  ExtensionJobStatusRequest,
  ExtensionListBulkEnrichRequest,
  ExtensionListBulkPushCrmRequest,
  GetLeadsRequest,
  QuickContextRequest,
} from '@shared/types/src/requests/extension'

type OrgScoped<T> = T & { organizationId: string }

/**
 * GET /extension/session
 * Lightweight session check for extension
 */
export const getSession = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const user = req.user
  const session = (req as any).session

  return res.json({
    authenticated: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    organization: session?.session?.activeOrganizationId
      ? {
          id: session.session.activeOrganizationId,
          name: null, // Could fetch org name if needed
        }
      : null,
  })
}

/**
 * GET /extension/check-lead
 * Check if lead exists by LinkedIn URL
 */
export const checkLead = async (
  req: AuthRequest<OrgScoped<CheckLeadRequest>>,
  res: Response,
) => {
  const { linkedInUrl, organizationId } = req.validated
  const result = await extensionService.checkLeadByLinkedIn(
    organizationId,
    linkedInUrl,
  )
  return res.json(result)
}

/**
 * GET /extension/quick-context
 * Get clients, campaigns, phone numbers for dropdowns
 */
export const getQuickContext = async (
  req: AuthRequest<OrgScoped<QuickContextRequest>>,
  res: Response,
) => {
  const { organizationId } = req.validated
  const result = await extensionService.getQuickContext(organizationId)
  return res.json(result)
}

/**
 * POST /extension/enrich
 * Create lead from LinkedIn and enrich in one call
 */
export const enrichLead = async (
  req: AuthRequest<OrgScoped<ExtensionEnrichRequest>>,
  res: Response,
) => {
  const { organizationId, ...params } = req.validated
  const result = await extensionService.enrichFromLinkedIn(
    organizationId,
    req.user.id,
    params,
  )
  return res.json(result)
}

/**
 * GET /extension/leads
 * Get paginated leads for lead browser
 */
export const getLeads = async (
  req: AuthRequest<OrgScoped<GetLeadsRequest>>,
  res: Response,
) => {
  const { organizationId, clientId, campaignId, search, limit, offset } =
    req.validated
  const result = await extensionService.getLeads(
    organizationId,
    { clientId, campaignId, search },
    limit,
    offset,
  )
  return res.json(result)
}

/**
 * POST /extension/lists/create-from-linkedin-selection
 */
export const createListFromLinkedInSelection = async (
  req: AuthRequest<OrgScoped<CreateListFromLinkedInSelectionRequest>>,
  res: Response,
) => {
  const { organizationId, ...params } = req.validated
  const result = await extensionService.createListFromLinkedInSelection(
    organizationId,
    req.user.id,
    params,
  )
  res.setHeader('x-correlation-id', result.correlationId)
  return res.status(201).json(result)
}

/**
 * POST /extension/lists/:id/bulk-enrich
 */
export const enqueueListBulkEnrich = async (
  req: AuthRequest<OrgScoped<ExtensionListBulkEnrichRequest>>,
  res: Response,
) => {
  const { organizationId, id, providers, forceRefresh } = req.validated
  const result = await extensionService.enqueueListBulkEnrich(
    organizationId,
    req.user.id,
    {
      listId: id,
      providers,
      forceRefresh,
    },
  )
  res.setHeader('x-correlation-id', result.correlationId)
  return res.status(202).json(result)
}

/**
 * GET /extension/jobs/:jobId
 */
export const getJobStatus = async (
  req: AuthRequest<OrgScoped<ExtensionJobStatusRequest>>,
  res: Response,
) => {
  const { organizationId, jobId } = req.validated
  const result = await extensionService.getBulkEnrichJobStatus(
    organizationId,
    jobId,
  )
  res.setHeader('x-correlation-id', result.correlationId)
  return res.json(result)
}

/**
 * POST /extension/lists/:id/bulk-push-crm
 */
export const bulkPushListToCrm = async (
  req: AuthRequest<OrgScoped<ExtensionListBulkPushCrmRequest>>,
  res: Response,
) => {
  const { organizationId, id, provider } = req.validated
  const result = await extensionService.bulkPushListToCrm(
    organizationId,
    req.user.id,
    {
      listId: id,
      provider,
    },
  )
  res.setHeader('x-correlation-id', result.correlationId)
  return res.json(result)
}

import { AuthRequest } from '@/types/handlers'
import { Response } from 'express'
import * as crmService from '@/services/crm.service'
import type {
  CrmPushRequest,
  CrmPresenceRequest,
  CrmTestRequest,
} from '@shared/types/src/requests/crmSync'

export const pushToCrm = async (
  req: AuthRequest<CrmPushRequest>,
  res: Response,
) => {
  const { organizationId, leadId, provider } = req.validated
  try {
    const result = await crmService.pushLeadToCrm(
      organizationId,
      leadId,
      provider,
    )
    return res.json({ data: result })
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }
}

export const getCrmPresence = async (
  req: AuthRequest<CrmPresenceRequest>,
  res: Response,
) => {
  const { organizationId, leadId } = req.validated
  const result = await crmService.getCrmPresenceForLead(organizationId, leadId)
  return res.json({ data: result })
}

export const listConnectedCrms = async (
  req: AuthRequest<{ organizationId: string }>,
  res: Response,
) => {
  const { organizationId } = req.validated
  const result = await crmService.listConnectedCrms(organizationId)
  return res.json({ data: result })
}

export const testCrmConnection = async (
  req: AuthRequest<CrmTestRequest>,
  res: Response,
) => {
  const { organizationId, provider } = req.validated
  const result = await crmService.testCrmConnection(organizationId, provider)
  return res.json({ data: result })
}

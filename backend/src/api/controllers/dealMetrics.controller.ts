import { AuthRequestHandler } from '@/types/handlers'
import * as dealMetricsService from '@/services/dealMetrics.service'
import * as dealSignalService from '@/services/dealSignal.service'
import * as dealTrackingService from '@/services/dealTracking.service'
import * as integrationService from '@/services/integration.service'
import * as hubspotSyncService from '@/services/hubspotSync.service'
import {
  ConnectGrainRequest,
  GetDealMetricsRequest,
  GetHubSpotSyncStatusRequest,
  GetLeadDealSignalsRequest,
  ReconcileHubSpotRequest,
  SetDealOutcomeRequest,
  SyncDealSignalsRequest,
} from '@shared/types/src'

const getOrganizationId = (session: any): string | null =>
  session?.session?.activeOrganizationId || null

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error'

export const getDealMetrics: AuthRequestHandler<GetDealMetricsRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  const { startDate, endDate, clientId } = req.validated
  const data = await dealMetricsService.getDealMetrics({
    organizationId,
    startDate,
    endDate,
    clientId,
  })
  return res.json({ data })
}

export const setDealOutcome: AuthRequestHandler<SetDealOutcomeRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  const { leadId, outcome, reason, notes } = req.validated
  try {
    const data = await dealTrackingService.setDealOutcome({
      organizationId,
      leadId,
      outcome,
      reason,
      notes,
      userId: req.user.id,
    })
    return res.json({ data })
  } catch (error) {
    return res.status(404).json({ error: errorMessage(error) })
  }
}

export const getLeadDealSignals: AuthRequestHandler<
  GetLeadDealSignalsRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  const data = await dealSignalService.getLeadSignals(
    organizationId,
    req.validated.leadId,
  )
  return res.json({ data })
}

export const syncDealSignals: AuthRequestHandler<
  SyncDealSignalsRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  try {
    const runners = {
      calls: dealSignalService.backfillCallSignals,
      gmail: dealSignalService.syncGmailSignals,
      hubspot_email: dealSignalService.syncHubSpotEmailSignals,
      grain: dealSignalService.syncGrainSignals,
      all: dealSignalService.syncAllSignals,
    } as const
    const data = await runners[req.validated.source](organizationId)
    return res.json({ data })
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error) })
  }
}

export const connectGrain: AuthRequestHandler<ConnectGrainRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  try {
    await integrationService.connectGrain(
      organizationId,
      req.user.id,
      req.validated.apiToken,
    )
    return res.json({ data: { connected: true } })
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error) })
  }
}

export const getHubSpotSyncStatus: AuthRequestHandler<
  GetHubSpotSyncStatusRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  try {
    const data = await hubspotSyncService.getStatus(organizationId)
    return res.json({ data })
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error) })
  }
}

export const syncHubSpotStages: AuthRequestHandler<
  GetHubSpotSyncStatusRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  try {
    const { added, unmatched } =
      await hubspotSyncService.syncStagesToHubSpot(organizationId)
    return res.json({ data: { added, unmatched } })
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error) })
  }
}

export const reconcileHubSpot: AuthRequestHandler<
  ReconcileHubSpotRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }
  try {
    const data = await hubspotSyncService.reconcile(organizationId, {
      fix: req.validated.fix,
    })
    return res.json({ data })
  } catch (error) {
    return res.status(400).json({ error: errorMessage(error) })
  }
}

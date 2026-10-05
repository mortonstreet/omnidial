import * as dealTrackingRepository from '@/repositories/dealTracking.repository'
import * as pipelineRepository from '@/repositories/pipeline.repository'
import * as integrationRepository from '@/repositories/integration.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as hubspotSyncRepository from '@/repositories/hubspotSync.repository'
import * as crmService from '@/services/crm.service'
import { resolveStageOutcome } from '@/lib/deal-metrics'
import type { LeadDealState } from '@/repositories/dealTracking.repository'
import type { DBPipelineStage } from '@shared/db/src/types'

export type StageChangeSource = 'app' | 'bulk' | 'hubspot' | 'api'

/** Snapshot taken before a write, so the change can be diffed afterwards. */
export const snapshotLead = (organizationId: string, leadId: string) =>
  dealTrackingRepository.findLeadDealState(organizationId, leadId)

export const snapshotLeads = (organizationId: string, leadIds: string[]) =>
  dealTrackingRepository.findLeadDealStates(organizationId, leadIds)

/**
 * Record the effects of a lead write on deal tracking: stage history,
 * time-in-stage clock, won/lost outcome, and the first-ever deal value.
 * Bookkeeping only - callers should not fail the user's write on an error.
 */
export const trackLeadChanges = async (params: {
  organizationId: string
  before: LeadDealState[]
  pipelineStageId?: string | null
  dealValue?: number | null
  changedById?: string
  source?: StageChangeSource
}): Promise<void> => {
  const { organizationId, before, pipelineStageId, dealValue } = params

  await trackFirstDealValue(organizationId, before, dealValue)

  if (pipelineStageId === undefined) return
  const moved = before.filter(
    (lead) => lead.pipelineStageId !== pipelineStageId,
  )
  if (moved.length === 0) return

  const stages = await pipelineRepository.findByOrganizationId(organizationId)
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const toStage = pipelineStageId ? stageById.get(pipelineStageId) : undefined

  await dealTrackingRepository.insertStageHistory(
    moved.map((lead) => ({
      organizationId,
      leadId: lead.id,
      fromStageId: lead.pipelineStageId,
      toStageId: pipelineStageId,
      fromStageLabel: lead.pipelineStageId
        ? (stageById.get(lead.pipelineStageId)?.label ?? null)
        : null,
      toStageLabel: toStage?.label ?? null,
      dealValue:
        dealValue !== undefined && dealValue !== null
          ? String(dealValue)
          : lead.dealValue,
      source: params.source ?? 'app',
      changedById: params.changedById ?? null,
    })),
  )

  await applyStageOutcome(organizationId, moved, toStage)
}

const trackFirstDealValue = async (
  organizationId: string,
  before: LeadDealState[],
  dealValue: number | null | undefined,
) => {
  for (const lead of before) {
    if (lead.initialDealValue !== null) continue
    // Leads that had a value before tracking existed: their old value is the
    // best available estimate of the original quote.
    const first = lead.dealValue !== null ? Number(lead.dealValue) : dealValue
    if (first === undefined || first === null) continue
    await dealTrackingRepository.updateLeadDealFields(
      organizationId,
      [lead.id],
      {
        initialDealValue: first,
      },
    )
  }
}

const applyStageOutcome = async (
  organizationId: string,
  moved: LeadDealState[],
  toStage: DBPipelineStage | undefined,
) => {
  const now = new Date()
  const outcome = toStage ? resolveStageOutcome(toStage) : 'open'
  const ids = moved.map((lead) => lead.id)

  if (outcome === 'open') {
    // Reopened deals start a fresh attempt; the old reflection stays in history.
    const reopened = moved.filter((lead) => lead.dealOutcome !== null)
    await dealTrackingRepository.updateLeadDealFields(organizationId, ids, {
      stageEnteredAt: now,
    })
    await dealTrackingRepository.updateLeadDealFields(
      organizationId,
      reopened.map((lead) => lead.id),
      {
        dealOutcome: null,
        dealClosedAt: null,
        dealOutcomeReason: null,
        dealOutcomeNotes: null,
      },
    )
    return
  }

  const newlyClosed = moved.filter((lead) => lead.dealOutcome !== outcome)
  await dealTrackingRepository.updateLeadDealFields(organizationId, ids, {
    stageEnteredAt: now,
  })
  await dealTrackingRepository.updateLeadDealFields(
    organizationId,
    newlyClosed.map((lead) => lead.id),
    { dealOutcome: outcome, dealClosedAt: now, dealOutcomeReason: null },
  )
  // Close date is CRM-synced; record when it changed for newest-wins.
  for (const lead of newlyClosed) {
    await hubspotSyncRepository.stampFieldEdits(
      organizationId,
      lead.id,
      ['dealClosedAt'],
      now,
    )
  }
}

/**
 * Close a deal with a reason. Moves it into the matching won/lost stage when
 * one exists (so the board and stage history agree), then stores the reason
 * and pushes to HubSpot when connected.
 */
export const setDealOutcome = async (params: {
  organizationId: string
  leadId: string
  outcome: 'won' | 'lost'
  reason: string
  notes?: string | null
  userId: string
}) => {
  const { organizationId, leadId, outcome } = params
  const before = await snapshotLead(organizationId, leadId)
  if (!before) throw new Error('Lead not found')

  const stages = await pipelineRepository.findByOrganizationId(organizationId)
  const currentStage = stages.find((s) => s.id === before.pipelineStageId)
  // Already in a won/lost stage (there can be several) -> leave it there.
  const stage =
    currentStage && resolveStageOutcome(currentStage) === outcome
      ? undefined
      : stages.find((s) => resolveStageOutcome(s) === outcome)
  const moveToStage = !!stage
  if (stage && moveToStage) {
    await leadRepository.update(leadId, organizationId, {
      pipelineStageId: stage.id,
    })
    await trackLeadChanges({
      organizationId,
      before: [before],
      pipelineStageId: stage.id,
      changedById: params.userId,
    })
  }

  await dealTrackingRepository.updateLeadDealFields(organizationId, [leadId], {
    dealOutcome: outcome,
    dealOutcomeReason: params.reason,
    dealOutcomeNotes: params.notes ?? null,
    // A stage move already stamped dealClosedAt.
    ...(before.dealOutcome !== outcome &&
      !moveToStage && { dealClosedAt: new Date() }),
  })

  let crmSync: 'synced' | 'failed' | 'not_connected' = 'not_connected'
  if (await isHubSpotConnected(organizationId)) {
    crmSync = await crmService
      .pushLeadToCrm(organizationId, leadId, 'hubspot')
      .then(() => 'synced' as const)
      .catch((error) => {
        console.error('HubSpot push after deal outcome failed:', error)
        return 'failed' as const
      })
  }

  return {
    leadId,
    outcome,
    movedToStageId: moveToStage ? stage.id : null,
    crmSync,
  }
}

export const isHubSpotConnected = async (organizationId: string) =>
  !!(await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'hubspot',
  ))

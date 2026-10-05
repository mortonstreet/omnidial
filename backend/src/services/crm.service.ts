import { getCrmAdapter } from '@/clients/crm'
import * as crmSyncRecordRepository from '@/repositories/crmSyncRecord.repository'
import * as dealSignalRepository from '@/repositories/dealSignal.repository'
import * as integrationRepository from '@/repositories/integration.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as pipelineRepository from '@/repositories/pipeline.repository'
import * as hubspotSyncService from '@/services/hubspotSync.service'
import * as contactMethodRepository from '@/repositories/leadContactMethod.repository'
import { mapWithConcurrency } from '@/utils/concurrency'

export const pushLeadToCrm = async (
  organizationId: string,
  leadId: string,
  provider: string,
) => {
  // HubSpot has a dedicated two-way sync (stored deal ids, newest-wins,
  // activities). Manual pushes force a write even if nothing changed.
  if (provider === 'hubspot') {
    const result = await hubspotSyncService.pushLead(organizationId, leadId, {
      force: true,
    })
    return {
      success: true,
      externalId: result.contactId ?? '',
      externalUrl: result.externalUrl,
    }
  }

  // Verify integration exists
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    provider,
  )
  if (!integration) {
    throw new Error(`${provider} is not connected`)
  }

  // Get lead data - findById takes (id, organizationId)
  const lead = await leadRepository.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  const adapter = getCrmAdapter(provider, organizationId)
  const pipelineStage = lead.pipelineStageId
    ? await pipelineRepository.findById(lead.pipelineStageId)
    : undefined
  const stageLabel =
    pipelineStage?.organizationId === organizationId
      ? pipelineStage.label
      : undefined
  const existingSyncRecord =
    await crmSyncRecordRepository.findByOrgLeadProvider(
      organizationId,
      leadId,
      provider,
    )
  const existingExternalId =
    existingSyncRecord?.syncStatus === 'synced'
      ? existingSyncRecord.externalId
      : undefined

  // Secondary contact methods ride along with the push. The primaries already
  // live on the lead, so only the non-primary rows are extra.
  const contactMethods = await contactMethodRepository.findByLead(
    organizationId,
    leadId,
  )
  const [latestSignal] = await dealSignalRepository.findByLead(
    organizationId,
    leadId,
    1,
  )

  const secondaryOfKind = (kind: 'email' | 'phone') =>
    contactMethods
      .filter((method) => method.kind === kind && !method.isPrimary)
      .map((method) => method.value)

  try {
    const result = await adapter.pushContact({
      internalLeadId: lead.id,
      externalId: existingExternalId,
      secondaryEmails: secondaryOfKind('email'),
      secondaryPhones: secondaryOfKind('phone'),
      firstName: lead.firstName ?? undefined,
      lastName: lead.lastName ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      company: lead.company ?? undefined,
      title: lead.title ?? undefined,
      linkedInUrl: lead.linkedInUrl ?? undefined,
      dealValue: lead.dealValue,
      pipelineStageLabel: stageLabel,
      dealOutcome: lead.dealOutcome,
      dealClosedAt: lead.dealClosedAt,
      dealOutcomeReason: lead.dealOutcomeReason,
      dealOutcomeNotes: lead.dealOutcomeNotes,
      nextStep: latestSignal?.nextStep ?? null,
    })

    // Create/update sync record
    await crmSyncRecordRepository.upsert({
      organizationId,
      leadId,
      provider,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
      syncDirection: 'push',
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
    })

    return {
      success: true,
      externalId: result.externalId,
      externalUrl: result.externalUrl,
    }
  } catch (error) {
    // Record the failure
    await crmSyncRecordRepository.upsert({
      organizationId,
      leadId,
      provider,
      externalId: existingSyncRecord?.externalId || '',
      externalUrl: existingSyncRecord?.externalUrl || undefined,
      syncDirection: 'push',
      syncStatus: 'failed',
      lastSyncedAt: new Date(),
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    })

    throw error
  }
}

export const getCrmPresenceForLead = async (
  organizationId: string,
  leadId: string,
) => {
  // Get all sync records for this lead
  const syncRecords = await crmSyncRecordRepository.findByLead(leadId)

  // Get connected integrations
  const integrations =
    await integrationRepository.findByOrganizationId(organizationId)
  const crmProviders = ['hubspot', 'salesforce', 'attio', 'pipedrive']
  const connectedCrms = integrations
    .filter((i) => crmProviders.includes(i.provider))
    .map((i) => i.provider)

  return connectedCrms.map((provider) => {
    const record = syncRecords.find(
      (r: any) =>
        r.provider === provider && r.organizationId === organizationId,
    )
    return {
      provider,
      exists: record?.syncStatus === 'synced',
      externalId: record?.externalId || null,
      externalUrl: record?.externalUrl || null,
      syncStatus: record?.syncStatus || null,
    }
  })
}

export const listConnectedCrms = async (organizationId: string) => {
  const integrations =
    await integrationRepository.findByOrganizationId(organizationId)
  const crmProviders = ['hubspot', 'salesforce', 'attio', 'pipedrive']
  return integrations
    .filter((i) => crmProviders.includes(i.provider))
    .map((i) => ({
      provider: i.provider,
      connectedAt: i.createdAt?.toISOString(),
    }))
}

export const testCrmConnection = async (
  organizationId: string,
  provider: string,
) => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    provider,
  )
  if (!integration) {
    return { success: false, message: `${provider} is not connected` }
  }

  const adapter = getCrmAdapter(provider, organizationId)
  return adapter.testConnection()
}

// Each pushLeadToCrm is several provider round trips, so a sync-all of a big
// pipeline has to run in parallel and stay bounded or it outlives the request.
// Kept low because a first-time push spends most of its calls on HubSpot's
// search endpoints, which are throttled far harder than the rest of the API.
const SYNC_ALL_CONCURRENCY = 3
const SYNC_ALL_MAX_LEADS = 250

const pushLeadsToCrm = async (
  organizationId: string,
  leadIds: string[],
  provider: string,
  concurrency: number,
) => {
  const uniqueLeadIds = Array.from(new Set(leadIds))
  const errors: { leadId: string; error: string }[] = []
  let synced = 0

  await mapWithConcurrency(uniqueLeadIds, concurrency, async (leadId) => {
    try {
      await pushLeadToCrm(organizationId, leadId, provider)
      synced++
    } catch (error) {
      errors.push({
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  return {
    success: errors.length === 0,
    total: uniqueLeadIds.length,
    synced,
    failed: errors.length,
    errors,
  }
}

export const bulkPushLeadsToCrm = async (
  organizationId: string,
  leadIds: string[],
  provider: string,
) => pushLeadsToCrm(organizationId, leadIds, provider, 1)

/**
 * Push every lead currently on the pipeline board to a CRM in one run.
 * Optionally narrowed to a single client, matching the board's own filter.
 */
export const syncAllPipelineLeadsToCrm = async (
  organizationId: string,
  provider: string,
  clientId?: string,
) => {
  // Fail fast rather than reporting a failure per lead.
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    provider,
  )
  if (!integration) {
    throw new Error(`${provider} is not connected`)
  }

  const leadIds = await leadRepository.findIdsByFilters({
    organizationId,
    inPipeline: true,
    clientId,
  })

  const syncable = leadIds.slice(0, SYNC_ALL_MAX_LEADS)
  const result = await pushLeadsToCrm(
    organizationId,
    syncable,
    provider,
    SYNC_ALL_CONCURRENCY,
  )

  return { ...result, skipped: leadIds.length - syncable.length }
}

export type HubSpotWebhookEvent = hubspotSyncService.HubSpotWebhookEvent

/** Signature-verified HubSpot webhook events -> two-way sync. */
export const handleHubSpotWebhookEvents = (events: HubSpotWebhookEvent[]) =>
  hubspotSyncService.handleWebhookEvents(events)

/**
 * Auto-push a lead to all CRM integrations that have autoSyncToCrm enabled.
 * Fire-and-forget — callers should .catch() errors.
 */
export const autoSyncAfterEnrichment = async (
  organizationId: string,
  leadId: string,
): Promise<void> => {
  const integrations =
    await integrationRepository.findByOrganizationId(organizationId)
  const crmProviders = ['hubspot', 'salesforce', 'attio', 'pipedrive']
  const autoSyncIntegrations = integrations.filter(
    (i: any) => crmProviders.includes(i.provider) && i.autoSyncToCrm === true,
  )

  for (const integration of autoSyncIntegrations) {
    pushLeadToCrm(organizationId, leadId, integration.provider).catch((err) =>
      console.error(
        `[CRM] Auto-sync to ${integration.provider} failed for lead ${leadId}:`,
        err,
      ),
    )
  }
}

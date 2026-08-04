import { getCrmAdapter } from '@/clients/crm'
import * as crmSyncRecordRepository from '@/repositories/crmSyncRecord.repository'
import * as integrationRepository from '@/repositories/integration.repository'
import * as leadRepository from '@/repositories/lead.repository'

export const pushLeadToCrm = async (
  organizationId: string,
  leadId: string,
  provider: string,
) => {
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

  try {
    const result = await adapter.pushContact({
      internalLeadId: lead.id,
      firstName: lead.firstName ?? undefined,
      lastName: lead.lastName ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      company: lead.company ?? undefined,
      title: lead.title ?? undefined,
      linkedInUrl: lead.linkedInUrl ?? undefined,
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
      externalId: '',
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

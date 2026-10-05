/**
 * Two-way OmniDial <-> HubSpot sync.
 *
 *   push       lead change -> debounced queue -> pushLead (contact, deal by
 *              stored id, OmniDial properties, call activities, next-step task)
 *   pull       signed HubSpot webhooks -> applyRemote* (stage, amount, close
 *              date, contact fields), routed by portal id
 *   reconcile  every 6h + CLI: batch-compare every linked lead, fix drift
 *
 * Conflicts: newest edit wins per field (lead.syncFieldUpdatedAt vs HubSpot
 * property history). Every change is written to crm_sync_event.
 */
import { config } from '@/config'
import logger from '@/lib/logger'
import { getCrmAdapter } from '@/clients/crm'
import type { HubSpotCrmAdapter } from '@/clients/crm/hubspot.adapter'
import * as hs from '@/clients/crm/hubspotApi'
import * as integrationRepository from '@/repositories/integration.repository'
import * as crmSyncRecordRepository from '@/repositories/crmSyncRecord.repository'
import * as syncRepo from '@/repositories/hubspotSync.repository'
import * as pipelineRepository from '@/repositories/pipeline.repository'
import * as dealSignalRepository from '@/repositories/dealSignal.repository'
import * as dealTrackingRepository from '@/repositories/dealTracking.repository'
import * as dealTouchpointRepository from '@/repositories/dealTouchpoint.repository'
import {
  callBodyHtml,
  meetingBodyHtml,
  threadNoteHtml,
} from '@/lib/hubspot-activity-body'
import { buildTimeline, median as medianOf } from '@/lib/sales-process'
import * as contactMethodRepository from '@/repositories/leadContactMethod.repository'
import * as leadService from '@/services/lead.service'
import {
  normalizeEmail,
  normalizePhoneValue,
  parseMoney,
} from '@/lib/lead-hygiene'
import { resolveStageOutcome } from '@shared/types/src/requests/dealMetrics'
import {
  CONTACT_FIELDS,
  OMNIDIAL_DEAL_PROPERTIES,
  OMNIDIAL_PROPERTY_GROUP,
  OMNIDIAL_PROPERTIES_VERSION,
  STAGE_FIELD,
  buildContactProperties,
  buildDealProperties,
  hashProperties,
  readSyncConfig,
  resolveConflict,
  reverseStageLookup,
  sameValue,
  type ContactProperty,
  type HubSpotSyncConfig,
  type LeadForSync,
} from '@/lib/hubspot-sync-rules'
import type { DBPipelineStage } from '@shared/db/src/types'

const PROVIDER = 'hubspot'
const CALL_LOOKBACK_DAYS = 90

export const REQUIRED_SCOPES = [
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
  'crm.schemas.deals.read',
  'oauth',
]
export const OPTIONAL_SCOPES = {
  'crm.schemas.deals.write': 'create the OmniDial deal property group',
  'sales-email-read': 'score emails HubSpot logs from reps’ inboxes',
} as const

// ------------------------------------------------------------ context

type Integration = NonNullable<
  Awaited<
    ReturnType<typeof integrationRepository.findByOrganizationAndProvider>
  >
>

const loadContext = async (organizationId: string) => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    PROVIDER,
  )
  if (!integration) throw new Error('HubSpot is not connected')
  return { integration, config: readSyncConfig(integration.config) }
}

/** Merge into integration.config without dropping unrelated keys. */
export const saveSyncConfig = async (
  organizationId: string,
  patch: Partial<HubSpotSyncConfig>,
) => {
  const { integration } = await loadContext(organizationId)
  const current = (integration.config ?? {}) as Record<string, unknown>
  const next = { ...current, ...patch }
  await integrationRepository.update(organizationId, PROVIDER, {
    config: next,
    ...(patch.portalId && { externalAccountId: patch.portalId }),
  })
  return readSyncConfig(next)
}

/** Record the portal id so webhooks route to this org. */
export const ensurePortalId = async (
  organizationId: string,
): Promise<string> => {
  const { integration, config: cfg } = await loadContext(organizationId)
  if (integration.externalAccountId) return integration.externalAccountId
  const info = await hs.getTokenInfo(organizationId)
  const portalId = String(info.hub_id)
  await saveSyncConfig(organizationId, { ...cfg, portalId })
  return portalId
}

const leadUrl = (leadId: string) =>
  `${config.frontendUrl.replace(/\/$/, '')}/dashboard/crm/leads/${leadId}`

const contactUrl = (portalId: string | null | undefined, contactId: string) =>
  portalId
    ? `https://app.hubspot.com/contacts/${portalId}/record/0-1/${contactId}`
    : `https://app.hubspot.com/contacts/${contactId}`

/** Last recorded OmniDial edit of a synced field (absent before tracking). */
const editedAt = (
  lead: { syncFieldUpdatedAt: unknown },
  field: string,
): string | undefined =>
  ((lead.syncFieldUpdatedAt ?? {}) as Record<string, string>)[field]

const isBlank = (value: unknown) =>
  value === null ||
  value === undefined ||
  (typeof value === 'string' && value.trim() === '')

/** OmniDial's own HubSpot app id, to recognise values written by earlier pushes. */
let cachedAppId: string | undefined
const ownAppId = async (
  organizationId: string,
): Promise<string | undefined> => {
  if (config.hubspot.appId) return String(config.hubspot.appId)
  if (!cachedAppId) {
    cachedAppId = await hs
      .getTokenInfo(organizationId)
      .then((info) => String(info.app_id))
      .catch(() => undefined)
  }
  return cachedAppId
}

// ------------------------------------------------------------ stages

const normalizeLabel = (label: string) =>
  label.trim().replace(/\s+/g, ' ').toLowerCase()

/** HubSpot stage options for the configured stage property. */
export const getStageOptions = async (
  organizationId: string,
  cfg: HubSpotSyncConfig,
): Promise<
  Array<{ value: string; label: string; won?: boolean; lost?: boolean }>
> => {
  if (cfg.stageProperty === 'dealstage') {
    const pipelines = await hs.listDealPipelines(organizationId)
    const pipeline = cfg.pipelineId
      ? pipelines.find((p) => p.id === cfg.pipelineId)
      : pipelines.length === 1
        ? pipelines[0]
        : undefined
    if (!pipeline) return []
    return pipeline.stages
      .filter((s) => !s.archived)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((s) => ({
        value: s.id,
        label: s.label,
        won:
          s.metadata?.isClosed === 'true' &&
          Number(s.metadata?.probability) === 1,
        lost:
          s.metadata?.isClosed === 'true' &&
          Number(s.metadata?.probability) === 0,
      }))
  }
  const property = await hs.getDealProperty(organizationId, cfg.stageProperty)
  return (property.options ?? [])
    .filter((o) => !o.hidden)
    .map((o) => ({ value: o.value, label: o.label }))
}

/**
 * Map every OmniDial stage to a HubSpot stage: exact label match first, then
 * won/lost stages by HubSpot's closed-won/closed-lost metadata.
 */
export const autoMapStages = async (
  organizationId: string,
  options: { pipelineId?: string; stageProperty?: string } = {},
) => {
  const { config: current } = await loadContext(organizationId)
  const cfg: HubSpotSyncConfig = {
    ...current,
    ...(options.pipelineId && { pipelineId: options.pipelineId }),
    ...(options.stageProperty && { stageProperty: options.stageProperty }),
  }
  const [stages, hubspotStages] = await Promise.all([
    pipelineRepository.findByOrganizationId(organizationId),
    getStageOptions(organizationId, cfg),
  ])
  if (hubspotStages.length === 0) {
    throw new Error(
      cfg.stageProperty === 'dealstage'
        ? 'Choose a HubSpot pipeline first (several exist): hubspot map-stages --pipeline <id>'
        : `HubSpot property ${cfg.stageProperty} has no options`,
    )
  }

  const stageMap: Record<string, string> = { ...cfg.stageMap }
  const unmatched: string[] = []
  for (const stage of stages) {
    if (
      stageMap[stage.id] &&
      hubspotStages.some((h) => h.value === stageMap[stage.id])
    )
      continue
    const outcome = resolveStageOutcome(stage)
    const match =
      hubspotStages.find(
        (h) => normalizeLabel(h.label) === normalizeLabel(stage.label),
      ) ??
      (outcome === 'won' ? hubspotStages.find((h) => h.won) : undefined) ??
      (outcome === 'lost' ? hubspotStages.find((h) => h.lost) : undefined)
    if (match) stageMap[stage.id] = match.value
    else unmatched.push(stage.label)
  }

  await saveSyncConfig(organizationId, {
    pipelineId: cfg.pipelineId,
    stageProperty: cfg.stageProperty,
    stageMap,
  })
  return { stageMap, unmatched, hubspotStages }
}

/**
 * Make HubSpot's stage dropdown match OmniDial: add an option for every
 * OmniDial stage HubSpot lacks (e.g. "churn"), then re-map. Only for custom
 * dropdown stage properties; built-in pipeline stages are managed in HubSpot.
 */
export const syncStagesToHubSpot = async (organizationId: string) => {
  const { config: cfg } = await loadContext(organizationId)
  if (cfg.stageProperty === 'dealstage') {
    return { added: [] as string[], ...(await autoMapStages(organizationId)) }
  }
  const [stages, property] = await Promise.all([
    pipelineRepository.findByOrganizationId(organizationId),
    hs.getDealProperty(organizationId, cfg.stageProperty),
  ])
  const options = property.options ?? []
  const missing = stages.filter(
    (s) =>
      !options.some(
        (o) => !o.hidden && normalizeLabel(o.label) === normalizeLabel(s.label),
      ),
  )
  if (missing.length > 0) {
    const used = new Set(options.map((o) => o.value))
    const added = missing.map((s, i) => {
      let value =
        s.label
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '') || `stage_${i}`
      while (used.has(value)) value = `${value}_omnidial`
      used.add(value)
      return {
        label: s.label.trim(),
        value,
        displayOrder: options.length + i,
        hidden: false,
      }
    })
    try {
      await hs.updateDealPropertyOptions(organizationId, cfg.stageProperty, [
        ...options,
        ...added,
      ])
    } catch (error) {
      if (error instanceof hs.HubSpotApiError && error.status === 403) {
        throw new Error(
          `HubSpot needs the crm.schemas.deals.write permission to add stages. Grant it (reconnect HubSpot) or add "${missing.map((s) => s.label).join('", "')}" to the ${property.label} property in HubSpot.`,
        )
      }
      throw error
    }
  }
  const result = await autoMapStages(organizationId)
  return { added: missing.map((s) => s.label), ...result }
}

/** Set one mapping by OmniDial stage label/id and HubSpot stage label/value. */
export const setStageMapping = async (
  organizationId: string,
  omnidialStage: string,
  hubspotStage: string,
) => {
  const { config: cfg } = await loadContext(organizationId)
  const [stages, options] = await Promise.all([
    pipelineRepository.findByOrganizationId(organizationId),
    getStageOptions(organizationId, cfg),
  ])
  const local = stages.find(
    (s) =>
      s.id === omnidialStage ||
      normalizeLabel(s.label) === normalizeLabel(omnidialStage),
  )
  const remote = options.find(
    (o) =>
      o.value === hubspotStage ||
      normalizeLabel(o.label) === normalizeLabel(hubspotStage),
  )
  if (!local) throw new Error(`No OmniDial stage "${omnidialStage}"`)
  if (!remote)
    throw new Error(
      `No HubSpot stage "${hubspotStage}" in the configured pipeline/property`,
    )
  return saveSyncConfig(organizationId, {
    stageMap: { ...cfg.stageMap, [local.id]: remote.value },
  })
}

/**
 * With a custom stage dropdown (e.g. deal_stage_2) HubSpot still needs a
 * built-in pipeline stage. New deals start in the pipeline's first open
 * stage; won/lost deals move to its closed-won/closed-lost stage so HubSpot's
 * own win-rate reports and agents see the outcome. Open deals are untouched.
 */
const builtInStageProps = async (
  organizationId: string,
  cfg: HubSpotSyncConfig,
  outcome: string | null,
  isNewDeal: boolean,
): Promise<Record<string, string>> => {
  if (cfg.stageProperty === 'dealstage') return {}
  if (!isNewDeal && outcome !== 'won' && outcome !== 'lost') return {}
  const pipelines = (await hs.listDealPipelines(organizationId)).filter(
    (p) => !p.archived,
  )
  const pipeline =
    pipelines.find((p) => p.id === cfg.pipelineId) ??
    pipelines.find((p) => p.id === 'default') ??
    pipelines[0]
  if (!pipeline) return {}
  const stages = pipeline.stages
    .filter((s) => !s.archived)
    .sort((a, b) => a.displayOrder - b.displayOrder)
  const closed = (probability: number) =>
    stages.find(
      (s) =>
        s.metadata?.isClosed === 'true' &&
        Number(s.metadata?.probability) === probability,
    )
  const stage =
    outcome === 'won'
      ? closed(1)
      : outcome === 'lost'
        ? closed(0)
        : stages.find((s) => s.metadata?.isClosed !== 'true')
  return stage ? { pipeline: pipeline.id, dealstage: stage.id } : {}
}

const stageValueFor = (cfg: HubSpotSyncConfig, stageId: string | null) =>
  stageId ? (cfg.stageMap[stageId] ?? null) : null

/** HubSpot stage value -> OmniDial stage (map first, then label). */
const localStageFor = async (
  organizationId: string,
  cfg: HubSpotSyncConfig,
  stages: DBPipelineStage[],
  hubspotValue: string,
): Promise<DBPipelineStage | undefined> => {
  const mapped = reverseStageLookup(cfg.stageMap, hubspotValue)
  if (mapped) return stages.find((s) => s.id === mapped)
  const options = await getStageOptions(organizationId, cfg).catch(() => [])
  const label = options.find((o) => o.value === hubspotValue)?.label
  return label
    ? stages.find((s) => normalizeLabel(s.label) === normalizeLabel(label))
    : undefined
}

// ------------------------------------------------------------ remote -> local

type LocalLead = Awaited<ReturnType<typeof syncRepo.findLeadsForSync>>[number]

interface RemoteChange {
  field: string
  remoteValue: string | null
  remoteEditedAt: string | Date | undefined
  /** The HubSpot value was written by OmniDial's own app. */
  remoteFromOmniDial?: boolean
}

/**
 * Apply HubSpot values to a lead where HubSpot's edit is newer. Returns which
 * fields were applied and which conflicts OmniDial won (to push back).
 */
const applyRemoteChanges = async (
  organizationId: string,
  cfg: HubSpotSyncConfig,
  lead: LocalLead,
  changes: RemoteChange[],
  direction: 'pull' | 'reconcile',
) => {
  const stages = await pipelineRepository.findByOrganizationId(organizationId)
  const leadPatch: Record<string, unknown> = {}
  const applied: Record<string, { from: unknown; to: unknown }> = {}
  const localWins: string[] = []
  let newestRemote: Date | undefined
  let closedAt: Date | null | undefined

  for (const change of changes) {
    const localValue =
      change.field === STAGE_FIELD
        ? lead.pipelineStageId
        : (lead as Record<string, unknown>)[change.field]

    let incoming: unknown = change.remoteValue
    if (change.field === STAGE_FIELD) {
      if (!change.remoteValue) continue
      const stage = await localStageFor(
        organizationId,
        cfg,
        stages,
        change.remoteValue,
      )
      if (!stage) {
        await syncRepo.logEvents([
          {
            organizationId,
            leadId: lead.id,
            direction,
            objectType: 'deal',
            status: 'failed',
            message: `HubSpot stage ${change.remoteValue} has no OmniDial stage. Run: hubspot map-stages`,
          },
        ])
        continue
      }
      if (stage.id === lead.pipelineStageId) continue
      incoming = stage.id
    } else if (change.field === 'dealValue') {
      incoming = parseMoney(change.remoteValue)
      if (
        sameValue(
          'dealValue',
          lead.dealValue,
          incoming === null ? null : String(incoming),
        )
      )
        continue
    } else if (change.field === 'dealClosedAt') {
      if (sameValue('dealClosedAt', lead.dealClosedAt, change.remoteValue))
        continue
      incoming = change.remoteValue ? new Date(change.remoteValue) : null
    } else if (change.field === 'phone') {
      if (sameValue('phone', lead.phone, change.remoteValue)) continue
      // Only valid numbers come back from HubSpot; junk stays out of the dialer.
      const phone = change.remoteValue
        ? normalizePhoneValue(change.remoteValue)?.e164
        : null
      if (change.remoteValue && !phone) {
        await syncRepo.logEvents([
          {
            organizationId,
            leadId: lead.id,
            direction,
            objectType: 'contact',
            status: 'skipped',
            message: `HubSpot phone "${change.remoteValue}" is not a valid number; not applied`,
          },
        ])
        continue
      }
      incoming = phone
    } else if (change.field === 'email') {
      incoming = normalizeEmail(change.remoteValue)
      if (sameValue('email', lead.email, incoming as string | null)) continue
    } else if (
      sameValue(change.field, localValue as string | null, change.remoteValue)
    ) {
      continue
    }

    const winner = resolveConflict(
      { editedAt: editedAt(lead, change.field), isEmpty: isBlank(localValue) },
      {
        editedAt: change.remoteEditedAt,
        fromOmniDial: change.remoteFromOmniDial,
      },
    )
    if (winner === 'local') {
      localWins.push(change.field)
      continue
    }

    applied[change.field] = { from: localValue ?? null, to: incoming ?? null }
    const at = change.remoteEditedAt
      ? new Date(change.remoteEditedAt)
      : new Date()
    if (!newestRemote || at > newestRemote) newestRemote = at
    if (change.field === 'dealClosedAt') closedAt = incoming as Date | null
    else leadPatch[change.field] = incoming
  }

  if (Object.keys(leadPatch).length > 0) {
    await leadService.update(
      { id: lead.id, organizationId, ...leadPatch } as Parameters<
        typeof leadService.update
      >[0],
      undefined,
      { source: 'hubspot', editedAt: newestRemote },
    )
  }
  if (closedAt !== undefined) {
    await dealTrackingRepository.updateLeadDealFields(
      organizationId,
      [lead.id],
      {
        dealClosedAt: closedAt,
      },
    )
    await syncRepo.stampFieldEdits(
      organizationId,
      lead.id,
      ['dealClosedAt'],
      newestRemote,
    )
  }

  if (Object.keys(applied).length > 0 || localWins.length > 0) {
    await syncRepo.logEvents([
      {
        organizationId,
        leadId: lead.id,
        direction,
        objectType: 'deal',
        status: Object.keys(applied).length > 0 ? 'applied' : 'conflict',
        changes: {
          ...Object.fromEntries(
            Object.entries(applied).map(([k, v]) => [
              k,
              { ...v, winner: 'hubspot' },
            ]),
          ),
          ...Object.fromEntries(
            localWins.map((f) => [f, { winner: 'omnidial' }]),
          ),
        },
      },
    ])
  }
  return { applied: Object.keys(applied), localWins }
}

/** Latest HubSpot edit of a property, and whether OmniDial's app made it. */
const historyOf = (
  obj: hs.HubSpotObject,
  property: string,
  appId: string | undefined,
) => {
  const latest = obj.propertiesWithHistory?.[property]?.[0]
  return {
    remoteEditedAt: latest?.timestamp,
    remoteFromOmniDial:
      !!appId &&
      latest?.sourceType === 'INTEGRATION' &&
      String(latest.sourceId ?? '').split(':')[0] === appId,
  }
}

const contactChanges = (
  contact: hs.HubSpotObject,
  appId: string | undefined,
): RemoteChange[] =>
  (Object.keys(CONTACT_FIELDS) as ContactProperty[]).map((prop) => ({
    field: CONTACT_FIELDS[prop],
    remoteValue: contact.properties[prop] ?? null,
    ...historyOf(contact, prop, appId),
  }))

const dealChanges = (
  cfg: HubSpotSyncConfig,
  deal: hs.HubSpotObject,
  appId: string | undefined,
): RemoteChange[] => [
  {
    field: STAGE_FIELD,
    remoteValue: deal.properties[cfg.stageProperty] ?? null,
    ...historyOf(deal, cfg.stageProperty, appId),
  },
  {
    field: 'dealValue',
    remoteValue: deal.properties.amount ?? null,
    ...historyOf(deal, 'amount', appId),
  },
  {
    field: 'dealClosedAt',
    remoteValue: deal.properties.closedate ?? null,
    ...historyOf(deal, 'closedate', appId),
  },
]

const dealSyncProps = (cfg: HubSpotSyncConfig) => [
  cfg.stageProperty,
  'amount',
  'closedate',
]

// ------------------------------------------------------------ push

export interface PushResult {
  status: 'pushed' | 'skipped' | 'paused'
  contactId?: string
  dealId?: string | null
  externalUrl?: string
  pulled?: string[]
}

/**
 * Push one lead. Before writing, HubSpot's current values are read with
 * history so a newer HubSpot edit is pulled instead of overwritten.
 */
export const pushLead = async (
  organizationId: string,
  leadId: string,
  options: { force?: boolean } = {},
): Promise<PushResult> => {
  const ctx = await loadContext(organizationId)
  const cfg = ctx.config
  const [lead] = await syncRepo.findLeadsForSync(organizationId, [leadId])
  if (!lead) throw new Error('Lead not found')

  const record = await crmSyncRecordRepository.findByOrgLeadProvider(
    organizationId,
    leadId,
    PROVIDER,
  )
  if (record?.remoteDeletedAt && !options.force) return { status: 'paused' }
  // Automatic pushes only cover deals: pipeline leads or leads already in
  // HubSpot. Cold list leads reach HubSpot only through a manual push.
  if (!options.force && !lead.pipelineStageId && !record?.externalId)
    return { status: 'skipped' }

  const [stages, [signal], talk, unloggedCalls, contactMethods, touches] =
    await Promise.all([
      pipelineRepository.findByOrganizationId(organizationId),
      dealSignalRepository.findByLead(organizationId, leadId, 1),
      dealTrackingRepository.findTalkTimeByLead(organizationId, [leadId]),
      cfg.writeBacks.calls
        ? syncRepo.findUnloggedCalls(
            organizationId,
            leadId,
            new Date(Date.now() - CALL_LOOKBACK_DAYS * 864e5),
          )
        : Promise.resolve([]),
      contactMethodRepository.findByLead(organizationId, leadId),
      dealTouchpointRepository.findTouchesForLeads(organizationId, [leadId]),
    ])
  const timeline = buildTimeline(touches.get(leadId) ?? [])
  const stage = stages.find((s) => s.id === lead.pipelineStageId)
  const wantsDeal = !!lead.pipelineStageId || !!record?.externalDealId
  const stageValue = stageValueFor(cfg, lead.pipelineStageId)

  const contactProps = buildContactProperties(lead as LeadForSync)
  const dealProps = buildDealProperties({
    lead: lead as LeadForSync,
    config: cfg,
    stageValue,
    signal: signal ?? null,
    talkTimeSeconds: talk.get(leadId) ?? 0,
    leadUrl: leadUrl(leadId),
    timeline: timeline && {
      firstTouchAt: timeline.firstTouchAt,
      touches: timeline.touches,
      emails: timeline.byKind.email,
      meetings: timeline.byKind.meeting,
      medianBuyerReplyHours: medianOf(timeline.buyerReplyHours),
    },
  })
  const taskSpec = cfg.writeBacks.tasks ? nextStepTask(signal) : null
  const hash = hashProperties({
    contactProps,
    dealProps: wantsDeal ? dealProps : null,
    stage: stage?.label ?? null,
    taskSpec,
  })
  const linked = record?.syncStatus === 'synced' && !!record.externalId
  const pendingSignals = cfg.writeBacks.calls
    ? await dealSignalRepository.findSignalsNeedingCrmActivity(
        organizationId,
        leadId,
        record?.lastPushedAt ?? null,
      )
    : []
  if (
    !options.force &&
    linked &&
    record.pushedHash === hash &&
    unloggedCalls.length === 0 &&
    pendingSignals.length === 0
  ) {
    return { status: 'skipped' }
  }

  try {
    const appId = await ownAppId(organizationId)
    // ---- newest-wins check against HubSpot's current values
    let pulled: string[] = []
    const skipContact = new Set<string>()
    if (linked) {
      const remote = await hs
        .getObject(
          organizationId,
          'contacts',
          record.externalId,
          Object.keys(CONTACT_FIELDS),
          Object.keys(CONTACT_FIELDS),
        )
        .catch((error) => (hs.isNotFound(error) ? null : Promise.reject(error)))
      if (remote) {
        const result = await applyRemoteChanges(
          organizationId,
          cfg,
          lead,
          contactChanges(remote, appId),
          'pull',
        )
        pulled = result.applied
        for (const field of result.applied) {
          const prop = (Object.keys(CONTACT_FIELDS) as ContactProperty[]).find(
            (p) => CONTACT_FIELDS[p] === field,
          )
          if (prop) skipContact.add(prop)
        }
      }
    }

    // ---- contact
    const adapter = getCrmAdapter(PROVIDER, organizationId) as HubSpotCrmAdapter
    const secondary = (kind: 'email' | 'phone') =>
      contactMethods
        .filter((m) => m.kind === kind && !m.isPrimary)
        .map((m) => m.value)
    const contactInput = {
      firstName: skipContact.has('firstname')
        ? undefined
        : contactProps.firstname,
      lastName: skipContact.has('lastname') ? undefined : contactProps.lastname,
      email: skipContact.has('email') ? undefined : contactProps.email,
      phone: skipContact.has('phone') ? undefined : contactProps.phone,
      company: skipContact.has('company') ? undefined : contactProps.company,
      title: skipContact.has('jobtitle') ? undefined : contactProps.jobtitle,
      linkedInUrl: contactProps.hs_linkedin_url,
      secondaryEmails: secondary('email')
        .map((e) => normalizeEmail(e))
        .filter((e): e is string => !!e),
      secondaryPhones: secondary('phone'),
    }
    let contactId: string
    try {
      contactId = await adapter.upsertContact({
        ...contactInput,
        externalId: linked ? record.externalId : undefined,
      })
    } catch (error) {
      if (!linked) throw error
      // Stored contact id is stale (merged/deleted): match again by email/phone.
      contactId = await adapter.upsertContact(contactInput)
    }

    // ---- deal
    let dealId: string | null = record?.externalDealId ?? null
    const pulledDeal: string[] = []
    if (wantsDeal) {
      dealId = await resolveDealId(organizationId, cfg, dealId, contactId)
      const outgoing = { ...dealProps }
      if (dealId) {
        const remote = await hs
          .getObject(
            organizationId,
            'deals',
            dealId,
            dealSyncProps(cfg),
            dealSyncProps(cfg),
          )
          .catch((error) =>
            hs.isNotFound(error) ? null : Promise.reject(error),
          )
        if (!remote) {
          dealId = null
        } else {
          const fresh =
            (await syncRepo.findLeadsForSync(organizationId, [leadId]))[0] ??
            lead
          const result = await applyRemoteChanges(
            organizationId,
            cfg,
            fresh,
            dealChanges(cfg, remote, appId),
            'pull',
          )
          pulledDeal.push(...result.applied)
          if (result.applied.includes(STAGE_FIELD)) {
            delete outgoing[cfg.stageProperty]
            delete outgoing.pipeline
          }
          if (result.applied.includes('dealValue')) delete outgoing.amount
          if (result.applied.includes('dealClosedAt')) delete outgoing.closedate
          Object.assign(
            outgoing,
            await builtInStageProps(
              organizationId,
              cfg,
              lead.dealOutcome,
              false,
            ),
          )
          await hs.updateObject(organizationId, 'deals', dealId, outgoing)
        }
      }
      if (!dealId) {
        if (!outgoing[cfg.stageProperty]) {
          throw new Error(
            `OmniDial stage "${stage?.label ?? 'none'}" is not mapped to a HubSpot stage. Run: hubspot map-stages`,
          )
        }
        Object.assign(
          outgoing,
          await builtInStageProps(organizationId, cfg, lead.dealOutcome, true),
        )
        const created = await hs.createObject(
          organizationId,
          'deals',
          outgoing,
          [
            {
              toId: contactId,
              associationTypeId: hs.ASSOCIATION.dealToContact,
            },
          ],
        )
        dealId = created.id
      }
    }

    // ---- activities
    const loggedCalls = await logCalls(
      organizationId,
      unloggedCalls,
      contactId,
      dealId,
    )
    const signalActivities = await writeSignalActivities(
      organizationId,
      leadId,
      pendingSignals,
      contactId,
      dealId,
    )
    const taskId = taskSpec
      ? await upsertTask(
          organizationId,
          record?.externalTaskId ?? null,
          taskSpec,
          contactId,
          dealId,
        )
      : (record?.externalTaskId ?? null)

    await crmSyncRecordRepository.upsert({
      organizationId,
      leadId,
      provider: PROVIDER,
      externalId: contactId,
      externalUrl: contactUrl(ctx.integration.externalAccountId, contactId),
      syncDirection: 'push',
      syncStatus: 'synced',
      lastSyncedAt: new Date(),
    })
    await crmSyncRecordRepository.update(organizationId, leadId, PROVIDER, {
      externalDealId: dealId,
      externalTaskId: taskId,
      pushedHash: hash,
      lastPushedAt: new Date(),
      errorMessage: null,
      ...(options.force && { remoteDeletedAt: null }),
    })
    await syncRepo.logEvents([
      {
        organizationId,
        leadId,
        direction: 'push',
        objectType: 'deal',
        externalId: dealId ?? contactId,
        status: 'applied',
        changes: {
          contact: Object.keys(contactProps),
          deal: wantsDeal ? Object.keys(dealProps) : [],
          callsLogged: loggedCalls,
          meetingsLogged: signalActivities.meetings,
          threadNotes: signalActivities.notes,
          task: taskSpec ? taskId : null,
          pulledFromHubSpot: [...pulled, ...pulledDeal],
        },
      },
    ])

    return {
      status: 'pushed',
      contactId,
      dealId,
      externalUrl: contactUrl(ctx.integration.externalAccountId, contactId),
      pulled: [...pulled, ...pulledDeal],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await crmSyncRecordRepository.upsert({
      organizationId,
      leadId,
      provider: PROVIDER,
      externalId: record?.externalId ?? '',
      externalUrl: record?.externalUrl ?? undefined,
      syncDirection: 'push',
      syncStatus: 'failed',
      lastSyncedAt: new Date(),
      errorMessage: message,
    })
    await syncRepo.logEvents([
      {
        organizationId,
        leadId,
        direction: 'push',
        objectType: 'deal',
        status: 'failed',
        message,
      },
    ])
    throw error
  }
}

/** Stored deal id, else a deal already associated to the contact, else none. */
const resolveDealId = async (
  organizationId: string,
  cfg: HubSpotSyncConfig,
  storedId: string | null,
  contactId: string,
): Promise<string | null> => {
  if (storedId) return storedId
  const dealIds = await hs.listAssociatedIds(
    organizationId,
    'contacts',
    contactId,
    'deals',
  )
  if (dealIds.length === 0) return null
  if (dealIds.length === 1 || !cfg.pipelineId) return dealIds[0]
  // Several deals: prefer an open one in the synced pipeline.
  const deals = await hs.batchRead(organizationId, 'deals', dealIds, [
    'pipeline',
    'hs_is_closed',
  ])
  const inPipeline = deals.filter(
    (d) => d.properties.pipeline === cfg.pipelineId,
  )
  return (
    (
      inPipeline.find((d) => d.properties.hs_is_closed !== 'true') ??
      inPipeline[0] ??
      deals[0]
    )?.id ?? null
  )
}

type UnloggedCall = Awaited<
  ReturnType<typeof syncRepo.findUnloggedCalls>
>[number]

type CallForBody = {
  dispositionLabel: string | null
  summary: string | null
  leadId: string | null
  nextStep: string | null
  nextStepSecured: boolean | null
  championName: string | null
  championScore: number | null
  qualityScore: number | null
  evidence: unknown
}

/** Summary + key moments from the call's deal signal, never the transcript. */
const callBody = (call: CallForBody) =>
  callBodyHtml({
    dispositionLabel: call.dispositionLabel,
    summary: call.summary,
    signal: {
      nextStep: call.nextStep,
      nextStepSecured: call.nextStepSecured,
      championName: call.championName,
      championScore: call.championScore,
      qualityScore: call.qualityScore,
      evidence: call.evidence,
    },
    leadUrl: call.leadId ? leadUrl(call.leadId) : null,
  })

const logCalls = async (
  organizationId: string,
  calls: UnloggedCall[],
  contactId: string,
  dealId: string | null,
): Promise<number> => {
  let logged = 0
  for (const call of calls) {
    const properties: Record<string, string> = {
      hs_timestamp: call.startedAt.toISOString(),
      hs_call_title: `OmniDial ${call.direction} call`,
      hs_call_body: callBody(call),
      hs_call_duration: String(call.duration * 1000),
      hs_call_direction: call.direction === 'inbound' ? 'INBOUND' : 'OUTBOUND',
      hs_call_status: 'COMPLETED',
      hs_call_from_number: call.fromNumber,
      hs_call_to_number: call.toNumber,
    }
    if (call.recordingUrl?.startsWith('https://'))
      properties.hs_call_recording_url = call.recordingUrl
    const associations: Array<{ toId: string; associationTypeId: number }> = [
      { toId: contactId, associationTypeId: hs.ASSOCIATION.callToContact },
    ]
    if (dealId)
      associations.push({
        toId: dealId,
        associationTypeId: hs.ASSOCIATION.callToDeal,
      })
    const created = await hs.createObject(
      organizationId,
      'calls',
      properties,
      associations,
    )
    await syncRepo.setCallActivityId(call.id, created.id)
    logged++
  }
  return logged
}

type PendingSignal = Awaited<
  ReturnType<typeof dealSignalRepository.findSignalsNeedingCrmActivity>
>[number]

const assoc = (
  contactId: string,
  dealId: string | null,
  toContact: number,
  toDeal: number,
) => [
  { toId: contactId, associationTypeId: toContact },
  ...(dealId ? [{ toId: dealId, associationTypeId: toDeal }] : []),
]

/**
 * Grain meetings -> HubSpot meetings; Gmail threads -> one HubSpot note per
 * thread on the deal, rewritten as the thread grows. Both carry summary +
 * key moments with links back to the recording / thread and OmniDial.
 */
const writeSignalActivities = async (
  organizationId: string,
  leadId: string,
  signals: PendingSignal[],
  contactId: string,
  dealId: string | null,
) => {
  let meetings = 0
  let notes = 0
  for (const signal of signals) {
    if (signal.source === 'meeting') {
      const touch = await dealTouchpointRepository.findBySource(
        organizationId,
        leadId,
        'grain',
        signal.sourceId,
      )
      const start = signal.occurredAt
      const end = touch?.durationSeconds
        ? new Date(start.getTime() + touch.durationSeconds * 1000)
        : start
      const created = await hs.createObject(
        organizationId,
        'meetings',
        {
          hs_timestamp: start.toISOString(),
          hs_meeting_title: 'Sales meeting (Grain)',
          hs_meeting_body: meetingBodyHtml({
            signal,
            recordingUrl: signal.sourceUrl,
            leadUrl: leadUrl(leadId),
          }),
          hs_meeting_start_time: start.toISOString(),
          hs_meeting_end_time: end.toISOString(),
          hs_meeting_outcome: 'COMPLETED',
          ...(signal.sourceUrl && {
            hs_meeting_external_url: signal.sourceUrl,
          }),
        },
        assoc(
          contactId,
          dealId,
          hs.ASSOCIATION.meetingToContact,
          hs.ASSOCIATION.meetingToDeal,
        ),
      )
      await dealSignalRepository.setCrmActivityId(signal.id, created.id)
      meetings++
      continue
    }

    // Email thread note
    const messages = await dealTouchpointRepository.threadStats(
      organizationId,
      leadId,
      signal.sourceId,
    )
    const timeline = buildTimeline(
      messages.map((m) => ({
        kind: 'email' as const,
        direction: (m.direction as 'inbound' | 'outbound' | null) ?? null,
        at: m.occurredAt,
        threadId: m.threadId,
      })),
    )
    const body = threadNoteHtml({
      signal,
      stats: {
        messages: messages.length,
        fromBuyer: messages.filter((m) => m.direction === 'inbound').length,
        fromRep: messages.filter((m) => m.direction === 'outbound').length,
        firstAt: timeline?.firstTouchAt ?? null,
        lastAt: timeline?.lastTouchAt ?? null,
        medianBuyerReplyHours: timeline
          ? medianOf(timeline.buyerReplyHours)
          : null,
      },
      threadUrl: signal.sourceUrl,
      leadUrl: leadUrl(leadId),
    })
    const properties = {
      hs_note_body: body,
      hs_timestamp: signal.occurredAt.toISOString(),
    }
    if (signal.crmActivityId) {
      try {
        await hs.updateObject(
          organizationId,
          'notes',
          signal.crmActivityId,
          properties,
        )
        notes++
        continue
      } catch (error) {
        if (!hs.isNotFound(error)) throw error
      }
    }
    const created = await hs.createObject(
      organizationId,
      'notes',
      properties,
      assoc(
        contactId,
        dealId,
        hs.ASSOCIATION.noteToContact,
        hs.ASSOCIATION.noteToDeal,
      ),
    )
    await dealSignalRepository.setCrmActivityId(signal.id, created.id)
    notes++
  }
  return { meetings, notes }
}

type Signal =
  | Awaited<ReturnType<typeof dealSignalRepository.findByLead>>[number]
  | undefined

interface TaskSpec {
  subject: string
  body: string
  dueAt: string
  type: 'CALL' | 'EMAIL' | 'TODO'
}

/** A secured, future next step becomes one open HubSpot task per deal. */
const nextStepTask = (signal: Signal): TaskSpec | null => {
  if (!signal?.nextStepSecured || !signal.nextStep || !signal.nextStepDueAt)
    return null
  if (signal.nextStepDueAt.getTime() < Date.now()) return null
  return {
    subject: `Next step: ${signal.nextStep}`.slice(0, 250),
    body: [
      signal.summary,
      `Agreed on ${signal.source} (${signal.occurredAt.toISOString().slice(0, 10)}). Logged by OmniDial.`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    dueAt: signal.nextStepDueAt.toISOString(),
    type:
      signal.nextStepChannel === 'call'
        ? 'CALL'
        : signal.nextStepChannel === 'email'
          ? 'EMAIL'
          : 'TODO',
  }
}

const upsertTask = async (
  organizationId: string,
  taskId: string | null,
  spec: TaskSpec,
  contactId: string,
  dealId: string | null,
): Promise<string> => {
  const properties = {
    hs_task_subject: spec.subject,
    hs_task_body: spec.body,
    hs_timestamp: spec.dueAt,
    hs_task_type: spec.type,
    hs_task_priority: 'MEDIUM',
  }
  if (taskId) {
    try {
      const existing = await hs.getObject(organizationId, 'tasks', taskId, [
        'hs_task_status',
      ])
      // A rep already completed it: leave it alone and open a fresh one only
      // when the next step itself changed.
      if (existing.properties.hs_task_status !== 'COMPLETED') {
        await hs.updateObject(organizationId, 'tasks', taskId, properties)
        return taskId
      }
      const subject = (
        await hs.getObject(organizationId, 'tasks', taskId, ['hs_task_subject'])
      ).properties.hs_task_subject
      if (subject === spec.subject) return taskId
    } catch (error) {
      if (!hs.isNotFound(error)) throw error
    }
  }
  const associations: Array<{ toId: string; associationTypeId: number }> = [
    { toId: contactId, associationTypeId: hs.ASSOCIATION.taskToContact },
  ]
  if (dealId)
    associations.push({
      toId: dealId,
      associationTypeId: hs.ASSOCIATION.taskToDeal,
    })
  const created = await hs.createObject(
    organizationId,
    'tasks',
    { ...properties, hs_task_status: 'NOT_STARTED' },
    associations,
  )
  return created.id
}

/**
 * A call ended or got a disposition. Unlogged calls are logged through the
 * lead's push; an already-logged call gets its HubSpot activity refreshed.
 */
export const syncCall = async (callId: string) => {
  const owner = await syncRepo.findLeadIdForCall(callId)
  if (!owner?.leadId || !owner.organizationId)
    return { status: 'skipped' as const }
  const integration = await integrationRepository.findByOrganizationAndProvider(
    owner.organizationId,
    PROVIDER,
  )
  if (!integration || !readSyncConfig(integration.config).writeBacks.calls) {
    return { status: 'skipped' as const }
  }
  const call = await syncRepo.findCallActivity(callId)
  if (call?.crmActivityId) {
    await hs.updateObject(owner.organizationId, 'calls', call.crmActivityId, {
      hs_call_body: callBody(call),
    })
    return { status: 'refreshed' as const }
  }
  return pushLead(owner.organizationId, owner.leadId)
}

// ------------------------------------------------------------ webhooks

export interface HubSpotWebhookEvent {
  eventId?: number | string
  subscriptionType?: string
  portalId?: number | string
  objectId?: number | string
  propertyName?: string
  propertyValue?: string
  occurredAt?: number
  changeSource?: string
  sourceId?: string
  primaryObjectId?: number | string
  mergedObjectIds?: Array<number | string>
}

const DEAL_EVENT_FIELDS = (cfg: HubSpotSyncConfig): Record<string, string> => ({
  [cfg.stageProperty]: STAGE_FIELD,
  amount: 'dealValue',
  closedate: 'dealClosedAt',
})

const integrationsForPortal = async (
  portalId: string | undefined,
): Promise<Integration[]> => {
  if (!portalId) return []
  const found = await syncRepo.findHubSpotIntegrationsByPortal(portalId)
  if (found.length > 0) return found
  // Connections made before portal ids were stored: look them up once.
  for (const integration of await syncRepo.findHubSpotIntegrationsWithoutPortal()) {
    await ensurePortalId(integration.organizationId).catch((error) =>
      logger.warn(
        { error, organizationId: integration.organizationId },
        'HubSpot portal lookup failed',
      ),
    )
  }
  return syncRepo.findHubSpotIntegrationsByPortal(portalId)
}

const isOwnEcho = (event: HubSpotWebhookEvent) =>
  !!config.hubspot.appId &&
  event.changeSource === 'INTEGRATION' &&
  String(event.sourceId ?? '').split(':')[0] === String(config.hubspot.appId)

/** Process verified webhook events. Merges first so deletions don't orphan merged contacts. */
export const handleWebhookEvents = async (events: HubSpotWebhookEvent[]) => {
  const order = (e: HubSpotWebhookEvent) =>
    e.subscriptionType?.endsWith('.merge') ? 0 : 1
  const sorted = [...events].sort((a, b) => order(a) - order(b))
  const tally = {
    received: events.length,
    applied: 0,
    ignored: 0,
    echoes: 0,
    failed: 0,
  }

  for (const event of sorted) {
    if (isOwnEcho(event)) {
      tally.echoes++
      continue
    }
    const integrations = await integrationsForPortal(
      event.portalId ? String(event.portalId) : undefined,
    )
    if (integrations.length === 0) {
      tally.ignored++
      continue
    }
    for (const integration of integrations) {
      try {
        const handled = await handleEventForOrg(integration, event)
        if (handled) tally.applied++
        else tally.ignored++
      } catch (error) {
        tally.failed++
        logger.error(
          { error, event, organizationId: integration.organizationId },
          'HubSpot webhook event failed',
        )
        await syncRepo.logEvents([
          {
            organizationId: integration.organizationId,
            direction: 'pull',
            objectType: event.subscriptionType?.startsWith('deal')
              ? 'deal'
              : 'contact',
            externalId: event.objectId ? String(event.objectId) : null,
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          },
        ])
      }
    }
  }
  return tally
}

const handleEventForOrg = async (
  integration: Integration,
  event: HubSpotWebhookEvent,
): Promise<boolean> => {
  const organizationId = integration.organizationId
  const cfg = readSyncConfig(integration.config)
  const objectId = event.objectId ? String(event.objectId) : ''
  const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date()

  switch (event.subscriptionType) {
    case 'contact.merge': {
      const primary = String(event.primaryObjectId ?? '')
      if (!primary) return false
      let moved = 0
      for (const mergedId of event.mergedObjectIds ?? []) {
        for (const record of await syncRepo.findRecordsByContact(
          organizationId,
          String(mergedId),
        )) {
          await crmSyncRecordRepository.update(
            organizationId,
            record.leadId,
            PROVIDER,
            {
              externalId: primary,
              externalUrl: contactUrl(integration.externalAccountId, primary),
              remoteDeletedAt: null,
              syncStatus: 'synced',
            },
          )
          moved++
        }
      }
      if (moved) {
        await syncRepo.logEvents([
          {
            organizationId,
            direction: 'pull',
            objectType: 'contact',
            externalId: primary,
            status: 'applied',
            changes: { merged: event.mergedObjectIds },
            message: `Re-linked ${moved} lead(s) to merged contact`,
          },
        ])
      }
      return moved > 0
    }

    case 'contact.deletion': {
      const records = await syncRepo.findRecordsByContact(
        organizationId,
        objectId,
      )
      for (const record of records) {
        // Unlink, keep the lead: deletions also fire for merges and cleanups.
        await crmSyncRecordRepository.update(
          organizationId,
          record.leadId,
          PROVIDER,
          {
            remoteDeletedAt: occurredAt,
            syncStatus: 'remote_deleted',
          },
        )
        await syncRepo.logEvents([
          {
            organizationId,
            leadId: record.leadId,
            direction: 'pull',
            objectType: 'contact',
            externalId: objectId,
            status: 'applied',
            message:
              'Contact deleted in HubSpot; lead kept, sync paused. Push manually to relink.',
          },
        ])
      }
      return records.length > 0
    }

    case 'contact.propertyChange': {
      const field = CONTACT_FIELDS[event.propertyName as ContactProperty]
      if (!field) return false
      let handled = false
      for (const record of await syncRepo.findRecordsByContact(
        organizationId,
        objectId,
      )) {
        if (record.remoteDeletedAt) continue
        const [lead] = await syncRepo.findLeadsForSync(organizationId, [
          record.leadId,
        ])
        if (!lead) continue
        const result = await applyRemoteChanges(
          organizationId,
          cfg,
          lead,
          [
            {
              field,
              remoteValue: event.propertyValue ?? null,
              remoteEditedAt: occurredAt,
              remoteFromOmniDial: isOwnEcho(event),
            },
          ],
          'pull',
        )
        await crmSyncRecordRepository.update(
          organizationId,
          record.leadId,
          PROVIDER,
          { lastPulledAt: new Date() },
        )
        handled = handled || result.applied.length > 0
      }
      return handled
    }

    case 'deal.propertyChange': {
      const field = DEAL_EVENT_FIELDS(cfg)[event.propertyName ?? '']
      if (!field) return false
      const record = await findOrAdoptDealRecord(organizationId, objectId)
      if (!record) return false
      const [lead] = await syncRepo.findLeadsForSync(organizationId, [
        record.leadId,
      ])
      if (!lead) return false
      const result = await applyRemoteChanges(
        organizationId,
        cfg,
        lead,
        [
          {
            field,
            remoteValue: event.propertyValue ?? null,
            remoteEditedAt: occurredAt,
            remoteFromOmniDial: isOwnEcho(event),
          },
        ],
        'pull',
      )
      await crmSyncRecordRepository.update(
        organizationId,
        record.leadId,
        PROVIDER,
        { lastPulledAt: new Date() },
      )
      return result.applied.length > 0
    }

    case 'deal.deletion': {
      const record = await syncRepo.findRecordByDeal(organizationId, objectId)
      if (!record) return false
      await crmSyncRecordRepository.update(
        organizationId,
        record.leadId,
        PROVIDER,
        {
          externalDealId: null,
          pushedHash: null,
        },
      )
      await syncRepo.logEvents([
        {
          organizationId,
          leadId: record.leadId,
          direction: 'pull',
          objectType: 'deal',
          externalId: objectId,
          status: 'applied',
          message:
            'Deal deleted in HubSpot; a new deal is created on the next push.',
        },
      ])
      return true
    }

    default:
      return false
  }
}

/** Deal not linked yet (pre-v2 sync): link it through its associated contact. */
const findOrAdoptDealRecord = async (
  organizationId: string,
  dealId: string,
) => {
  const linked = await syncRepo.findRecordByDeal(organizationId, dealId)
  if (linked) return linked
  const contactIds = await hs
    .listAssociatedIds(organizationId, 'deals', dealId, 'contacts')
    .catch(() => [])
  for (const contactId of contactIds) {
    const [record] = await syncRepo.findRecordsByContact(
      organizationId,
      contactId,
    )
    if (record && !record.externalDealId) {
      await crmSyncRecordRepository.update(
        organizationId,
        record.leadId,
        PROVIDER,
        { externalDealId: dealId },
      )
      return { ...record, externalDealId: dealId }
    }
  }
  return undefined
}

// ------------------------------------------------------------ reconcile

export interface DriftItem {
  leadId: string
  object: 'contact' | 'deal'
  field: string
  omnidial: unknown
  hubspot: unknown
  winner: 'omnidial' | 'hubspot'
}

export interface ReconcileReport {
  checked: number
  inSync: number
  drifted: number
  fixed: number
  missingInHubSpot: string[]
  unlinkedPipelineLeads: number
  pushedUnlinked: number
  orphanDeals: {
    count: number
    sample: Array<{ id: string; name: string | null }>
  }
  drift: DriftItem[]
  errors: string[]
}

/**
 * Compare every linked lead with HubSpot and (with fix) converge both sides,
 * newest edit winning per field. Also pushes pipeline leads that were never
 * linked and reports HubSpot deals in the pipeline that no lead owns.
 */
export const reconcile = async (
  organizationId: string,
  options: { fix?: boolean; maxPushUnlinked?: number } = {},
): Promise<ReconcileReport> => {
  const { config: cfg } = await loadContext(organizationId)
  const report: ReconcileReport = {
    checked: 0,
    inSync: 0,
    drifted: 0,
    fixed: 0,
    missingInHubSpot: [],
    unlinkedPipelineLeads: 0,
    pushedUnlinked: 0,
    orphanDeals: { count: 0, sample: [] },
    drift: [],
    errors: [],
  }

  const records = await syncRepo.findLinkedRecords(organizationId)
  const leads = new Map(
    (
      await syncRepo.findLeadsForSync(
        organizationId,
        records.map((r) => r.leadId),
      )
    ).map((l) => [l.id, l]),
  )
  const contactProps = Object.keys(CONTACT_FIELDS)
  const [contacts, deals] = await Promise.all([
    hs.batchRead(
      organizationId,
      'contacts',
      records.map((r) => r.externalId),
      contactProps,
      contactProps,
    ),
    hs.batchRead(
      organizationId,
      'deals',
      records.map((r) => r.externalDealId).filter((id): id is string => !!id),
      [...dealSyncProps(cfg), 'dealname', 'pipeline'],
      dealSyncProps(cfg),
    ),
  ])
  const contactById = new Map(contacts.map((c) => [c.id, c]))
  const dealById = new Map(deals.map((d) => [d.id, d]))
  const stages = await pipelineRepository.findByOrganizationId(organizationId)
  const appId = await ownAppId(organizationId)

  for (const record of records) {
    const lead = leads.get(record.leadId)
    if (!lead) continue
    report.checked++
    const contact = contactById.get(record.externalId)
    if (!contact) {
      report.missingInHubSpot.push(lead.id)
      if (options.fix) {
        await crmSyncRecordRepository.update(
          organizationId,
          lead.id,
          PROVIDER,
          {
            remoteDeletedAt: new Date(),
            syncStatus: 'remote_deleted',
          },
        )
      }
      continue
    }
    const deal = record.externalDealId
      ? dealById.get(record.externalDealId)
      : undefined

    const items = diffLead(lead, contact, deal, cfg, stages, appId)
    if (items.length === 0) {
      report.inSync++
      continue
    }
    report.drifted++
    report.drift.push(...items)

    if (options.fix) {
      try {
        const remoteChanges = [
          ...contactChanges(contact, appId),
          ...(deal ? dealChanges(cfg, deal, appId) : []),
        ].filter((c) =>
          items.some((i) => i.field === c.field && i.winner === 'hubspot'),
        )
        if (remoteChanges.length) {
          await applyRemoteChanges(
            organizationId,
            cfg,
            lead,
            remoteChanges,
            'reconcile',
          )
        }
        if (items.some((i) => i.winner === 'omnidial')) {
          await pushLead(organizationId, lead.id, { force: true })
        }
        report.fixed++
      } catch (error) {
        report.errors.push(
          `${lead.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  const unlinked = await syncRepo.findUnlinkedPipelineLeadIds(organizationId)
  report.unlinkedPipelineLeads = unlinked.length
  if (options.fix) {
    for (const leadId of unlinked.slice(0, options.maxPushUnlinked ?? 100)) {
      try {
        await pushLead(organizationId, leadId, { force: true })
        report.pushedUnlinked++
      } catch (error) {
        report.errors.push(
          `${leadId}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  }

  if (cfg.pipelineId && cfg.stageProperty === 'dealstage') {
    const pipelineDeals = await hs
      .searchObjects(
        organizationId,
        'deals',
        [{ propertyName: 'pipeline', operator: 'EQ', value: cfg.pipelineId }],
        ['dealname'],
        2000,
      )
      .catch(() => [])
    const linkedDeals = new Set(
      records.map((r) => r.externalDealId).filter(Boolean),
    )
    const orphans = pipelineDeals.filter((d) => !linkedDeals.has(d.id))
    report.orphanDeals = {
      count: orphans.length,
      sample: orphans
        .slice(0, 10)
        .map((d) => ({ id: d.id, name: d.properties.dealname ?? null })),
    }
  }

  await syncRepo.logEvents([
    {
      organizationId,
      direction: 'reconcile',
      objectType: 'deal',
      status: report.errors.length ? 'failed' : 'applied',
      changes: {
        checked: report.checked,
        inSync: report.inSync,
        drifted: report.drifted,
        fixed: report.fixed,
        unlinked: report.unlinkedPipelineLeads,
        pushedUnlinked: report.pushedUnlinked,
        orphans: report.orphanDeals.count,
        fix: !!options.fix,
      },
      message: report.errors.slice(0, 5).join('\n') || null,
    },
  ])
  return { ...report, drift: report.drift.slice(0, 200) }
}

const diffLead = (
  lead: LocalLead,
  contact: hs.HubSpotObject,
  deal: hs.HubSpotObject | undefined,
  cfg: HubSpotSyncConfig,
  stages: DBPipelineStage[],
  appId: string | undefined,
): DriftItem[] => {
  const items: DriftItem[] = []
  const expected = buildContactProperties(lead as LeadForSync)
  const winnerFor = (
    field: string,
    local: unknown,
    obj: hs.HubSpotObject,
    prop: string,
  ) => {
    const remote = historyOf(obj, prop, appId)
    const winner = resolveConflict(
      { editedAt: editedAt(lead, field), isEmpty: isBlank(local) },
      {
        editedAt: remote.remoteEditedAt,
        fromOmniDial: remote.remoteFromOmniDial,
      },
    )
    return winner === 'local' ? 'omnidial' : 'hubspot'
  }

  for (const prop of Object.keys(CONTACT_FIELDS) as ContactProperty[]) {
    const field = CONTACT_FIELDS[prop]
    const local = expected[prop] ?? null
    const remote = contact.properties[prop] ?? null
    if (sameValue(field, local, remote)) continue
    // OmniDial blank and HubSpot blank-equivalent is not drift; blank vs value is.
    if (isBlank(remote) && isBlank(local)) continue
    items.push({
      leadId: lead.id,
      object: 'contact',
      field,
      omnidial: local,
      hubspot: remote,
      winner: winnerFor(field, local, contact, prop),
    })
  }

  if (deal) {
    const expectedStage = stageValueFor(cfg, lead.pipelineStageId)
    const remoteStage = deal.properties[cfg.stageProperty] ?? null
    if (expectedStage && remoteStage && expectedStage !== remoteStage) {
      items.push({
        leadId: lead.id,
        object: 'deal',
        field: STAGE_FIELD,
        omnidial:
          stages.find((s) => s.id === lead.pipelineStageId)?.label ??
          lead.pipelineStageId,
        hubspot: remoteStage,
        winner: winnerFor(
          STAGE_FIELD,
          lead.pipelineStageId,
          deal,
          cfg.stageProperty,
        ),
      })
    }
    if (
      !sameValue('dealValue', lead.dealValue, deal.properties.amount ?? null)
    ) {
      items.push({
        leadId: lead.id,
        object: 'deal',
        field: 'dealValue',
        omnidial: lead.dealValue,
        hubspot: deal.properties.amount,
        winner: winnerFor('dealValue', lead.dealValue, deal, 'amount'),
      })
    }
    if (
      lead.dealClosedAt &&
      !sameValue(
        'dealClosedAt',
        lead.dealClosedAt,
        deal.properties.closedate ?? null,
      )
    ) {
      items.push({
        leadId: lead.id,
        object: 'deal',
        field: 'dealClosedAt',
        omnidial: lead.dealClosedAt,
        hubspot: deal.properties.closedate,
        winner: winnerFor('dealClosedAt', lead.dealClosedAt, deal, 'closedate'),
      })
    }
  }
  return items
}

/** Reconcile (with fixes) every org connected to HubSpot. Used by the 6-hourly job. */
export const reconcileAll = async () => {
  const integrations = await integrationRepository.findByProvider(PROVIDER)
  const results: Record<
    string,
    { drifted: number; fixed: number; errors: number } | { error: string }
  > = {}
  for (const integration of integrations) {
    try {
      const cfg = readSyncConfig(integration.config)
      if (!cfg.autoSync) continue
      const report = await reconcile(integration.organizationId, {
        fix: cfg.autoReconcile,
        maxPushUnlinked: 50,
      })
      results[integration.organizationId] = {
        drifted: report.drifted,
        fixed: report.fixed,
        errors: report.errors.length,
      }
    } catch (error) {
      results[integration.organizationId] = {
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
  return results
}

// ------------------------------------------------------------ setup & status

/** Create the "OmniDial" deal property group and properties (idempotent). */
export const setupProperties = async (organizationId: string) => {
  const created: string[] = []
  const existing: string[] = []
  const ignoreConflict = (error: unknown) => {
    if (error instanceof hs.HubSpotApiError && error.status === 409)
      return 'exists'
    if (error instanceof hs.HubSpotApiError && error.status === 403) {
      throw new Error(
        'HubSpot refused (403). Add the crm.schemas.deals.write scope to the app (Auth tab), then reconnect HubSpot in OmniDial.',
      )
    }
    throw error
  }
  await hs
    .createPropertyGroup(organizationId, 'deals', OMNIDIAL_PROPERTY_GROUP)
    .catch(ignoreConflict)
  for (const property of OMNIDIAL_DEAL_PROPERTIES) {
    const definition: hs.HubSpotProperty & { description: string } = {
      name: property.name,
      label: property.label,
      type: property.type,
      fieldType: property.fieldType,
      groupName: OMNIDIAL_PROPERTY_GROUP.name,
      ...('options' in property && {
        options: property.options.map((o) => ({ ...o })),
      }),
      description:
        'Managed by OmniDial. Edits here are overwritten on the next sync.',
    }
    const result = await hs
      .createProperty(organizationId, 'deals', definition)
      .then(() => 'created')
      .catch(ignoreConflict)
    ;(result === 'created' ? created : existing).push(property.name)
  }
  await saveSyncConfig(organizationId, {
    customPropertiesReady: true,
    customPropertiesVersion: OMNIDIAL_PROPERTIES_VERSION,
  })
  return { created, existing }
}

export const getStatus = async (organizationId: string) => {
  const { integration, config: cfg } = await loadContext(organizationId)
  const [tokenInfo, stages, linked, unlinked, events, recent] =
    await Promise.all([
      hs
        .getTokenInfo(organizationId)
        .catch((error: Error) => ({ error: error.message })),
      pipelineRepository.findByOrganizationId(organizationId),
      syncRepo.findLinkedRecords(organizationId),
      syncRepo.findUnlinkedPipelineLeadIds(organizationId),
      syncRepo.eventCounts(organizationId, new Date(Date.now() - 864e5)),
      syncRepo.recentEvents(organizationId, 10),
    ])
  const scopes = 'scopes' in tokenInfo ? tokenInfo.scopes : []
  if ('hub_id' in tokenInfo && !integration.externalAccountId) {
    await saveSyncConfig(organizationId, { portalId: String(tokenInfo.hub_id) })
  }
  const options = await getStageOptions(organizationId, cfg).catch(() => [])
  return {
    portalId:
      'hub_id' in tokenInfo
        ? String(tokenInfo.hub_id)
        : integration.externalAccountId,
    tokenError: 'error' in tokenInfo ? tokenInfo.error : null,
    missingRequiredScopes: REQUIRED_SCOPES.filter((s) => !scopes.includes(s)),
    missingOptionalScopes: Object.entries(OPTIONAL_SCOPES)
      .filter(([s]) => !scopes.includes(s))
      .map(([scope, purpose]) => ({ scope, purpose })),
    config: cfg,
    stageMapping: stages.map((s) => {
      const value = cfg.stageMap[s.id]
      return {
        omnidialStage: s.label,
        hubspotStage: value
          ? (options.find((o) => o.value === value)?.label ??
            `${value} (not found in HubSpot)`)
          : null,
      }
    }),
    webhook: {
      url: `${(config.backendUrl || '').replace(/\/$/, '')}/api/webhooks/hubspot`,
      echoSuppression: !!config.hubspot.appId,
    },
    linkedLeads: linked.length,
    failedLinks: linked.filter((r) => r.syncStatus === 'failed').length,
    unlinkedPipelineLeads: unlinked.length,
    last24h: events,
    recentEvents: recent,
  }
}

/** Webhook subscriptions the sync relies on. */
export const requiredWebhookSubscriptions = (cfg: HubSpotSyncConfig) => [
  { eventType: 'contact.deletion' },
  { eventType: 'contact.merge' },
  ...Object.keys(CONTACT_FIELDS).map((propertyName) => ({
    eventType: 'contact.propertyChange',
    propertyName,
  })),
  { eventType: 'deal.deletion' },
  ...[...new Set([cfg.stageProperty, 'dealstage', 'amount', 'closedate'])].map(
    (propertyName) => ({
      eventType: 'deal.propertyChange',
      propertyName,
    }),
  ),
]

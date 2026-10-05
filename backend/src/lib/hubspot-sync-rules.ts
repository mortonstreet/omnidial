/**
 * Pure rules for OmniDial <-> HubSpot sync: which fields map where, how
 * properties are built, and who wins a conflict. No I/O, so it is tested
 * directly (tests/hubspotSyncRules.test.ts).
 */
import { createHash } from 'crypto'
import {
  cleanText,
  normalizeEmail,
  normalizeLinkedInUrl,
} from '@/lib/lead-hygiene'
import { dealTrackingProperties } from '@/lib/hubspot-deal-properties'
import {
  DEAL_LOSS_REASONS,
  DEAL_WIN_REASONS,
} from '@shared/types/src/requests/dealMetrics'

// ------------------------------------------------------------ config

export interface HubSpotSyncConfig {
  /** HubSpot portal (hub) id, mirrored to integration.externalAccountId. */
  portalId?: string
  /** Push automatically on every relevant change. */
  autoSync: boolean
  /** Deal pipeline OmniDial deals live in. */
  pipelineId?: string
  /** Property holding the stage: "dealstage" or a custom dropdown (e.g. deal_stage_2). */
  stageProperty: string
  /** OmniDial pipeline_stage.id -> HubSpot stage id / dropdown option value. */
  stageMap: Record<string, string>
  /** Set once `hubspot setup-properties` has created the OmniDial property group. */
  customPropertiesReady: boolean
  /**
   * Let the 6-hourly reconcile fix drift automatically. Off until a manual
   * `hubspot reconcile` has been reviewed; until then the job only reports.
   */
  autoReconcile: boolean
  writeBacks: {
    calls: boolean
    tasks: boolean
    properties: boolean
    emails: boolean
  }
}

export const readSyncConfig = (raw: unknown): HubSpotSyncConfig => {
  const c = (raw ?? {}) as Partial<HubSpotSyncConfig> & Record<string, unknown>
  const w = (c.writeBacks ?? {}) as Partial<HubSpotSyncConfig['writeBacks']>
  return {
    portalId: c.portalId,
    autoSync: c.autoSync !== false,
    pipelineId: c.pipelineId,
    stageProperty: c.stageProperty || 'dealstage',
    stageMap: c.stageMap ?? {},
    customPropertiesReady: c.customPropertiesReady === true,
    autoReconcile: c.autoReconcile === true,
    writeBacks: {
      calls: w.calls !== false,
      tasks: w.tasks !== false,
      properties: w.properties !== false,
      emails: w.emails !== false,
    },
  }
}

// ------------------------------------------------------------ field maps

/** HubSpot contact property -> OmniDial lead column. Synced both ways. */
export const CONTACT_FIELDS = {
  firstname: 'firstName',
  lastname: 'lastName',
  email: 'email',
  phone: 'phone',
  company: 'company',
  jobtitle: 'title',
} as const

export type ContactProperty = keyof typeof CONTACT_FIELDS
export type LeadContactField = (typeof CONTACT_FIELDS)[ContactProperty]

/** Deal fields synced both ways (stage is added from config). */
export const DEAL_FIELDS = {
  amount: 'dealValue',
  closedate: 'dealClosedAt',
} as const

/** Local field name used in lead.syncFieldUpdatedAt for the stage. */
export const STAGE_FIELD = 'pipelineStageId'

// ------------------------------------------------------------ OmniDial properties

const reasonOptions = [...DEAL_LOSS_REASONS, ...DEAL_WIN_REASONS]
  .filter((r, i, all) => all.findIndex((x) => x.value === r.value) === i)
  .map((r, i) => ({ label: r.label, value: r.value, displayOrder: i }))

export const OMNIDIAL_PROPERTY_GROUP = { name: 'omnidial', label: 'OmniDial' }

/** Deal properties created by `hubspot setup-properties`. */
export const OMNIDIAL_DEAL_PROPERTIES = [
  {
    name: 'omnidial_lead_url',
    label: 'OmniDial lead',
    type: 'string',
    fieldType: 'text',
  },
  {
    name: 'omnidial_next_step_score',
    label: 'Next step score (0-10)',
    type: 'number',
    fieldType: 'number',
  },
  {
    name: 'omnidial_next_step_secured',
    label: 'Next step secured',
    type: 'bool',
    fieldType: 'booleancheckbox',
    options: [
      { label: 'Yes', value: 'true' },
      { label: 'No', value: 'false' },
    ],
  },
  {
    name: 'omnidial_champion_score',
    label: 'Champion score (0-10)',
    type: 'number',
    fieldType: 'number',
  },
  {
    name: 'omnidial_champion_name',
    label: 'Champion',
    type: 'string',
    fieldType: 'text',
  },
  {
    name: 'omnidial_engagement_score',
    label: 'Buyer engagement (0-10)',
    type: 'number',
    fieldType: 'number',
  },
  {
    name: 'omnidial_talk_time_minutes',
    label: 'Talk time (minutes)',
    type: 'number',
    fieldType: 'number',
  },
  {
    name: 'omnidial_first_quote',
    label: 'First quoted amount',
    type: 'number',
    fieldType: 'number',
  },
  {
    name: 'omnidial_outcome_reason',
    label: 'Win/loss reason (category)',
    type: 'enumeration',
    fieldType: 'select',
    options: reasonOptions,
  },
  {
    name: 'omnidial_last_touch_date',
    label: 'Last scored touchpoint',
    type: 'datetime',
    fieldType: 'date',
  },
] as const

// ------------------------------------------------------------ building

export interface LeadForSync {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  normalizedPhone: string | null
  company: string | null
  title: string | null
  linkedInUrl: string | null
  dealValue: string | number | null
  initialDealValue: string | number | null
  dealOutcome: string | null
  dealClosedAt: Date | null
  dealOutcomeReason: string | null
  dealOutcomeNotes: string | null
}

export interface SignalForSync {
  nextStep: string | null
  nextStepScore: number | null
  nextStepSecured: boolean
  championScore: number | null
  championName: string | null
  engagementScore: number | null
  occurredAt: Date
}

/**
 * Contact properties, cleaned: only valid emails, E.164 phones and
 * placeholder-free text reach HubSpot. Missing values are omitted (never sent
 * as "") so a sparse lead cannot blank out data a rep entered in HubSpot.
 */
export const buildContactProperties = (
  lead: LeadForSync,
): Record<string, string> => {
  const props: Record<string, string> = {}
  const set = (key: string, value: string | null | undefined) => {
    if (value) props[key] = value
  }
  set('firstname', cleanText(lead.firstName))
  set('lastname', cleanText(lead.lastName))
  set('email', normalizeEmail(lead.email))
  set('phone', lead.normalizedPhone)
  set('company', cleanText(lead.company))
  set('jobtitle', cleanText(lead.title))
  set('hs_linkedin_url', normalizeLinkedInUrl(lead.linkedInUrl))
  return props
}

export const dealName = (lead: LeadForSync): string => {
  const person = [cleanText(lead.firstName), cleanText(lead.lastName)]
    .filter(Boolean)
    .join(' ')
  const company = cleanText(lead.company)
  if (company && person) return `${company} - ${person}`
  return (
    company ||
    person ||
    normalizeEmail(lead.email) ||
    lead.normalizedPhone ||
    'OmniDial Lead'
  )
}

const num = (v: string | number | null) =>
  v === null || v === '' ? null : Number(v)

export const buildDealProperties = (params: {
  lead: LeadForSync
  config: HubSpotSyncConfig
  stageValue: string | null
  signal: SignalForSync | null
  talkTimeSeconds: number
  leadUrl: string
}): Record<string, string> => {
  const { lead, config, stageValue, signal } = params
  const props: Record<string, string> = { dealname: dealName(lead) }

  if (stageValue) {
    props[config.stageProperty] = stageValue
    if (config.stageProperty === 'dealstage' && config.pipelineId) {
      props.pipeline = config.pipelineId
    }
  }
  const amount = num(lead.dealValue)
  if (amount !== null && Number.isFinite(amount)) props.amount = String(amount)

  Object.assign(
    props,
    dealTrackingProperties({
      dealOutcome: lead.dealOutcome,
      dealClosedAt: lead.dealClosedAt,
      dealOutcomeReason: lead.dealOutcomeReason,
      dealOutcomeNotes: lead.dealOutcomeNotes,
      nextStep: signal?.nextStep ?? null,
    }),
  )

  if (config.customPropertiesReady && config.writeBacks.properties) {
    const set = (
      key: string,
      value: string | number | boolean | null | undefined,
    ) => {
      if (value !== null && value !== undefined && value !== '')
        props[key] = String(value)
    }
    set('omnidial_lead_url', params.leadUrl)
    set('omnidial_talk_time_minutes', Math.round(params.talkTimeSeconds / 60))
    set('omnidial_first_quote', num(lead.initialDealValue))
    set('omnidial_outcome_reason', lead.dealOutcomeReason)
    if (signal) {
      set('omnidial_next_step_score', signal.nextStepScore)
      set('omnidial_next_step_secured', signal.nextStepSecured)
      set('omnidial_champion_score', signal.championScore)
      set('omnidial_champion_name', signal.championName)
      set('omnidial_engagement_score', signal.engagementScore)
      set('omnidial_last_touch_date', signal.occurredAt.toISOString())
    }
  }
  return props
}

/** Stable hash of what would be pushed; identical pushes are skipped. */
export const hashProperties = (value: unknown): string => {
  const stable = (v: unknown): unknown =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v as object)
            .sort()
            .map((k) => [k, stable((v as Record<string, unknown>)[k])]),
        )
      : v
  return createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex')
}

// ------------------------------------------------------------ conflicts

export type ConflictWinner = 'local' | 'remote'

/**
 * Newest edit wins. A local field with no recorded edit time predates
 * tracking, so the remote edit (which has a real timestamp) wins.
 */
export const resolveConflict = (
  localEditedAt: string | Date | null | undefined,
  remoteEditedAt: string | Date | null | undefined,
): ConflictWinner => {
  const remote = remoteEditedAt ? new Date(remoteEditedAt).getTime() : NaN
  const local = localEditedAt ? new Date(localEditedAt).getTime() : NaN
  if (Number.isNaN(remote)) return 'local'
  if (Number.isNaN(local)) return 'remote'
  return local >= remote ? 'local' : 'remote'
}

/** HubSpot stage value -> OmniDial stage id via the configured map. */
export const reverseStageLookup = (
  stageMap: Record<string, string>,
  hubspotValue: string,
): string | undefined =>
  Object.entries(stageMap).find(([, value]) => value === hubspotValue)?.[0]

/** Compare a local value to a HubSpot property value, ignoring format noise. */
export const sameValue = (
  field: string,
  local: string | number | Date | null | undefined,
  remote: string | null | undefined,
): boolean => {
  const l =
    local instanceof Date
      ? local.toISOString()
      : local === null || local === undefined
        ? ''
        : String(local)
  const r = remote ?? ''
  if (!l && !r) return true
  if (field === 'dealValue') return Number(l || 0) === Number(r || 0)
  if (field === 'dealClosedAt') {
    // HubSpot stores close dates at day precision in some portals.
    return (
      !!l &&
      !!r &&
      new Date(l).toISOString().slice(0, 10) ===
        new Date(r).toISOString().slice(0, 10)
    )
  }
  if (field === 'email') return l.toLowerCase() === r.toLowerCase()
  if (field === 'phone')
    return l.replace(/\D/g, '').slice(-10) === r.replace(/\D/g, '').slice(-10)
  return l.trim() === r.trim()
}

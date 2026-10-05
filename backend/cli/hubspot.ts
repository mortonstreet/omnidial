/**
 * HubSpot sync control panel - run from Claude Code or a terminal:
 *
 *   pnpm --filter backend hubspot status
 *   pnpm --filter backend hubspot pipelines
 *   pnpm --filter backend hubspot map-stages [--pipeline <id>] [--property deal_stage_2]
 *   pnpm --filter backend hubspot map-stages --set "Demo Booked=Appointment Scheduled"
 *   pnpm --filter backend hubspot setup-properties
 *   pnpm --filter backend hubspot sync-stages
 *   pnpm --filter backend hubspot config [autoSync=true] [autoReconcile=true] [writeBacks.calls=false]
 *   pnpm --filter backend hubspot reconcile [--fix]
 *   pnpm --filter backend hubspot push --lead <leadId> | --unlinked
 *   pnpm --filter backend hubspot webhooks [--apply]
 *   pnpm --filter backend hubspot events [--limit 30]
 *   pnpm --filter backend hubspot reconnect-url [--backend https://api.omnidial.io]
 *
 * Add --org <organizationId> when more than one org has HubSpot connected.
 * Reads the same env as the backend (DATABASE/REDIS/HUBSPOT_* vars).
 */
import { config } from '@/config'
import * as integrationRepository from '@/repositories/integration.repository'
import * as syncRepo from '@/repositories/hubspotSync.repository'
import * as sync from '@/services/hubspotSync.service'
import * as hs from '@/clients/crm/hubspotApi'
import { readSyncConfig } from '@/lib/hubspot-sync-rules'
import * as hubspotService from '@/services/hubspot.service'

const args = process.argv.slice(2)
const command = args[0]
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0
    ? args[i + 1] && !args[i + 1].startsWith('--')
      ? args[i + 1]
      : true
    : undefined
}
const print = (value: unknown) => console.log(JSON.stringify(value, null, 2))

const resolveOrg = async (): Promise<string> => {
  const explicit = flag('org')
  if (typeof explicit === 'string') return explicit
  const integrations = await integrationRepository.findByProvider('hubspot')
  if (integrations.length === 1) return integrations[0].organizationId
  if (integrations.length === 0)
    throw new Error(
      'No organization has HubSpot connected. Connect it in Settings → Integrations.',
    )
  throw new Error(
    `Several orgs have HubSpot connected; pass --org <id>:\n${integrations.map((i) => `  ${i.organizationId}`).join('\n')}`,
  )
}

const parseValue = (raw: string): unknown =>
  raw === 'true'
    ? true
    : raw === 'false'
      ? false
      : /^\d+$/.test(raw)
        ? Number(raw)
        : raw

const commands: Record<string, (org: string) => Promise<unknown>> = {
  status: (org) => sync.getStatus(org),

  pipelines: async (org) => {
    const pipelines = await hs.listDealPipelines(org)
    return pipelines.map((p) => ({
      id: p.id,
      label: p.label,
      stages: p.stages
        .filter((s) => !s.archived)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(
          (s) =>
            `${s.label}  [${s.id}]${s.metadata?.isClosed === 'true' ? ` closed p=${s.metadata.probability}` : ''}`,
        ),
    }))
  },

  'map-stages': async (org) => {
    const set = flag('set')
    if (typeof set === 'string') {
      const [local, remote] = set.split('=').map((s) => s.trim())
      if (!local || !remote)
        throw new Error('Use --set "OmniDial stage=HubSpot stage"')
      await sync.setStageMapping(org, local, remote)
      return (await sync.getStatus(org)).stageMapping
    }
    const pipeline = flag('pipeline')
    const property = flag('property')
    const result = await sync.autoMapStages(org, {
      pipelineId: typeof pipeline === 'string' ? pipeline : undefined,
      stageProperty: typeof property === 'string' ? property : undefined,
    })
    return {
      mapping: (await sync.getStatus(org)).stageMapping,
      unmatched: result.unmatched,
      hint: result.unmatched.length
        ? 'Map the rest with: hubspot map-stages --set "<OmniDial stage>=<HubSpot stage>"'
        : 'All OmniDial stages are mapped.',
    }
  },

  'setup-properties': (org) => sync.setupProperties(org),

  /** Add OmniDial stages missing from HubSpot's stage dropdown, then re-map. */
  'sync-stages': (org) => sync.syncStagesToHubSpot(org),

  config: async (org) => {
    const assignments = args
      .slice(1)
      .filter((a) => a.includes('=') && !a.startsWith('--'))
    if (assignments.length === 0) return (await sync.getStatus(org)).config
    const integration =
      await integrationRepository.findByOrganizationAndProvider(org, 'hubspot')
    const current = readSyncConfig(integration?.config)
    const patch: Record<string, unknown> = {}
    for (const assignment of assignments) {
      const [key, raw] = assignment.split('=')
      const value = parseValue(raw)
      if (key.startsWith('writeBacks.')) {
        patch.writeBacks = {
          ...current.writeBacks,
          ...(patch.writeBacks as object),
          [key.slice(11)]: value,
        }
      } else if (
        ['autoSync', 'autoReconcile', 'pipelineId', 'stageProperty'].includes(
          key,
        )
      ) {
        patch[key] = value
      } else {
        throw new Error(
          `Unknown setting "${key}". Settable: autoSync, autoReconcile, pipelineId, stageProperty, writeBacks.{calls,tasks,properties,emails}`,
        )
      }
    }
    return sync.saveSyncConfig(org, patch)
  },

  reconcile: (org) => sync.reconcile(org, { fix: flag('fix') === true }),

  push: async (org) => {
    const lead = flag('lead')
    if (typeof lead === 'string')
      return sync.pushLead(org, lead, { force: true })
    if (flag('unlinked')) {
      const ids = await syncRepo.findUnlinkedPipelineLeadIds(org)
      const results: Record<string, string> = {}
      for (const id of ids) {
        results[id] = await sync
          .pushLead(org, id, { force: true })
          .then((r) => r.status)
          .catch((error: Error) => `failed: ${error.message}`)
      }
      return { total: ids.length, results }
    }
    throw new Error('Use --lead <id> or --unlinked')
  },

  webhooks: async (org) => {
    const integration =
      await integrationRepository.findByOrganizationAndProvider(org, 'hubspot')
    const wanted = sync.requiredWebhookSubscriptions(
      readSyncConfig(integration?.config),
    )
    const targetUrl = `${(config.backendUrl || '').replace(/\/$/, '')}/api/webhooks/hubspot`
    const { appId, developerApiKey } = config.hubspot
    if (!flag('apply') || !appId || !developerApiKey) {
      return {
        targetUrl,
        subscriptions: wanted,
        note:
          !appId || !developerApiKey
            ? 'Set HUBSPOT_APP_ID and HUBSPOT_DEVELOPER_API_KEY to apply these with --apply, or add them in the app → Webhooks tab.'
            : 'Re-run with --apply to create missing subscriptions.',
      }
    }
    return applyWebhookSubscriptions(appId, developerApiKey, targetUrl, wanted)
  },

  /**
   * Re-authorize link that keeps the existing connection (stage map, portal,
   * links) and only swaps the token - needed after adding scopes to the app.
   * Disconnect + connect would delete the integration's sync settings.
   */
  'reconnect-url': async (org) => {
    const integration =
      await integrationRepository.findByOrganizationAndProvider(org, 'hubspot')
    if (!integration) throw new Error('HubSpot is not connected')
    const backend = flag('backend')
    const backendUrl = (
      typeof backend === 'string' ? backend : config.backendUrl || ''
    ).replace(/\/$/, '')
    const state = Buffer.from(
      JSON.stringify({
        organizationId: org,
        provider: 'hubspot',
        userId: integration.connectedById,
        redirectUrl: '/dashboard/settings/integrations',
        timestamp: Date.now(),
      }),
    ).toString('base64url')
    return {
      url: hubspotService.getOAuthUrl(
        state,
        `${backendUrl}/api/integrations/hubspot/callback`,
      ),
      note: 'Open while logged into HubSpot as a portal admin and approve. The connection keeps its sync settings.',
    }
  },

  events: async (org) => {
    const limit = Number(flag('limit')) || 30
    return syncRepo.recentEvents(org, limit)
  },
}

const applyWebhookSubscriptions = async (
  appId: string,
  key: string,
  targetUrl: string,
  wanted: Array<{ eventType: string; propertyName?: string }>,
) => {
  const base = `https://api.hubapi.com/webhooks/v3/${appId}`
  const call = async (path: string, method: string, body?: unknown) => {
    const response = await fetch(
      `${base}${path}?hapikey=${encodeURIComponent(key)}`,
      {
        method,
        headers: { 'Content-Type': 'application/json' },
        ...(body !== undefined && { body: JSON.stringify(body) }),
      },
    )
    const text = await response.text()
    if (!response.ok)
      throw new Error(
        `HubSpot ${method} ${path} failed (${response.status}): ${text.slice(0, 300)}`,
      )
    return text ? JSON.parse(text) : undefined
  }

  await call('/settings', 'PUT', {
    targetUrl,
    throttling: { maxConcurrentRequests: 10 },
  })
  const existing = ((await call('/subscriptions', 'GET'))?.results ??
    []) as Array<{
    eventType: string
    propertyName?: string
  }>
  const created: string[] = []
  for (const sub of wanted) {
    const has = existing.some(
      (e) =>
        e.eventType === sub.eventType &&
        (e.propertyName ?? '') === (sub.propertyName ?? ''),
    )
    if (has) continue
    await call('/subscriptions', 'POST', { ...sub, active: true })
    created.push(
      `${sub.eventType}${sub.propertyName ? `:${sub.propertyName}` : ''}`,
    )
  }
  return { targetUrl, created, alreadyPresent: wanted.length - created.length }
}

const main = async () => {
  const run = commands[command]
  if (!run) {
    console.log(
      `Usage: hubspot <${Object.keys(commands).join('|')}> [--org <id>]`,
    )
    process.exit(command ? 1 : 0)
  }
  const org = await resolveOrg()
  print(await run(org))
  process.exit(0)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})

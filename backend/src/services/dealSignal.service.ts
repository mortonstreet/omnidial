/**
 * Deal signals: AI scoring of each sales touchpoint for next-step quality,
 * champion engagement, buyer engagement and rep execution.
 *
 *   call    -> existing call transcripts (Twilio recording -> transcription)
 *   email   -> read-only Gmail threads with pipeline leads
 *   meeting -> Grain meeting recordings matched to leads by attendee email
 */
import * as dealSignalRepository from '@/repositories/dealSignal.repository'
import * as integrationRepository from '@/repositories/integration.repository'
import * as gmailReader from '@/clients/gmailReader.client'
import * as grainClient from '@/clients/grain.client'
import { completeJson } from '@/clients/openrouter.client'
import { decrypt, encrypt } from '@/lib/encryption'
import { isTranscriptReadyForAnalysis } from '@/services/salesCoach.service'
import { mapWithConcurrency } from '@/utils/concurrency'
import * as dealTouchpointRepository from '@/repositories/dealTouchpoint.repository'
import { anyAddressOnDomain, companyDomain } from '@/lib/email-domain'
import { enqueueCallSync, enqueueCrmSync } from '@/queues/crm-sync.queue'
import * as hubspotApi from '@/clients/crm/hubspotApi'
import * as hubspotSyncRepository from '@/repositories/hubspotSync.repository'
import { readSyncConfig } from '@/lib/hubspot-sync-rules'
import { stripQuotedReply } from '@/lib/email-text'
import {
  DEAL_SIGNAL_SYSTEM_PROMPT,
  buildDealSignalUserPrompt,
  normalizeDealSignal,
  type DealSignalScores,
  type SignalSource,
} from '@/lib/deal-signal-analysis'

const DEAL_SIGNAL_MODEL =
  process.env.DEAL_SIGNAL_MODEL || 'anthropic/claude-sonnet-4.5'

const DAY_MS = 24 * 60 * 60 * 1000
/** How far back the first sync of a new Gmail / Grain connection looks. */
const FIRST_SYNC_LOOKBACK_DAYS = 60
/** Bounded so one sync request stays well inside the request timeout. */
const MAX_LEADS_PER_GMAIL_SYNC = 150
/** Touch history for the timeline: up to this many threads per lead. */
const MAX_THREADS_PER_LEAD = 20
/** AI-score only the most recent threads per open deal (bounded model cost). */
const MAX_SCORED_THREADS_PER_LEAD = 3
/** First Gmail sync reaches this far back so long-running deals have history. */
const GMAIL_HISTORY_DAYS = 365
const MAX_RECORDINGS_PER_GRAIN_SYNC = 40

export interface SyncResult {
  scored: number
  skipped: number
  failed: number
  errors: string[]
}

const emptyResult = (): SyncResult => ({
  scored: 0,
  skipped: 0,
  failed: 0,
  errors: [],
})

const scoreTouchpoint = async (params: {
  source: SignalSource
  occurredAt: Date
  content: string
  context?: string
}): Promise<DealSignalScores> => {
  const { data } = await completeJson<unknown>({
    model: DEAL_SIGNAL_MODEL,
    system: DEAL_SIGNAL_SYSTEM_PROMPT,
    user: buildDealSignalUserPrompt(params),
    title: 'OmniDial Deal Signals',
  })
  return normalizeDealSignal(data)
}

const saveSignal = async (
  base: {
    organizationId: string
    leadId: string
    userId: string | null
    source: SignalSource
    sourceId: string
    sourceUrl?: string | null
    sourceUpdatedAt?: Date | null
    occurredAt: Date
  },
  scores: DealSignalScores,
) => {
  const signal = await dealSignalRepository.upsert({
    ...base,
    sourceUrl: base.sourceUrl ?? null,
    sourceUpdatedAt: base.sourceUpdatedAt ?? null,
    ...scores,
    evidence: JSON.stringify(scores.evidence),
    modelUsed: DEAL_SIGNAL_MODEL,
  })
  // New next step / scores -> HubSpot deal properties and task.
  await enqueueCrmSync(base.organizationId, base.leadId)
  // A newly scored call: rewrite its HubSpot call activity with key moments.
  if (base.source === 'call') await enqueueCallSync(base.sourceId)
  return signal
}

const recordFailure = (result: SyncResult, label: string, error: unknown) => {
  result.failed++
  if (result.errors.length < 5) {
    result.errors.push(
      `${label}: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
}

// ---------------------------------------------------------------- calls

/**
 * Score one call. Uses an existing transcript only - transcription has its own
 * cost and trigger (coaching / intelligence), this never starts one.
 */
export const scoreCall = async (organizationId: string, callId: string) => {
  const call = await dealSignalRepository.findCallForSignal(
    organizationId,
    callId,
  )
  if (!call?.leadId || !isTranscriptReadyForAnalysis(call)) return null

  const scores = await scoreTouchpoint({
    source: 'call',
    occurredAt: call.startedAt,
    content: call.transcriptText,
    context: `${call.direction} call, ${Math.round(call.duration / 60)} min`,
  })
  return saveSignal(
    {
      organizationId,
      leadId: call.leadId,
      userId: call.userId,
      source: 'call',
      sourceId: call.id,
      occurredAt: call.startedAt,
    },
    scores,
  )
}

/** Score transcribed calls that have no signal yet, newest first. */
export const backfillCallSignals = async (
  organizationId: string,
  limit = 25,
): Promise<SyncResult> => {
  const result = emptyResult()
  const calls = await dealSignalRepository.findUnscoredTranscribedCalls(
    organizationId,
    limit,
  )
  await mapWithConcurrency(calls, 3, async ({ callId }) => {
    try {
      const signal = await scoreCall(organizationId, callId)
      if (signal) result.scored++
      else result.skipped++
    } catch (error) {
      recordFailure(result, `call ${callId}`, error)
    }
  })
  return result
}

// ---------------------------------------------------------------- gmail

const decryptToken = (token: string | null | undefined) => {
  if (!token) return undefined
  try {
    return decrypt(token)
  } catch {
    return token
  }
}

const getGmailAccess = async (organizationId: string) => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'gmail',
  )
  if (!integration?.accessToken) {
    throw new Error('Gmail is not connected')
  }

  let accessToken = decryptToken(integration.accessToken)!
  const expiresAt = integration.tokenExpiresAt?.getTime() ?? 0
  if (expiresAt < Date.now() + 5 * 60 * 1000) {
    const refreshToken = decryptToken(integration.refreshToken)
    if (!refreshToken) {
      throw new Error('Gmail token expired. Reconnect Gmail in Integrations.')
    }
    const refreshed = await gmailReader.refreshAccessToken(refreshToken)
    accessToken = refreshed.accessToken
    await integrationRepository.update(organizationId, 'gmail', {
      accessToken: encrypt(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
    })
  }

  const config = (integration.config ?? {}) as { mailbox?: string }
  return {
    gmail: gmailReader.createGmail(accessToken),
    mailbox: config.mailbox ?? null,
    userId: integration.connectedById,
    lastSyncAt: integration.lastSyncAt,
  }
}

const syncSince = (lastSyncAt: Date | null) =>
  lastSyncAt
    ? new Date(lastSyncAt.getTime() - DAY_MS) // overlap: Gmail's after: is day-granular
    : new Date(Date.now() - FIRST_SYNC_LOOKBACK_DAYS * DAY_MS)

/**
 * Score recent email threads with every open pipeline lead. A thread is only
 * re-scored when a new message has arrived since it was last scored.
 */
/**
 * Read-only Gmail lookup per pipeline lead: by email address, or, with no
 * email, by full name restricted to threads that include someone at the
 * lead's company domain (no false matches on common names).
 *
 * Every message of a matched thread is recorded on the touch timeline (open
 * and closed deals, a year back) so cycle, reply-time and gap metrics have
 * receipts. Only the most recent threads of open deals are AI-scored.
 */
export const syncGmailSignals = async (
  organizationId: string,
): Promise<SyncResult & { leadsChecked: number; touchesRecorded: number }> => {
  const result = emptyResult()
  const access = await getGmailAccess(organizationId)
  const since = access.lastSyncAt
    ? syncSince(access.lastSyncAt)
    : new Date(Date.now() - GMAIL_HISTORY_DAYS * DAY_MS)
  const leads = (
    await dealSignalRepository.findPipelineLeadsForEmail(organizationId)
  ).slice(0, MAX_LEADS_PER_GMAIL_SYNC)
  let touchesRecorded = 0

  await mapWithConcurrency(leads, 3, async (lead) => {
    const label = lead.email ?? [lead.firstName, lead.lastName].join(' ')
    try {
      const domain = companyDomain(lead)
      const fullName = [lead.firstName, lead.lastName]
        .filter(Boolean)
        .join(' ')
        .trim()
      let threadIds: string[]
      let requireDomain: string | null = null
      if (lead.email) {
        threadIds = await gmailReader.listThreadIdsWithContact(
          access.gmail,
          lead.email,
          since,
          MAX_THREADS_PER_LEAD,
        )
      } else if (domain && fullName.includes(' ')) {
        threadIds = await gmailReader.listThreadIdsByName(
          access.gmail,
          fullName,
          since,
          MAX_THREADS_PER_LEAD,
        )
        requireDomain = domain
      } else {
        result.skipped++
        return
      }

      // Gmail returns most recent threads first.
      for (const [index, threadId] of threadIds.entries()) {
        const outcome = await processThread(
          organizationId,
          access,
          lead.id,
          threadId,
          {
            requireDomain,
            score: !lead.dealOutcome && index < MAX_SCORED_THREADS_PER_LEAD,
            result,
          },
        )
        touchesRecorded += outcome.touches
      }
    } catch (error) {
      recordFailure(result, label, error)
    }
  })

  await integrationRepository.update(organizationId, 'gmail', {
    lastSyncAt: new Date(),
  })
  return { ...result, leadsChecked: leads.length, touchesRecorded }
}

const processThread = async (
  organizationId: string,
  access: Awaited<ReturnType<typeof getGmailAccess>>,
  leadId: string,
  threadId: string,
  options: { requireDomain: string | null; score: boolean; result: SyncResult },
): Promise<{ touches: number }> => {
  const digest = await gmailReader.getThreadDigest(access.gmail, threadId)
  if (
    options.requireDomain &&
    !digest.messages.some((m) =>
      anyAddressOnDomain(m.addresses, options.requireDomain!),
    )
  ) {
    return { touches: 0 } // name matched, but nobody from their company: someone else
  }

  const mailbox = access.mailbox?.toLowerCase()
  await dealTouchpointRepository.upsertMany(
    digest.messages.map((m) => ({
      organizationId,
      leadId,
      kind: 'email',
      direction:
        !mailbox || !m.fromEmail
          ? null
          : m.fromEmail === mailbox
            ? 'outbound'
            : 'inbound',
      source: 'gmail',
      sourceId: m.id,
      threadId,
      occurredAt: m.at,
      durationSeconds: null,
    })),
  )

  if (options.score) {
    await scoreThread(organizationId, access, leadId, digest, options.result)
  }
  return { touches: digest.messages.length }
}

const scoreThread = async (
  organizationId: string,
  access: Awaited<ReturnType<typeof getGmailAccess>>,
  leadId: string,
  digest: gmailReader.ThreadDigest,
  result: SyncResult,
) => {
  const threadId = digest.threadId
  const existing = (
    await dealSignalRepository.findBySource(organizationId, 'email', threadId)
  ).find((signal) => signal.leadId === leadId)
  if (
    existing?.sourceUpdatedAt &&
    existing.sourceUpdatedAt.getTime() >= digest.lastMessageAt.getTime()
  ) {
    result.skipped++
    return
  }

  const scores = await scoreTouchpoint({
    source: 'email',
    occurredAt: digest.lastMessageAt,
    content: `Subject: ${digest.subject}\n\n${digest.text}`,
    context: access.mailbox
      ? `The sales rep is ${access.mailbox}; everyone else is buyer-side.`
      : undefined,
  })
  await saveSignal(
    {
      organizationId,
      leadId,
      userId: access.userId,
      source: 'email',
      sourceId: threadId,
      sourceUrl: `https://mail.google.com/mail/u/0/#all/${threadId}`,
      sourceUpdatedAt: digest.lastMessageAt,
      occurredAt: digest.lastMessageAt,
    },
    scores,
  )
  result.scored++
}

// ---------------------------------------------------------------- grain

export const syncGrainSignals = async (
  organizationId: string,
): Promise<SyncResult & { unmatched: number }> => {
  const integration = await integrationRepository.findByOrganizationAndProvider(
    organizationId,
    'grain',
  )
  const token = decryptToken(integration?.accessToken)
  if (!integration || !token) {
    throw new Error('Grain is not connected')
  }

  const result = emptyResult()
  let unmatched = 0
  const recordings = (
    await grainClient.listRecordings(token, syncSince(integration.lastSyncAt))
  ).slice(0, MAX_RECORDINGS_PER_GRAIN_SYNC)

  await mapWithConcurrency(recordings, 2, async (recording) => {
    try {
      const emails = (recording.participants ?? [])
        .filter((p) => p.scope !== 'internal' && p.email)
        .map((p) => p.email!)
      const leads = await dealSignalRepository.findLeadIdsByEmails(
        organizationId,
        emails,
      )
      if (leads.length === 0) {
        unmatched++
        return
      }
      const existing = await dealSignalRepository.findBySource(
        organizationId,
        'meeting',
        recording.id,
      )
      if (leads.every((lead) => existing.some((s) => s.leadId === lead.id))) {
        result.skipped++
        return
      }

      const occurredAt = new Date(recording.start_datetime)
      const durationSeconds = recording.end_datetime
        ? Math.max(
            0,
            Math.round(
              (new Date(recording.end_datetime).getTime() -
                occurredAt.getTime()) /
                1000,
            ),
          )
        : recording.duration_ms
          ? Math.round(recording.duration_ms / 1000)
          : null
      await dealTouchpointRepository.upsertMany(
        leads.map((lead) => ({
          organizationId,
          leadId: lead.id,
          kind: 'meeting',
          direction: null,
          source: 'grain',
          sourceId: recording.id,
          threadId: null,
          occurredAt,
          durationSeconds,
        })),
      )
      const transcript = await grainClient.getTranscriptText(
        token,
        recording.id,
      )
      const scores = await scoreTouchpoint({
        source: 'meeting',
        occurredAt,
        content: transcript,
        context: `Meeting "${recording.title}". Buyer-side attendees: ${emails.join(', ')}`,
      })
      // One meeting can cover several leads from the same buying group.
      for (const lead of leads) {
        await saveSignal(
          {
            organizationId,
            leadId: lead.id,
            userId: integration.connectedById,
            source: 'meeting',
            sourceId: recording.id,
            sourceUrl: recording.url,
            sourceUpdatedAt: occurredAt,
            occurredAt,
          },
          scores,
        )
      }
      result.scored++
    } catch (error) {
      recordFailure(result, `recording ${recording.id}`, error)
    }
  })

  await integrationRepository.update(organizationId, 'grain', {
    lastSyncAt: new Date(),
  })
  return { ...result, unmatched }
}

// ---------------------------------------------------------------- hubspot emails

const HUBSPOT_EMAIL_PROPS = [
  'hs_timestamp',
  'hs_email_subject',
  'hs_email_text',
  'hs_email_direction',
  'hs_email_from_email',
  'hs_email_to_email',
  'hs_email_thread_id',
]
const MAX_EMAILS_PER_DIGEST = 15

/**
 * Score the one-to-one emails HubSpot already logs from reps' connected
 * inboxes (needs the sales-email-read scope). One signal per contact covers
 * its recent email history; re-scored only when a newer email is logged.
 */
export const syncHubSpotEmailSignals = async (
  organizationId: string,
): Promise<SyncResult & { leadsChecked: number }> => {
  const result = emptyResult()
  const records = (
    await hubspotSyncRepository.findLinkedRecords(organizationId)
  ).slice(0, MAX_LEADS_PER_GMAIL_SYNC)
  const since = Date.now() - FIRST_SYNC_LOOKBACK_DAYS * DAY_MS

  await mapWithConcurrency(records, 2, async (record) => {
    try {
      const emailIds = await hubspotApi.listAssociatedIds(
        organizationId,
        'contacts',
        record.externalId,
        'emails',
      )
      if (emailIds.length === 0) return
      const logged = await hubspotApi.batchRead(
        organizationId,
        'emails',
        emailIds.slice(-200),
        HUBSPOT_EMAIL_PROPS,
      )
      // Every logged email is a touch on the timeline, whether or not it gets scored.
      await dealTouchpointRepository.upsertMany(
        logged.map((e) => ({
          organizationId,
          leadId: record.leadId,
          kind: 'email',
          direction:
            e.properties.hs_email_direction === 'INCOMING_EMAIL'
              ? 'inbound'
              : 'outbound',
          source: 'hubspot_email',
          sourceId: e.id,
          threadId: e.properties.hs_email_thread_id ?? null,
          occurredAt: new Date(e.properties.hs_timestamp ?? 0),
          durationSeconds: null,
        })),
      )
      const emails = logged
        .map((e) => ({
          p: e.properties,
          at: new Date(e.properties.hs_timestamp ?? 0),
        }))
        .filter((e) => e.at.getTime() >= since)
        .sort((a, b) => a.at.getTime() - b.at.getTime())
        .slice(-MAX_EMAILS_PER_DIGEST)
      if (emails.length === 0) return

      const latest = emails[emails.length - 1].at
      const sourceId = `hubspot-contact:${record.externalId}`
      const existing = (
        await dealSignalRepository.findBySource(
          organizationId,
          'email',
          sourceId,
        )
      ).find((s) => s.leadId === record.leadId)
      if (existing?.sourceUpdatedAt && existing.sourceUpdatedAt >= latest) {
        result.skipped++
        return
      }

      const content = emails
        .map(
          (e) =>
            `--- ${e.at.toISOString()} | ${e.p.hs_email_direction === 'INCOMING_EMAIL' ? 'FROM BUYER' : 'FROM REP'} | ${e.p.hs_email_from_email ?? ''} -> ${e.p.hs_email_to_email ?? ''}\nSubject: ${e.p.hs_email_subject ?? ''}\n${stripQuotedReply(e.p.hs_email_text ?? '')}`,
        )
        .join('\n\n')
      const scores = await scoreTouchpoint({
        source: 'email',
        occurredAt: latest,
        content,
        context:
          'Email history logged in HubSpot. FROM REP = our sales rep, FROM BUYER = the prospect.',
      })
      await saveSignal(
        {
          organizationId,
          leadId: record.leadId,
          userId: null,
          source: 'email',
          sourceId,
          sourceUrl: record.externalUrl,
          sourceUpdatedAt: latest,
          occurredAt: latest,
        },
        scores,
      )
      result.scored++
    } catch (error) {
      if (error instanceof hubspotApi.HubSpotApiError && error.status === 403) {
        throw new Error(
          'HubSpot email access needs the sales-email-read scope. Add it to the app and reconnect HubSpot.',
        )
      }
      recordFailure(result, `contact ${record.externalId}`, error)
    }
  })

  return { ...result, leadsChecked: records.length }
}

// ---------------------------------------------------------------- all

/** Run every source that is available for the org; one failing source does not stop the rest. */
export const syncAllSignals = async (organizationId: string) => {
  const [gmail, grain, hubspot] = await Promise.all([
    integrationRepository.findByOrganizationAndProvider(
      organizationId,
      'gmail',
    ),
    integrationRepository.findByOrganizationAndProvider(
      organizationId,
      'grain',
    ),
    integrationRepository.findByOrganizationAndProvider(
      organizationId,
      'hubspot',
    ),
  ])
  const hubspotEmails =
    !!hubspot && readSyncConfig(hubspot.config).writeBacks.emails

  const run = async <T>(enabled: boolean, fn: () => Promise<T>) => {
    if (!enabled) return { status: 'not_connected' as const }
    try {
      return { status: 'ok' as const, ...(await fn()) }
    } catch (error) {
      return {
        status: 'error' as const,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }

  const [calls, email, hubspotEmail, meetings] = await Promise.all([
    run(true, () => backfillCallSignals(organizationId)),
    run(!!gmail, () => syncGmailSignals(organizationId)),
    run(hubspotEmails, () => syncHubSpotEmailSignals(organizationId)),
    run(!!grain, () => syncGrainSignals(organizationId)),
  ])
  return { calls, email, hubspotEmail, meetings }
}

export const getLeadSignals = (organizationId: string, leadId: string) =>
  dealSignalRepository.findByLead(organizationId, leadId)

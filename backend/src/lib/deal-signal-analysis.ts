/**
 * Prompt + response normalisation for scoring a sales touchpoint (call,
 * email thread, recorded meeting) for deal health. Pure so the clamping rules
 * are testable without an LLM.
 */

/** manual = entered by a rep on the lead page (never sent to the model). */
export type SignalSource = 'call' | 'email' | 'meeting' | 'manual'

export const DEAL_SIGNAL_SYSTEM_PROMPT = `You are a B2B sales pipeline analyst. You score ONE sales touchpoint (a call transcript, an email thread, or a recorded meeting) for deal health. Be strict and evidence-based: only score what is actually present.

Score each 0-10 (null if there is no basis at all):
- nextStepScore: quality of the agreed next step. 0 = none. 3 = vague ("I'll follow up", "send me info"). 6 = specific action but no time. 8 = specific action + date/time. 10 = specific action + date/time + buyer committed (calendar invite accepted, stakeholders named).
- championScore: is there a buyer-side champion advocating internally? Look for: introducing other stakeholders, sharing internal process/budget, pushing the deal forward, using "we" about the purchase, defending the solution. 0 = no one, 5 = friendly but passive, 10 = active internal seller.
- engagementScore: buyer engagement — responsiveness, questions asked, initiative, reply speed (email), talk share (call).
- qualityScore: rep execution — discovery depth, handling objections, clarity, securing commitment. For email: clarity, relevance, a clear ask.

Also extract:
- nextStep: one sentence describing the agreed next step, or null.
- nextStepSecured: true ONLY if a concrete date/time for the next touchpoint was agreed by the buyer in this touchpoint.
- nextStepChannel: "call" | "email" | "meeting" | "other" | null — how the next touchpoint will happen.
- nextStepDueAt: ISO 8601 date/time of the next touchpoint if stated (resolve relative dates against the touchpoint date), else null.
- championName: name of the most likely champion, or null.
- sentiment: "positive" | "neutral" | "negative" — buyer's overall stance.
- summary: 1-2 sentences on where the deal stands after this touchpoint.
- evidence: { "nextStep": "<short quote>", "champion": "<short quote>", "risks": ["<risk>", ...] } — quotes must come from the content.

Return ONLY valid JSON:
{"nextStep":null,"nextStepSecured":false,"nextStepChannel":null,"nextStepDueAt":null,"nextStepScore":0,"championScore":0,"championName":null,"engagementScore":0,"qualityScore":0,"sentiment":"neutral","summary":"","evidence":{"nextStep":null,"champion":null,"risks":[]}}`

const SOURCE_LABEL: Record<SignalSource, string> = {
  call: 'phone call transcript',
  email: 'email thread',
  meeting: 'recorded sales meeting transcript',
  manual: 'rep notes',
}

/** Long transcripts are trimmed from the middle: openings and closes carry the next step. */
const MAX_CONTENT_CHARS = 60_000

export const buildDealSignalUserPrompt = (params: {
  source: SignalSource
  occurredAt: Date
  content: string
  context?: string
}): string => {
  let content = params.content
  if (content.length > MAX_CONTENT_CHARS) {
    const half = MAX_CONTENT_CHARS / 2
    content = `${content.slice(0, half)}\n\n[... middle trimmed ...]\n\n${content.slice(-half)}`
  }
  return `Touchpoint type: ${SOURCE_LABEL[params.source]}
Touchpoint date: ${params.occurredAt.toISOString()}
${params.context ? `Context: ${params.context}\n` : ''}
CONTENT:
${content}`
}

export interface DealSignalScores {
  nextStep: string | null
  nextStepSecured: boolean
  nextStepChannel: string | null
  nextStepDueAt: Date | null
  nextStepScore: number | null
  championScore: number | null
  championName: string | null
  engagementScore: number | null
  qualityScore: number | null
  sentiment: string | null
  summary: string
  evidence: {
    nextStep: string | null
    champion: string | null
    risks: string[]
  }
}

const score = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  return Math.max(0, Math.min(10, Math.round(n)))
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]) =>
  allowed.includes(value as T) ? (value as T) : null

const CHANNELS = ['call', 'email', 'meeting', 'other'] as const
const SENTIMENTS = ['positive', 'neutral', 'negative'] as const

/** Coerce whatever the model returned into in-range, typed scores. */
export const normalizeDealSignal = (raw: unknown): DealSignalScores => {
  const r = (raw ?? {}) as Record<string, unknown>
  const evidence = (r.evidence ?? {}) as Record<string, unknown>
  const due = text(r.nextStepDueAt)
  const dueAt = due ? new Date(due) : null
  const nextStep = text(r.nextStep)

  return {
    nextStep,
    // A secured next step without a described next step is a model slip.
    nextStepSecured: r.nextStepSecured === true && nextStep !== null,
    nextStepChannel: oneOf(r.nextStepChannel, CHANNELS),
    nextStepDueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null,
    nextStepScore: score(r.nextStepScore),
    championScore: score(r.championScore),
    championName: text(r.championName),
    engagementScore: score(r.engagementScore),
    qualityScore: score(r.qualityScore),
    sentiment: oneOf(r.sentiment, SENTIMENTS),
    summary: text(r.summary) ?? '',
    evidence: {
      nextStep: text(evidence.nextStep),
      champion: text(evidence.champion),
      risks: Array.isArray(evidence.risks)
        ? evidence.risks
            .filter((x): x is string => typeof x === 'string')
            .slice(0, 5)
        : [],
    },
  }
}

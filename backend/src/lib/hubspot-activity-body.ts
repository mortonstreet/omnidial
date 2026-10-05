/**
 * HTML bodies for the activities OmniDial writes to HubSpot: calls, meetings
 * and email-thread notes. Summary + key moments (next step, champion, risks,
 * quotes) and a link back to OmniDial; never the full transcript.
 */

export interface SignalForBody {
  summary?: string | null
  nextStep?: string | null
  nextStepSecured?: boolean | null
  nextStepDueAt?: Date | null
  championName?: string | null
  championScore?: number | null
  engagementScore?: number | null
  qualityScore?: number | null
  evidence?: unknown
}

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const evidenceOf = (evidence: unknown) => {
  const e = (typeof evidence === 'string' ? safeJson(evidence) : evidence) as {
    nextStep?: string | null
    champion?: string | null
    risks?: string[]
  } | null
  return {
    nextStepQuote: e?.nextStep ?? null,
    championQuote: e?.champion ?? null,
    risks: Array.isArray(e?.risks)
      ? e!.risks!.filter((r) => typeof r === 'string')
      : [],
  }
}

const safeJson = (value: string) => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

/** Bullet list of what matters for the deal from one touchpoint. */
export const keyMomentsHtml = (
  signal: SignalForBody | null | undefined,
): string => {
  if (!signal) return ''
  const ev = evidenceOf(signal.evidence)
  const items: string[] = []
  if (signal.nextStep) {
    const due = signal.nextStepDueAt
      ? ` (${signal.nextStepDueAt.toISOString().slice(0, 10)})`
      : ''
    items.push(
      `<li><strong>Next step${signal.nextStepSecured ? ' (secured)' : ''}:</strong> ${escape(signal.nextStep)}${due}</li>`,
    )
  }
  if (
    signal.championName ||
    (signal.championScore !== null && signal.championScore !== undefined)
  ) {
    const score = signal.championScore ?? null
    items.push(
      `<li><strong>Champion:</strong> ${escape(signal.championName ?? 'none identified')}${score !== null ? ` (${score}/10)` : ''}</li>`,
    )
  }
  if (signal.engagementScore !== null && signal.engagementScore !== undefined) {
    items.push(
      `<li><strong>Buyer engagement:</strong> ${signal.engagementScore}/10</li>`,
    )
  }
  if (signal.qualityScore !== null && signal.qualityScore !== undefined) {
    items.push(
      `<li><strong>Rep execution:</strong> ${signal.qualityScore}/10</li>`,
    )
  }
  for (const risk of ev.risks.slice(0, 3))
    items.push(`<li><strong>Risk:</strong> ${escape(risk)}</li>`)
  for (const quote of [ev.nextStepQuote, ev.championQuote].filter(
    Boolean,
  ) as string[]) {
    items.push(`<li>“${escape(quote)}”</li>`)
  }
  return items.length ? `<ul>${items.join('')}</ul>` : ''
}

const footer = (
  links: Array<{ label: string; url: string | null | undefined }>,
) => {
  const parts = links
    .filter((l) => l.url)
    .map((l) => `<a href="${escape(l.url!)}">${escape(l.label)}</a>`)
  return `<p><em>Logged by OmniDial</em>${parts.length ? ` · ${parts.join(' · ')}` : ''}</p>`
}

export const callBodyHtml = (call: {
  dispositionLabel?: string | null
  summary?: string | null
  signal?: SignalForBody | null
  leadUrl?: string | null
}): string =>
  [
    call.dispositionLabel
      ? `<p><strong>Disposition:</strong> ${escape(call.dispositionLabel)}</p>`
      : '',
    call.summary ? `<p>${escape(call.summary)}</p>` : '',
    keyMomentsHtml(call.signal),
    footer([{ label: 'Lead in OmniDial', url: call.leadUrl }]),
  ].join('')

export const meetingBodyHtml = (meeting: {
  signal: SignalForBody
  recordingUrl?: string | null
  leadUrl?: string | null
}): string =>
  [
    meeting.signal.summary ? `<p>${escape(meeting.signal.summary)}</p>` : '',
    keyMomentsHtml(meeting.signal),
    footer([
      { label: 'Recording & transcript', url: meeting.recordingUrl },
      { label: 'Lead in OmniDial', url: meeting.leadUrl },
    ]),
  ].join('')

export interface ThreadStats {
  messages: number
  fromBuyer: number
  fromRep: number
  firstAt: Date | null
  lastAt: Date | null
  medianBuyerReplyHours: number | null
}

const formatHours = (hours: number) =>
  hours < 48 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`

export const threadNoteHtml = (thread: {
  signal: SignalForBody
  stats: ThreadStats
  threadUrl?: string | null
  leadUrl?: string | null
}): string => {
  const { stats } = thread
  const span =
    stats.firstAt && stats.lastAt
      ? `${stats.firstAt.toISOString().slice(0, 10)} → ${stats.lastAt.toISOString().slice(0, 10)}`
      : null
  const facts = [
    `${stats.messages} message${stats.messages === 1 ? '' : 's'} (${stats.fromBuyer} from buyer, ${stats.fromRep} from us)`,
    span,
    stats.medianBuyerReplyHours !== null
      ? `buyer replies in ~${formatHours(stats.medianBuyerReplyHours)}`
      : null,
  ].filter(Boolean)
  return [
    `<p><strong>Email thread</strong> · ${facts.map((f) => escape(f!)).join(' · ')}</p>`,
    thread.signal.summary ? `<p>${escape(thread.signal.summary)}</p>` : '',
    keyMomentsHtml(thread.signal),
    footer([
      { label: 'Open thread', url: thread.threadUrl },
      { label: 'Lead in OmniDial', url: thread.leadUrl },
    ]),
  ].join('')
}

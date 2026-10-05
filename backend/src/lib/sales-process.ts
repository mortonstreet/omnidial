/**
 * Sales-process metrics from the real touch timeline: every call, email
 * message and meeting with its timestamp. Replaces stage-based estimates with
 * receipts: first touch -> close, touches to close, reply times, gaps.
 *
 * Pure (no I/O); tested in tests/salesProcess.test.ts.
 */

export type TouchKind = 'call' | 'email' | 'meeting'

export interface Touch {
  kind: TouchKind
  direction: 'outbound' | 'inbound' | null
  at: Date
  durationSeconds?: number | null
  /** Calls only: someone picked up. */
  connected?: boolean
  /** Emails only: messages in one thread are paired for reply times. */
  threadId?: string | null
}

export interface LeadTimeline {
  firstTouchAt: Date
  lastTouchAt: Date
  touches: number
  byKind: Record<TouchKind, number>
  connectedCalls: number
  talkSeconds: number
  meetingSeconds: number
  firstMeetingAt: Date | null
  /** Hours the buyer took to answer our emails (one sample per reply). */
  buyerReplyHours: number[]
  /** Hours we took to answer the buyer. */
  repReplyHours: number[]
  /** Days between consecutive touches of any kind. */
  gapsDays: number[]
}

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export const average = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null

/** Replies are measured inside each email thread when the sender flips. */
const replyTimes = (emails: Touch[]) => {
  const buyer: number[] = []
  const rep: number[] = []
  const threads = new Map<string, Touch[]>()
  for (const email of emails) {
    if (!email.threadId || !email.direction) continue
    const list = threads.get(email.threadId) ?? []
    list.push(email)
    threads.set(email.threadId, list)
  }
  for (const list of threads.values()) {
    list.sort((a, b) => a.at.getTime() - b.at.getTime())
    for (let i = 1; i < list.length; i++) {
      const prev = list[i - 1]
      const cur = list[i]
      if (prev.direction === cur.direction) continue
      const hours = (cur.at.getTime() - prev.at.getTime()) / HOUR_MS
      if (cur.direction === 'inbound') buyer.push(hours)
      else rep.push(hours)
    }
  }
  return { buyer, rep }
}

export const buildTimeline = (touches: Touch[]): LeadTimeline | null => {
  if (touches.length === 0) return null
  const sorted = [...touches].sort((a, b) => a.at.getTime() - b.at.getTime())
  const byKind: Record<TouchKind, number> = { call: 0, email: 0, meeting: 0 }
  let connectedCalls = 0
  let talkSeconds = 0
  let meetingSeconds = 0
  let firstMeetingAt: Date | null = null
  for (const t of sorted) {
    byKind[t.kind]++
    if (t.kind === 'call' && t.connected) {
      connectedCalls++
      talkSeconds += t.durationSeconds ?? 0
    }
    if (t.kind === 'meeting') {
      meetingSeconds += t.durationSeconds ?? 0
      firstMeetingAt ??= t.at
    }
  }
  const gapsDays: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    gapsDays.push(
      (sorted[i].at.getTime() - sorted[i - 1].at.getTime()) / DAY_MS,
    )
  }
  const replies = replyTimes(sorted.filter((t) => t.kind === 'email'))
  return {
    firstTouchAt: sorted[0].at,
    lastTouchAt: sorted[sorted.length - 1].at,
    touches: sorted.length,
    byKind,
    connectedCalls,
    talkSeconds,
    meetingSeconds,
    firstMeetingAt,
    buyerReplyHours: replies.buyer,
    repReplyHours: replies.rep,
    gapsDays,
  }
}

export interface ClosedDeal {
  leadId: string
  closedAt: Date
}

export interface QuietDeal {
  leadId: string
  daysSilent: number
  lastTouchAt: Date
  touches: number
}

export interface SalesProcessSummary {
  wonWithTouches: number
  avgFirstTouchToCloseDays: number | null
  medianFirstTouchToCloseDays: number | null
  avgTouchesToWin: number | null
  touchesToWinByKind: Record<TouchKind, number | null>
  avgTalkMinutesToWin: number | null
  medianDaysToFirstMeeting: number | null
  medianBuyerReplyHours: number | null
  medianRepReplyHours: number | null
  /** Typical days between touches on won deals (all deals when none won yet). */
  typicalGapDays: number | null
  /** Open deals silent for more than twice the typical gap. */
  quietDeals: QuietDeal[]
}

const round = (n: number | null, places = 1) =>
  n === null ? null : Math.round(n * 10 ** places) / 10 ** places

/**
 * Only touches up to the close count toward a won deal, so post-sale
 * activity does not inflate the cycle.
 */
const timelineUntil = (touches: Touch[], until: Date) =>
  buildTimeline(touches.filter((t) => t.at.getTime() <= until.getTime()))

export const summarizeSalesProcess = (params: {
  touchesByLead: Map<string, Touch[]>
  won: ClosedDeal[]
  openLeadIds: string[]
  now?: Date
  quietLimit?: number
}): SalesProcessSummary => {
  const now = params.now ?? new Date()
  const wonTimelines = params.won
    .map((deal) => ({
      deal,
      timeline: timelineUntil(
        params.touchesByLead.get(deal.leadId) ?? [],
        deal.closedAt,
      ),
    }))
    .filter(
      (x): x is { deal: ClosedDeal; timeline: LeadTimeline } =>
        x.timeline !== null,
    )

  const cycles = wonTimelines.map(
    ({ deal, timeline }) =>
      (deal.closedAt.getTime() - timeline.firstTouchAt.getTime()) / DAY_MS,
  )
  const kindAvg = (kind: TouchKind) =>
    round(average(wonTimelines.map(({ timeline }) => timeline.byKind[kind])))

  const allTimelines = [...params.touchesByLead.values()]
    .map(buildTimeline)
    .filter((t): t is LeadTimeline => t !== null)

  const typicalGapDays = median(
    (wonTimelines.length
      ? wonTimelines.map((x) => x.timeline)
      : allTimelines
    ).flatMap((t) => t.gapsDays),
  )

  const quietDeals: QuietDeal[] = []
  if (typicalGapDays !== null && typicalGapDays > 0) {
    for (const leadId of params.openLeadIds) {
      const timeline = buildTimeline(params.touchesByLead.get(leadId) ?? [])
      if (!timeline) continue
      const daysSilent =
        (now.getTime() - timeline.lastTouchAt.getTime()) / DAY_MS
      if (daysSilent > 2 * typicalGapDays) {
        quietDeals.push({
          leadId,
          daysSilent: round(daysSilent)!,
          lastTouchAt: timeline.lastTouchAt,
          touches: timeline.touches,
        })
      }
    }
    quietDeals.sort((a, b) => b.daysSilent - a.daysSilent)
  }

  return {
    wonWithTouches: wonTimelines.length,
    avgFirstTouchToCloseDays: round(average(cycles)),
    medianFirstTouchToCloseDays: round(median(cycles)),
    avgTouchesToWin: round(
      average(wonTimelines.map((x) => x.timeline.touches)),
    ),
    touchesToWinByKind: {
      call: kindAvg('call'),
      email: kindAvg('email'),
      meeting: kindAvg('meeting'),
    },
    avgTalkMinutesToWin: round(
      average(wonTimelines.map((x) => x.timeline.talkSeconds / 60)),
    ),
    medianDaysToFirstMeeting: round(
      median(
        allTimelines
          .filter((t) => t.firstMeetingAt)
          .map(
            (t) =>
              (t.firstMeetingAt!.getTime() - t.firstTouchAt.getTime()) / DAY_MS,
          ),
      ),
    ),
    medianBuyerReplyHours: round(
      median(allTimelines.flatMap((t) => t.buyerReplyHours)),
    ),
    medianRepReplyHours: round(
      median(allTimelines.flatMap((t) => t.repReplyHours)),
    ),
    typicalGapDays: round(typicalGapDays),
    quietDeals: quietDeals.slice(0, params.quietLimit ?? 10),
  }
}

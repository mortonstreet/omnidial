import * as dealTrackingRepository from '@/repositories/dealTracking.repository'
import * as dealSignalRepository from '@/repositories/dealSignal.repository'
import * as pipelineRepository from '@/repositories/pipeline.repository'
import * as integrationRepository from '@/repositories/integration.repository'
import * as dealTouchpointRepository from '@/repositories/dealTouchpoint.repository'
import { summarizeSalesProcess, type Touch } from '@/lib/sales-process'
import {
  average,
  classifyTrend,
  computeStageConversion,
  computeStageDurations,
  median,
  resolveStageOutcome,
  salesVelocityPerDay,
  type StageRef,
} from '@/lib/deal-metrics'
import type { PipelineDealRow } from '@/repositories/dealTracking.repository'
import type { DBDealSignal, DBPipelineStage } from '@shared/db/src/types'
import {
  DEAL_LOSS_REASONS,
  DEAL_WIN_REASONS,
  type DealListItem,
  type DealMetricsResponse,
  type ReasonCount,
} from '@shared/types/src/requests/dealMetrics'

const DAY_MS = 24 * 60 * 60 * 1000
const STRONG_CHAMPION = 7
const WEAK_CHAMPION = 3
const LIST_LIMIT = 10

const round = (n: number, places = 2) => {
  const f = 10 ** places
  return Math.round(n * f) / f
}

const num = (value: string | null) => (value === null ? null : Number(value))

const inRange = (date: Date | null, start: Date, end: Date) =>
  !!date && date >= start && date <= end

export const getDealMetrics = async (params: {
  organizationId: string
  startDate: string
  endDate: string
  clientId?: string
}): Promise<DealMetricsResponse> => {
  const { organizationId, clientId } = params
  const start = new Date(params.startDate)
  const end = new Date(params.endDate)
  const previousStart = new Date(
    start.getTime() - (end.getTime() - start.getTime()),
  )

  const [
    stages,
    deals,
    history,
    signals,
    latestSignals,
    callStats,
    integrations,
  ] = await Promise.all([
    pipelineRepository.findByOrganizationId(organizationId),
    dealTrackingRepository.findPipelineDeals(organizationId, clientId),
    dealTrackingRepository.findStageHistoryForActiveLeads(
      organizationId,
      previousStart,
    ),
    dealSignalRepository.findInRange(organizationId, start, end),
    dealSignalRepository.findLatestPerLead(organizationId),
    dealTrackingRepository.findCallQualityStats(organizationId, start, end),
    integrationRepository.findByOrganizationId(organizationId),
  ])

  const dealIds = new Set(deals.map((d) => d.id))
  // With a client filter, only that client's deals count everywhere.
  const scopedHistory = clientId
    ? history.filter((h) => dealIds.has(h.leadId))
    : history
  const scopedSignals = clientId
    ? signals.filter((s) => dealIds.has(s.leadId))
    : signals
  const scopedLatest = latestSignals.filter((s) => dealIds.has(s.leadId))

  const stageRefs: StageRef[] = stages.map((s) => ({
    id: s.id,
    label: s.label,
    sortOrder: s.sortOrder,
    outcome: resolveStageOutcome(s),
  }))
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const toItem = dealListItem(stageById)

  const openDeals = deals.filter(
    (d) =>
      !d.dealOutcome &&
      d.pipelineStageId &&
      resolveStageOutcome(stageById.get(d.pipelineStageId) ?? { label: '' }) ===
        'open',
  )
  const won = deals.filter(
    (d) => d.dealOutcome === 'won' && inRange(d.dealClosedAt, start, end),
  )
  const lost = deals.filter(
    (d) => d.dealOutcome === 'lost' && inRange(d.dealClosedAt, start, end),
  )

  const [talkByLead, touchesByLead] = await Promise.all([
    dealTrackingRepository.findTalkTimeByLead(
      organizationId,
      [...won, ...lost].map((d) => d.id),
    ),
    dealTouchpointRepository.findTouchesForLeads(
      organizationId,
      deals.map((d) => d.id),
    ),
  ])

  const salesProcess = buildSalesProcess(
    touchesByLead,
    won,
    openDeals,
    toItem,
    start,
    end,
  )
  const summary = buildSummary(
    openDeals,
    won,
    lost,
    salesProcess.avgFirstTouchToCloseDays,
  )

  return {
    range: { startDate: start.toISOString(), endDate: end.toISOString() },
    summary,
    salesProcess,
    velocity: buildVelocity(
      stages,
      stageRefs,
      scopedHistory,
      openDeals,
      start,
      end,
      previousStart,
    ),
    conversion: computeStageConversion(
      stageRefs,
      scopedHistory.filter((h) => h.createdAt <= end),
    ).map((c) => ({
      ...c,
      color: stageById.get(c.stageId)?.color ?? '#6B7280',
    })),
    dealSize: buildDealSize(openDeals, won, lost),
    nextSteps: buildNextSteps(scopedSignals, scopedLatest, openDeals, toItem),
    champions: buildChampions(scopedLatest, openDeals, toItem),
    winLoss: buildWinLoss(won, lost, talkByLead, toItem),
    activity: buildActivity(callStats, scopedSignals, won.length),
    sources: buildSources(integrations),
  }
}

const dealListItem =
  (stageById: Map<string, DBPipelineStage>) =>
  (deal: PipelineDealRow): DealListItem => ({
    leadId: deal.id,
    name:
      [deal.firstName, deal.lastName].filter(Boolean).join(' ') ||
      deal.company ||
      'Unnamed lead',
    company: deal.company,
    stageLabel: deal.pipelineStageId
      ? (stageById.get(deal.pipelineStageId)?.label ?? null)
      : null,
    dealValue: num(deal.dealValue),
  })

const cycleDays = (deal: PipelineDealRow) => {
  const startedAt = deal.firstStageAt ?? deal.createdAt
  return deal.dealClosedAt
    ? Math.max(
        0,
        (deal.dealClosedAt.getTime() - new Date(startedAt).getTime()) / DAY_MS,
      )
    : null
}

const values = (deals: PipelineDealRow[]) =>
  deals.map((d) => num(d.dealValue)).filter((v): v is number => v !== null)

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)

const buildSummary = (
  openDeals: PipelineDealRow[],
  won: PipelineDealRow[],
  lost: PipelineDealRow[],
  firstTouchCycleDays: number | null,
) => {
  const closed = won.length + lost.length
  const winRate = closed > 0 ? won.length / closed : 0
  const avgWonDealSize = average(values(won))
  // Real touch history beats stage moves whenever it exists.
  const avgSalesCycleDays =
    firstTouchCycleDays ??
    average(won.map(cycleDays).filter((d): d is number => d !== null))
  return {
    openDeals: openDeals.length,
    openPipelineValue: round(sum(values(openDeals))),
    wonDeals: won.length,
    lostDeals: lost.length,
    winRate: round(winRate, 4),
    wonValue: round(sum(values(won))),
    avgWonDealSize: round(avgWonDealSize),
    avgSalesCycleDays: round(avgSalesCycleDays, 1),
    salesCycleBasis: (firstTouchCycleDays !== null
      ? 'first_touch'
      : 'stage') as 'first_touch' | 'stage',
    salesVelocityPerDay: round(
      salesVelocityPerDay({
        openDeals: openDeals.length,
        winRate,
        avgWonDealSize,
        avgCycleDays: avgSalesCycleDays,
      }),
    ),
  }
}

const buildSalesProcess = (
  touchesByLead: Map<string, Touch[]>,
  won: PipelineDealRow[],
  openDeals: PipelineDealRow[],
  toItem: (d: PipelineDealRow) => DealListItem,
  start: Date,
  end: Date,
) => {
  const summary = summarizeSalesProcess({
    touchesByLead,
    won: won
      .filter((d) => d.dealClosedAt)
      .map((d) => ({ leadId: d.id, closedAt: d.dealClosedAt! })),
    openLeadIds: openDeals.map((d) => d.id),
  })
  const openById = new Map(openDeals.map((d) => [d.id, d]))
  const touchesInPeriod = { call: 0, email: 0, meeting: 0 }
  for (const touches of touchesByLead.values()) {
    for (const t of touches) {
      if (t.at >= start && t.at <= end) touchesInPeriod[t.kind]++
    }
  }
  return {
    ...summary,
    quietDeals: summary.quietDeals
      .filter((q) => openById.has(q.leadId))
      .map((q) => ({
        ...toItem(openById.get(q.leadId)!),
        daysSilent: q.daysSilent,
        lastTouchAt: q.lastTouchAt.toISOString(),
        touches: q.touches,
      })),
    touchesInPeriod,
  }
}

const buildVelocity = (
  stages: DBPipelineStage[],
  stageRefs: StageRef[],
  history: dealTrackingRepository.StageHistoryRow[],
  openDeals: PipelineDealRow[],
  start: Date,
  end: Date,
  previousStart: Date,
) => {
  const samples = computeStageDurations(history)
  const now = Date.now()

  return stages
    .filter((_, i) => stageRefs[i].outcome === 'open')
    .map((stage) => {
      const forStage = samples.filter((s) => s.stageId === stage.id)
      const current = forStage.filter(
        (s) => s.exitedAt >= start && s.exitedAt <= end,
      )
      const previous = forStage.filter(
        (s) => s.exitedAt >= previousStart && s.exitedAt < start,
      )
      const sitting = openDeals.filter((d) => d.pipelineStageId === stage.id)
      const currentAvg = average(current.map((s) => s.days))
      const previousAvg = average(previous.map((s) => s.days))

      return {
        stageId: stage.id,
        label: stage.label,
        color: stage.color,
        avgDays: round(currentAvg, 1),
        medianDays: round(median(current.map((s) => s.days)), 1),
        samples: current.length,
        previousAvgDays: round(previousAvg, 1),
        trend: classifyTrend(
          currentAvg,
          previousAvg,
          current.length,
          previous.length,
        ),
        currentDeals: sitting.length,
        avgDaysInStageNow: round(
          average(
            sitting
              .filter((d) => d.stageEnteredAt)
              .map((d) => (now - d.stageEnteredAt!.getTime()) / DAY_MS),
          ),
          1,
        ),
      }
    })
}

const buildDealSize = (
  openDeals: PipelineDealRow[],
  won: PipelineDealRow[],
  lost: PipelineDealRow[],
) => {
  const comparable = won
    .map((d) => ({ initial: num(d.initialDealValue), final: num(d.dealValue) }))
    .filter(
      (d): d is { initial: number; final: number } =>
        d.initial !== null && d.final !== null && d.initial > 0,
    )

  return {
    avgWon: round(average(values(won))),
    medianWon: round(median(values(won))),
    avgLost: round(average(values(lost))),
    avgOpen: round(average(values(openDeals))),
    comparableWonDeals: comparable.length,
    avgInitialQuote: round(average(comparable.map((d) => d.initial))),
    avgValueDriftPct: round(
      average(comparable.map((d) => (d.final - d.initial) / d.initial)) * 100,
      1,
    ),
    closedBelowQuote: comparable.filter((d) => d.final < d.initial).length,
    closedAboveQuote: comparable.filter((d) => d.final > d.initial).length,
    discountGiven: round(
      sum(
        comparable
          .filter((d) => d.final < d.initial)
          .map((d) => d.initial - d.final),
      ),
    ),
    lostPipelineValue: round(sum(values(lost))),
  }
}

const buildNextSteps = (
  signals: DBDealSignal[],
  latest: DBDealSignal[],
  openDeals: PipelineDealRow[],
  toItem: (d: PipelineDealRow) => DealListItem,
) => {
  const channel = (source: string) => {
    const forSource = signals.filter((s) => s.source === source)
    return {
      touchpoints: forSource.length,
      withNextStep: forSource.filter((s) => s.nextStep).length,
      secured: forSource.filter((s) => s.nextStepSecured).length,
    }
  }
  const withNextStep = signals.filter((s) => s.nextStep).length
  const secured = signals.filter((s) => s.nextStepSecured).length
  const latestByLead = new Map(latest.map((s) => [s.leadId, s]))

  // A deal is covered when its most recent touchpoint secured a future meeting.
  const now = Date.now()
  const uncovered = openDeals
    .filter((d) => {
      const last = latestByLead.get(d.id)
      if (!last?.nextStepSecured) return true
      return !!last.nextStepDueAt && last.nextStepDueAt.getTime() < now
    })
    .sort((a, b) => (num(b.dealValue) ?? 0) - (num(a.dealValue) ?? 0))
    .slice(0, LIST_LIMIT)
    .map((d) => {
      const last = latestByLead.get(d.id)
      return {
        ...toItem(d),
        lastTouchAt: last?.occurredAt.toISOString() ?? null,
        lastNextStep: last?.nextStep ?? null,
      }
    })

  return {
    touchpoints: signals.length,
    withNextStep,
    secured,
    securedRate: signals.length > 0 ? round(secured / signals.length, 4) : 0,
    avgScore: round(
      average(
        signals
          .map((s) => s.nextStepScore)
          .filter((v): v is number => v !== null),
      ),
      1,
    ),
    byChannel: {
      call: channel('call'),
      email: channel('email'),
      meeting: channel('meeting'),
    },
    openDealsWithoutSecuredNextStep: uncovered,
  }
}

const buildChampions = (
  latest: DBDealSignal[],
  openDeals: PipelineDealRow[],
  toItem: (d: PipelineDealRow) => DealListItem,
) => {
  const openById = new Map(openDeals.map((d) => [d.id, d]))
  const scored = latest.filter((s) => openById.has(s.leadId))
  const championScores = scored
    .map((s) => s.championScore)
    .filter((v): v is number => v !== null)

  return {
    dealsScored: scored.length,
    withChampion: championScores.filter((v) => v >= STRONG_CHAMPION).length,
    avgChampionScore: round(average(championScores), 1),
    avgEngagementScore: round(
      average(
        scored
          .map((s) => s.engagementScore)
          .filter((v): v is number => v !== null),
      ),
      1,
    ),
    strong: scored
      .filter((s) => (s.championScore ?? 0) >= STRONG_CHAMPION)
      .sort((a, b) => (b.championScore ?? 0) - (a.championScore ?? 0))
      .slice(0, LIST_LIMIT)
      .map((s) => ({
        ...toItem(openById.get(s.leadId)!),
        championName: s.championName,
        championScore: s.championScore ?? 0,
      })),
    atRisk: scored
      .filter(
        (s) => s.championScore !== null && s.championScore <= WEAK_CHAMPION,
      )
      .sort(
        (a, b) =>
          (num(openById.get(b.leadId)!.dealValue) ?? 0) -
          (num(openById.get(a.leadId)!.dealValue) ?? 0),
      )
      .slice(0, LIST_LIMIT)
      .map((s) => ({
        ...toItem(openById.get(s.leadId)!),
        championScore: s.championScore,
        engagementScore: s.engagementScore,
      })),
  }
}

const reasonCounts = (
  deals: PipelineDealRow[],
  catalog: ReadonlyArray<{ value: string; label: string }>,
): ReasonCount[] => {
  const counts = new Map<string, { count: number; value: number }>()
  for (const deal of deals) {
    if (!deal.dealOutcomeReason) continue
    const entry = counts.get(deal.dealOutcomeReason) ?? { count: 0, value: 0 }
    entry.count++
    entry.value += num(deal.dealValue) ?? 0
    counts.set(deal.dealOutcomeReason, entry)
  }
  return [...counts.entries()]
    .map(([reason, c]) => ({
      reason,
      label: catalog.find((r) => r.value === reason)?.label ?? reason,
      count: c.count,
      value: round(c.value),
    }))
    .sort((a, b) => b.count - a.count)
}

const buildWinLoss = (
  won: PipelineDealRow[],
  lost: PipelineDealRow[],
  talkByLead: Map<string, number>,
  toItem: (d: PipelineDealRow) => DealListItem,
) => {
  const cycles = (deals: PipelineDealRow[]) =>
    average(deals.map(cycleDays).filter((d): d is number => d !== null))
  const talk = (deals: PipelineDealRow[]) =>
    average(deals.map((d) => talkByLead.get(d.id) ?? 0))
  const closed = won.length + lost.length

  return {
    won: won.length,
    lost: lost.length,
    winRate: closed > 0 ? round(won.length / closed, 4) : 0,
    lossReasons: reasonCounts(lost, DEAL_LOSS_REASONS),
    winReasons: reasonCounts(won, DEAL_WIN_REASONS),
    missingReason: [...won, ...lost].filter((d) => !d.dealOutcomeReason).length,
    avgCycleWonDays: round(cycles(won), 1),
    avgCycleLostDays: round(cycles(lost), 1),
    avgTalkTimeWonSeconds: Math.round(talk(won)),
    avgTalkTimeLostSeconds: Math.round(talk(lost)),
    recent: [...won, ...lost]
      .sort(
        (a, b) =>
          (b.dealClosedAt?.getTime() ?? 0) - (a.dealClosedAt?.getTime() ?? 0),
      )
      .slice(0, LIST_LIMIT)
      .map((d) => ({
        ...toItem(d),
        outcome: d.dealOutcome as 'won' | 'lost',
        reason: d.dealOutcomeReason,
        closedAt: d.dealClosedAt?.toISOString() ?? null,
      })),
  }
}

const buildActivity = (
  callStats: dealTrackingRepository.CallQualityStats,
  signals: DBDealSignal[],
  wonCount: number,
) => {
  const quality = (source: string) => {
    const scores = signals
      .filter((s) => s.source === source)
      .map((s) => s.qualityScore)
      .filter((v): v is number => v !== null)
    return { count: scores.length, avg: round(average(scores), 1) }
  }
  const calls = quality('call')
  const meetings = quality('meeting')

  return {
    totalTalkTimeSeconds: callStats.totalTalkTimeSeconds,
    connectedCalls: callStats.connectedCalls,
    talkTimePerWonDealSeconds:
      wonCount > 0 ? Math.round(callStats.totalTalkTimeSeconds / wonCount) : 0,
    coachedCalls: callStats.coachedCalls,
    avgCoachingScore: round(callStats.avgCoachingScore, 1),
    callsScored: calls.count,
    avgCallQuality: calls.avg,
    meetingsScored: meetings.count,
    avgMeetingQuality: meetings.avg,
    emailThreadsScored: signals.filter((s) => s.source === 'email').length,
  }
}

const buildSources = (
  integrations: Awaited<
    ReturnType<typeof integrationRepository.findByOrganizationId>
  >,
) => {
  const status = (provider: string) => {
    const integration = integrations.find((i) => i.provider === provider)
    const config = (integration?.config ?? {}) as { mailbox?: string }
    return {
      connected: !!integration,
      lastSyncAt: integration?.lastSyncAt?.toISOString() ?? null,
      detail: config.mailbox ?? null,
    }
  }
  return {
    calls: { connected: true, lastSyncAt: null },
    gmail: status('gmail'),
    grain: status('grain'),
    hubspot: status('hubspot'),
  }
}

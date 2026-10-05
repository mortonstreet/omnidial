/**
 * Pure deal-metric math over pipeline stage history. Kept free of DB access so
 * the velocity / conversion rules can be tested directly.
 */

import {
  resolveStageOutcome,
  type StageOutcome,
} from '@shared/types/src/requests/dealMetrics'

export { resolveStageOutcome, type StageOutcome }

const DAY_MS = 24 * 60 * 60 * 1000

export interface StageRef {
  id: string
  label: string
  sortOrder: number
  outcome: StageOutcome
}

export interface StageTransition {
  leadId: string
  toStageId: string | null
  createdAt: Date
}

export interface StageDurationSample {
  stageId: string
  days: number
  exitedAt: Date
}

const groupByLead = (transitions: StageTransition[]) => {
  const byLead = new Map<string, StageTransition[]>()
  for (const t of transitions) {
    const list = byLead.get(t.leadId) ?? []
    list.push(t)
    byLead.set(t.leadId, list)
  }
  for (const list of byLead.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  }
  return byLead
}

/**
 * Time spent in each stage, one sample per completed stay. A stay ends when
 * the lead moves again; the current stay of a lead is not a sample (it has
 * not finished) and closed stages are terminal, so neither is counted.
 */
export const computeStageDurations = (
  transitions: StageTransition[],
): StageDurationSample[] => {
  const samples: StageDurationSample[] = []
  for (const list of groupByLead(transitions).values()) {
    for (let i = 0; i < list.length - 1; i++) {
      const current = list[i]
      const next = list[i + 1]
      if (!current.toStageId) continue
      samples.push({
        stageId: current.toStageId,
        days: (next.createdAt.getTime() - current.createdAt.getTime()) / DAY_MS,
        exitedAt: next.createdAt,
      })
    }
  }
  return samples
}

export interface StageConversion {
  stageId: string
  label: string
  entered: number
  advanced: number
  lost: number
  stalled: number
  conversionRate: number
}

/**
 * For every open stage: of the leads that entered it, how many later moved
 * forward (a higher stage or any won stage), how many died (a lost stage), and
 * how many are still sitting there or moved backwards.
 */
export const computeStageConversion = (
  stages: StageRef[],
  transitions: StageTransition[],
): StageConversion[] => {
  const stageById = new Map(stages.map((s) => [s.id, s]))
  const openStages = stages
    .filter((s) => s.outcome === 'open')
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const stats = new Map(
    openStages.map((s) => [
      s.id,
      {
        entered: new Set<string>(),
        advanced: new Set<string>(),
        lost: new Set<string>(),
      },
    ]),
  )

  for (const [leadId, list] of groupByLead(transitions)) {
    list.forEach((t, i) => {
      const stage = t.toStageId ? stageById.get(t.toStageId) : undefined
      const entry = stage ? stats.get(stage.id) : undefined
      if (!stage || !entry) return
      entry.entered.add(leadId)
      for (const later of list.slice(i + 1)) {
        const laterStage = later.toStageId
          ? stageById.get(later.toStageId)
          : undefined
        if (!laterStage) continue
        if (laterStage.outcome === 'lost') {
          entry.lost.add(leadId)
          break
        }
        if (
          laterStage.outcome === 'won' ||
          laterStage.sortOrder > stage.sortOrder
        ) {
          entry.advanced.add(leadId)
          break
        }
      }
    })
  }

  return openStages.map((stage) => {
    const s = stats.get(stage.id)!
    const entered = s.entered.size
    const advanced = s.advanced.size
    const lost = s.lost.size
    return {
      stageId: stage.id,
      label: stage.label,
      entered,
      advanced,
      lost,
      stalled: entered - advanced - lost,
      conversionRate: entered > 0 ? advanced / entered : 0,
    }
  })
}

export const average = (values: number[]): number =>
  values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0

export const median = (values: number[]): number => {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Classic sales velocity: revenue the pipeline produces per day.
 * (open deals × win rate × average won deal size) / average cycle length.
 */
export const salesVelocityPerDay = (input: {
  openDeals: number
  winRate: number
  avgWonDealSize: number
  avgCycleDays: number
}): number => {
  if (input.avgCycleDays <= 0) return 0
  return (
    (input.openDeals * input.winRate * input.avgWonDealSize) /
    input.avgCycleDays
  )
}

/** Below this the trend is noise, not a slowdown or speedup. */
const TREND_THRESHOLD = 0.15

export type StageTrend = 'speeding_up' | 'slowing_down' | 'steady' | 'no_data'

export const classifyTrend = (
  currentAvgDays: number,
  previousAvgDays: number,
  currentSamples: number,
  previousSamples: number,
): StageTrend => {
  if (currentSamples === 0 || previousSamples === 0 || previousAvgDays === 0) {
    return 'no_data'
  }
  const change = (currentAvgDays - previousAvgDays) / previousAvgDays
  if (change > TREND_THRESHOLD) return 'slowing_down'
  if (change < -TREND_THRESHOLD) return 'speeding_up'
  return 'steady'
}

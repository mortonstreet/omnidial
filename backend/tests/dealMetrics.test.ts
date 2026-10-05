import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyTrend,
  computeStageConversion,
  computeStageDurations,
  resolveStageOutcome,
  salesVelocityPerDay,
  type StageRef,
} from '../src/lib/deal-metrics'

const day = (n: number) => new Date(Date.UTC(2026, 0, 1 + n))

const stages: StageRef[] = [
  { id: 'new', label: 'New', sortOrder: 0, outcome: 'open' },
  { id: 'demo', label: 'Demo', sortOrder: 1, outcome: 'open' },
  { id: 'proposal', label: 'Proposal', sortOrder: 2, outcome: 'open' },
  { id: 'won', label: 'Closed Won', sortOrder: 3, outcome: 'won' },
  { id: 'lost', label: 'Closed Lost', sortOrder: 4, outcome: 'lost' },
]

test('unset stage outcome is inferred from the label', () => {
  assert.equal(resolveStageOutcome({ label: 'Closed Won' }), 'won')
  assert.equal(resolveStageOutcome({ label: 'Closed - Lost' }), 'lost')
  assert.equal(resolveStageOutcome({ label: 'Disqualified' }), 'lost')
  assert.equal(resolveStageOutcome({ label: "Won't buy" }), 'open')
  assert.equal(resolveStageOutcome({ label: 'Demo booked' }), 'open')
})

test('an explicit outcome overrides the label', () => {
  assert.equal(resolveStageOutcome({ label: 'Won', outcome: 'open' }), 'open')
  assert.equal(
    resolveStageOutcome({ label: 'Signed', outcome: 'lost' }),
    'lost',
  )
})

test('stage durations only count finished stays', () => {
  const samples = computeStageDurations([
    { leadId: 'a', toStageId: 'new', createdAt: day(0) },
    { leadId: 'a', toStageId: 'demo', createdAt: day(3) },
    { leadId: 'a', toStageId: 'won', createdAt: day(10) },
    // b is still in New: no sample yet
    { leadId: 'b', toStageId: 'new', createdAt: day(1) },
  ])
  assert.deepEqual(
    samples.map((s) => [s.stageId, s.days]),
    [
      ['new', 3],
      ['demo', 7],
    ],
  )
})

test('conversion separates advanced, lost and stalled leads per stage', () => {
  const result = computeStageConversion(stages, [
    // a: new -> demo -> won
    { leadId: 'a', toStageId: 'new', createdAt: day(0) },
    { leadId: 'a', toStageId: 'demo', createdAt: day(1) },
    { leadId: 'a', toStageId: 'won', createdAt: day(2) },
    // b: new -> lost
    { leadId: 'b', toStageId: 'new', createdAt: day(0) },
    { leadId: 'b', toStageId: 'lost', createdAt: day(4) },
    // c: stuck in new
    { leadId: 'c', toStageId: 'new', createdAt: day(0) },
    // d: skips straight to proposal, then back to demo (backwards = stalled in proposal)
    { leadId: 'd', toStageId: 'proposal', createdAt: day(0) },
    { leadId: 'd', toStageId: 'demo', createdAt: day(1) },
  ])
  const byId = Object.fromEntries(result.map((r) => [r.stageId, r]))

  assert.deepEqual(
    [byId.new.entered, byId.new.advanced, byId.new.lost, byId.new.stalled],
    [3, 1, 1, 1],
  )
  assert.equal(byId.new.conversionRate, 1 / 3)
  assert.deepEqual([byId.demo.entered, byId.demo.advanced], [2, 1])
  assert.deepEqual([byId.proposal.entered, byId.proposal.stalled], [1, 1])
  assert.equal(
    result.some((r) => r.stageId === 'won'),
    false,
  )
})

test('sales velocity is zero without a measured cycle', () => {
  assert.equal(
    salesVelocityPerDay({
      openDeals: 10,
      winRate: 0.2,
      avgWonDealSize: 5000,
      avgCycleDays: 0,
    }),
    0,
  )
  assert.equal(
    salesVelocityPerDay({
      openDeals: 10,
      winRate: 0.2,
      avgWonDealSize: 5000,
      avgCycleDays: 20,
    }),
    500,
  )
})

test('trend needs samples on both sides and ignores small moves', () => {
  assert.equal(classifyTrend(5, 4, 3, 3), 'slowing_down')
  assert.equal(classifyTrend(3, 4, 3, 3), 'speeding_up')
  assert.equal(classifyTrend(4.2, 4, 3, 3), 'steady')
  assert.equal(classifyTrend(4, 0, 3, 0), 'no_data')
})

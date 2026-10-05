import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildDealSignalUserPrompt,
  normalizeDealSignal,
} from '../src/lib/deal-signal-analysis'
import { stripQuotedReply } from '../src/lib/email-text'
import { dealTrackingProperties } from '../src/lib/hubspot-deal-properties'

test('scores are clamped to 0-10 and junk becomes null', () => {
  const s = normalizeDealSignal({
    nextStep: 'Demo with CFO',
    nextStepScore: 14,
    championScore: -2,
    engagementScore: '7.6',
    qualityScore: 'great',
    sentiment: 'ecstatic',
    nextStepChannel: 'carrier pigeon',
  })
  assert.equal(s.nextStepScore, 10)
  assert.equal(s.championScore, 0)
  assert.equal(s.engagementScore, 8)
  assert.equal(s.qualityScore, null)
  assert.equal(s.sentiment, null)
  assert.equal(s.nextStepChannel, null)
})

test('a secured next step needs an actual next step and a valid date', () => {
  const noStep = normalizeDealSignal({ nextStepSecured: true, nextStep: '  ' })
  assert.equal(noStep.nextStepSecured, false)

  const withStep = normalizeDealSignal({
    nextStepSecured: true,
    nextStep: 'Contract review Tuesday 2pm',
    nextStepDueAt: 'not a date',
  })
  assert.equal(withStep.nextStepSecured, true)
  assert.equal(withStep.nextStepDueAt, null)
})

test('long content keeps the opening and the close', () => {
  const content = `OPENING ${'x'.repeat(100_000)} CLOSING`
  const prompt = buildDealSignalUserPrompt({
    source: 'meeting',
    occurredAt: new Date('2026-10-01T00:00:00Z'),
    content,
  })
  assert.ok(prompt.includes('OPENING'))
  assert.ok(prompt.includes('CLOSING'))
  assert.ok(prompt.length < 70_000)
})

test('quoted email history is removed', () => {
  const body =
    'Sounds good, Tuesday works.\n\nOn Mon, Oct 5, 2026 at 9:00 AM Rep <rep@x.com> wrote:\n> Can we meet Tuesday?'
  assert.equal(stripQuotedReply(body), 'Sounds good, Tuesday works.')
})

test('HubSpot gets the reason on the matching side only', () => {
  const lost = dealTrackingProperties({
    dealOutcome: 'lost',
    dealOutcomeReason: 'competitor',
    dealOutcomeNotes: 'Went with Acme',
    dealClosedAt: new Date('2026-10-01T00:00:00Z'),
    nextStep: 'n'.repeat(300),
  })
  assert.equal(lost.closed_lost_reason, 'competitor - Went with Acme')
  assert.equal(lost.closed_won_reason, undefined)
  assert.equal(lost.closedate, '2026-10-01T00:00:00.000Z')
  assert.equal(lost.hs_next_step.length, 255)
  assert.deepEqual(dealTrackingProperties({}), {})
})

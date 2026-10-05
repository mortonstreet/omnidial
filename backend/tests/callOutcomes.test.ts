import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyCall,
  isPositiveOutcome,
  summarizeCalling,
  voicemailCutoff,
} from '../src/lib/call-outcomes'

test('dispositions decide first; undispositioned calls use the org voicemail length', () => {
  assert.equal(
    classifyCall({ dispositionLabel: 'Voicemail', duration: 40 }, 46),
    'voicemail',
  )
  assert.equal(
    classifyCall({ dispositionLabel: 'Wrong Number', duration: 60 }, 46),
    'bad_number',
  )
  assert.equal(
    classifyCall({ dispositionLabel: 'Not Interested', duration: 5 }, 46),
    'conversation',
  )
  assert.equal(
    classifyCall({ dispositionLabel: 'Gatekeeper', duration: 30 }, 46),
    'conversation',
  )
  assert.equal(
    classifyCall({ dispositionLabel: null, duration: 0 }, 46),
    'no_answer',
  )
  assert.equal(
    classifyCall({ dispositionLabel: null, duration: 120 }, 46),
    'conversation',
  )
  assert.equal(
    classifyCall({ dispositionLabel: null, duration: 30 }, 46),
    'unclear',
  )
  assert.equal(
    classifyCall({ dispositionLabel: null, duration: 120 }, null),
    'unclear',
  )
})

test('positive outcomes exclude "not interested"', () => {
  assert.equal(isPositiveOutcome('Callback Requested'), true)
  assert.equal(isPositiveOutcome('Meeting Booked'), true)
  assert.equal(isPositiveOutcome('Interested'), true)
  assert.equal(isPositiveOutcome('Not Interested'), false)
  assert.equal(isPositiveOutcome('Connected'), false)
})

test('voicemail cutoff is the 90th percentile, and needs enough samples', () => {
  assert.equal(voicemailCutoff([10, 20, 30]), null)
  assert.equal(voicemailCutoff([10, 12, 14, 16, 18, 20, 22, 24, 26, 46]), 26)
})

test('funnel excludes voicemail time from talk time', () => {
  const f = summarizeCalling(
    [
      {
        id: '1',
        dispositionLabel: 'Voicemail',
        duration: 40,
        direction: 'outbound',
      },
      {
        id: '2',
        dispositionLabel: 'Connected',
        duration: 300,
        direction: 'outbound',
      },
      { id: '3', dispositionLabel: null, duration: 200, direction: 'outbound' },
      {
        id: '4',
        dispositionLabel: 'Callback Requested',
        duration: 60,
        direction: 'outbound',
      },
    ],
    46,
    new Set(['2']),
  )
  assert.equal(f.dials, 4)
  assert.equal(f.conversations, 3)
  assert.equal(f.voicemails, 1)
  assert.equal(f.conversationSeconds, 560)
  assert.equal(f.positiveOutcomes, 2) // callback disposition + AI-secured next step on call 2
  assert.equal(f.conversationRate, 0.75)
})

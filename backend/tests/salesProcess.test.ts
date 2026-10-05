import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildTimeline,
  summarizeSalesProcess,
  type Touch,
} from '../src/lib/sales-process'

const at = (day: number, hour = 9) => new Date(Date.UTC(2026, 0, 1 + day, hour))

test('timeline counts touches, talk time, gaps and reply times per thread', () => {
  const t = buildTimeline([
    {
      kind: 'call',
      direction: 'outbound',
      at: at(0),
      connected: true,
      durationSeconds: 600,
    },
    {
      kind: 'call',
      direction: 'outbound',
      at: at(1),
      connected: false,
      durationSeconds: 20,
    },
    { kind: 'email', direction: 'outbound', at: at(2, 9), threadId: 'a' },
    { kind: 'email', direction: 'inbound', at: at(2, 15), threadId: 'a' }, // buyer replied in 6h
    { kind: 'email', direction: 'outbound', at: at(3, 9), threadId: 'a' }, // we replied in 18h
    { kind: 'email', direction: 'inbound', at: at(4, 9), threadId: 'b' }, // different thread: no pair
    { kind: 'meeting', direction: null, at: at(6), durationSeconds: 1800 },
  ])!
  assert.equal(t.touches, 7)
  assert.deepEqual(t.byKind, { call: 2, email: 4, meeting: 1 })
  assert.equal(t.connectedCalls, 1)
  assert.equal(t.talkSeconds, 600) // unanswered call time is not talk time
  assert.equal(t.meetingSeconds, 1800)
  assert.deepEqual(t.buyerReplyHours, [6])
  assert.deepEqual(t.repReplyHours, [18])
  assert.equal(t.firstMeetingAt?.toISOString(), at(6).toISOString())
})

test('won-deal cycle runs from first touch to close and ignores later touches', () => {
  const touches = new Map<string, Touch[]>([
    [
      'won',
      [
        {
          kind: 'call',
          direction: 'outbound',
          at: at(0),
          connected: true,
          durationSeconds: 300,
        },
        { kind: 'meeting', direction: null, at: at(10) },
        { kind: 'email', direction: 'outbound', at: at(40) }, // after close
      ],
    ],
  ])
  const s = summarizeSalesProcess({
    touchesByLead: touches,
    won: [{ leadId: 'won', closedAt: at(20) }],
    openLeadIds: [],
  })
  assert.equal(s.wonWithTouches, 1)
  assert.equal(s.avgFirstTouchToCloseDays, 20)
  assert.equal(s.avgTouchesToWin, 2)
  assert.deepEqual(s.touchesToWinByKind, { call: 1, email: 0, meeting: 1 })
  assert.equal(s.avgTalkMinutesToWin, 5)
})

test("quiet deals are judged against the org's own rhythm, not a fixed number", () => {
  const touches = new Map<string, Touch[]>([
    // won deal: touches every 2 days -> typical gap 2d, quiet after > 4d
    [
      'won',
      [0, 2, 4, 6].map((d) => ({
        kind: 'call' as const,
        direction: 'outbound' as const,
        at: at(d),
      })),
    ],
    ['fresh', [{ kind: 'email', direction: 'outbound', at: at(27) }]],
    ['stale', [{ kind: 'email', direction: 'outbound', at: at(20) }]],
  ])
  const s = summarizeSalesProcess({
    touchesByLead: touches,
    won: [{ leadId: 'won', closedAt: at(7) }],
    openLeadIds: ['fresh', 'stale'],
    now: at(30),
  })
  assert.equal(s.typicalGapDays, 2)
  assert.deepEqual(
    s.quietDeals.map((q) => q.leadId),
    ['stale'],
  )
  assert.equal(s.quietDeals[0].daysSilent, 10)
})

test('no data means nulls, not zeros', () => {
  const s = summarizeSalesProcess({
    touchesByLead: new Map(),
    won: [],
    openLeadIds: ['x'],
  })
  assert.equal(s.avgFirstTouchToCloseDays, null)
  assert.equal(s.medianBuyerReplyHours, null)
  assert.deepEqual(s.quietDeals, [])
})

import { anyAddressOnDomain, companyDomain } from '../src/lib/email-domain'

test('company domain comes from a work email or the website, never free mail', () => {
  assert.equal(companyDomain({ email: 'jason@velarity.com' }), 'velarity.com')
  assert.equal(
    companyDomain({
      email: 'jason@gmail.com',
      website: 'https://www.velarity.com/about',
    }),
    'velarity.com',
  )
  assert.equal(companyDomain({ email: 'jason@gmail.com' }), null)
  assert.equal(
    anyAddressOnDomain(
      ['rep@us.io', 'jason@mail.velarity.com'],
      'velarity.com',
    ),
    true,
  )
  assert.equal(
    anyAddressOnDomain(['jason@notvelarity.com'], 'velarity.com'),
    false,
  )
})

import { callBodyHtml, threadNoteHtml } from '../src/lib/hubspot-activity-body'

test('HubSpot bodies carry summary + key moments and escape content', () => {
  const html = callBodyHtml({
    dispositionLabel: 'Booked',
    summary: 'Wants a demo <next week>',
    signal: {
      nextStep: 'Demo Tue 2pm',
      nextStepSecured: true,
      championName: 'Jason',
      championScore: 8,
      evidence: { risks: ['budget not set'], nextStep: 'Tuesday works' },
    },
    leadUrl: 'https://app/x',
  })
  assert.ok(html.includes('&lt;next week&gt;'))
  assert.ok(html.includes('Next step (secured):</strong> Demo Tue 2pm'))
  assert.ok(html.includes('Jason (8/10)'))
  assert.ok(html.includes('Risk:</strong> budget not set'))
  assert.ok(html.includes('“Tuesday works”'))
  assert.ok(!html.includes('undefined'))

  const note = threadNoteHtml({
    signal: { summary: 'Pricing back and forth' },
    stats: {
      messages: 60,
      fromBuyer: 25,
      fromRep: 35,
      firstAt: new Date('2026-01-01'),
      lastAt: new Date('2026-04-01'),
      medianBuyerReplyHours: 30,
    },
  })
  assert.ok(note.includes('60 messages (25 from buyer, 35 from us)'))
  assert.ok(note.includes('2026-01-01 → 2026-04-01'))
  assert.ok(note.includes('buyer replies in ~30h'))
})

import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildContactProperties,
  buildDealProperties,
  hashProperties,
  readSyncConfig,
  resolveConflict,
  reverseStageLookup,
  sameValue,
  type LeadForSync,
} from '../src/lib/hubspot-sync-rules'

const lead: LeadForSync = {
  id: 'lead-1',
  firstName: '  Jason ',
  lastName: 'N/A',
  email: ' Jason@Velarity.COM ',
  phone: '(415) 555-0132 x9',
  normalizedPhone: '+14155550132',
  company: 'Velarity  HCS',
  title: '-',
  linkedInUrl: 'see notes',
  dealValue: '12000.00',
  initialDealValue: '15000.00',
  dealOutcome: 'lost',
  dealClosedAt: new Date('2026-10-01T00:00:00Z'),
  dealOutcomeReason: 'competitor',
  dealOutcomeNotes: null,
}

test('contact properties are cleaned and never blank HubSpot fields', () => {
  assert.deepEqual(buildContactProperties(lead), {
    firstname: 'Jason',
    email: 'jason@velarity.com',
    phone: '+14155550132',
    company: 'Velarity HCS',
  })
})

test('deal properties use the mapped stage and only add OmniDial fields when set up', () => {
  const base = readSyncConfig({
    pipelineId: 'p1',
    stageMap: { s1: 'appointmentscheduled' },
  })
  const props = buildDealProperties({
    lead,
    config: base,
    stageValue: 'appointmentscheduled',
    signal: null,
    talkTimeSeconds: 600,
    leadUrl: 'https://app/x',
  })
  assert.equal(props.dealname, 'Velarity HCS - Jason')
  assert.equal(props.dealstage, 'appointmentscheduled')
  assert.equal(props.pipeline, 'p1')
  assert.equal(props.amount, '12000')
  assert.equal(props.closed_lost_reason, 'competitor')
  assert.equal(props.omnidial_talk_time_minutes, undefined)

  const ready = readSyncConfig({
    customPropertiesReady: true,
    stageProperty: 'deal_stage_2',
  })
  const custom = buildDealProperties({
    lead,
    config: ready,
    stageValue: 'opt_3',
    signal: null,
    talkTimeSeconds: 600,
    leadUrl: 'https://app/x',
  })
  assert.equal(custom.deal_stage_2, 'opt_3')
  assert.equal(custom.pipeline, undefined)
  assert.equal(custom.omnidial_talk_time_minutes, '10')
  assert.equal(custom.omnidial_first_quote, '15000')
})

test('phone falls back to the stored number when normalizedPhone is missing', () => {
  const props = buildContactProperties({
    ...lead,
    phone: '+14083842702',
    normalizedPhone: null,
  })
  assert.equal(props.phone, '+14083842702')
})

test('hash ignores key order', () => {
  assert.equal(
    hashProperties({ a: 1, b: { c: 2, d: 3 } }),
    hashProperties({ b: { d: 3, c: 2 }, a: 1 }),
  )
})

test('tracked local edits: newest wins', () => {
  assert.equal(
    resolveConflict(
      { editedAt: '2026-10-02T00:00:00Z', isEmpty: false },
      { editedAt: '2026-10-01T00:00:00Z' },
    ),
    'local',
  )
  assert.equal(
    resolveConflict(
      { editedAt: '2026-10-01T00:00:00Z', isEmpty: false },
      { editedAt: '2026-10-02T00:00:00Z' },
    ),
    'remote',
  )
  assert.equal(
    resolveConflict({ editedAt: '2026-10-01T00:00:00Z', isEmpty: false }, {}),
    'local',
  )
})

test('untracked local edits: HubSpot history decides', () => {
  // HubSpot value was our own old push -> OmniDial's current value is later
  assert.equal(
    resolveConflict(
      { isEmpty: false },
      { editedAt: '2026-08-14T00:00:00Z', fromOmniDial: true },
    ),
    'local',
  )
  // A person changed it in HubSpot -> HubSpot wins
  assert.equal(
    resolveConflict(
      { isEmpty: false },
      { editedAt: '2026-08-24T00:00:00Z', fromOmniDial: false },
    ),
    'remote',
  )
  // OmniDial blank -> HubSpot fills it, whoever wrote it
  assert.equal(
    resolveConflict(
      { isEmpty: true },
      { editedAt: '2026-08-24T00:00:00Z', fromOmniDial: true },
    ),
    'remote',
  )
  // No history at all -> keep OmniDial's value
  assert.equal(resolveConflict({ isEmpty: false }, {}), 'local')
})

test('stage map reverses and values compare without format noise', () => {
  assert.equal(reverseStageLookup({ s1: 'a', s2: 'b' }, 'b'), 's2')
  assert.equal(sameValue('dealValue', '12000.00', '12000'), true)
  assert.equal(sameValue('phone', '+14155550132', '(415) 555-0132'), true)
  assert.equal(sameValue('email', 'a@x.io', 'A@X.io'), true)
  assert.equal(
    sameValue(
      'dealClosedAt',
      new Date('2026-10-01T00:00:00Z'),
      '2026-10-01T00:00:00.000Z',
    ),
    true,
  )
  assert.equal(sameValue('company', 'Acme', 'Acme Inc'), false)
})

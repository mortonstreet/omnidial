import assert from 'node:assert/strict'
import test from 'node:test'
import {
  cleanCustomFields,
  cleanLeadFields,
  normalizeEmail,
  normalizeLinkedInUrl,
  normalizePhoneValue,
  parseMoney,
  type HygieneIssue,
} from '../src/lib/lead-hygiene'

test('emails are canonicalised or rejected', () => {
  assert.equal(normalizeEmail('  John.Doe@ACME.com '), 'john.doe@acme.com')
  assert.equal(normalizeEmail('Jane Doe <Jane@X.io>'), 'jane@x.io')
  assert.equal(normalizeEmail('mailto:bob@x.io;'), 'bob@x.io')
  const issues: HygieneIssue[] = []
  assert.equal(normalizeEmail('john @acme', issues), null)
  assert.equal(normalizeEmail('N/A', issues), null)
  assert.deepEqual(
    issues.map((i) => i.problem),
    ['invalid_email', 'placeholder'],
  )
})

test('phones go to E.164, keep extensions, and flag Excel corruption', () => {
  assert.deepEqual(normalizePhoneValue('(415) 555-0132 x12'), {
    e164: '+14155550132',
    extension: '12',
  })
  const issues: HygieneIssue[] = []
  assert.equal(normalizePhoneValue('1.55E+10', issues), null)
  assert.equal(issues[0].problem, 'excel_scientific_notation')
})

test('money parses real-world spreadsheet values', () => {
  assert.equal(parseMoney('$12,000'), 12000)
  assert.equal(parseMoney('12k'), 12000)
  assert.equal(parseMoney('USD 1.5M'), 1500000)
  assert.equal(parseMoney('€ 9.500,50'), 9500.5)
  assert.equal(parseMoney(0), 0)
  const issues: HygieneIssue[] = []
  assert.equal(parseMoney('call me', issues), null)
  assert.equal(parseMoney('($500)', issues), null)
  assert.deepEqual(
    issues.map((i) => i.problem),
    ['invalid_money', 'negative_money'],
  )
})

test('linkedin urls are canonical and non-linkedin urls rejected', () => {
  assert.equal(
    normalizeLinkedInUrl('linkedin.com/in/jane-doe/?utm=x'),
    'https://www.linkedin.com/in/jane-doe',
  )
  assert.equal(normalizeLinkedInUrl('https://see notes'), null)
  assert.equal(normalizeLinkedInUrl('https://example.com/in/jane'), null)
})

test('partial updates only touch present fields', () => {
  const out = cleanLeadFields({ company: '  ACME   Inc ', firstName: '-' })
  assert.deepEqual(out, { company: 'ACME Inc', firstName: null })
  assert.equal('email' in out, false)
})

test('custom fields map onto the schema and coerce types', () => {
  const issues: HygieneIssue[] = []
  const out = cleanCustomFields(
    {
      'Funding Amount ': '$2.5M',
      industry: 'N/A',
      'Next Call': 'not a date',
      ' Notes  ': 'Warm  lead',
    },
    [
      { name: 'funding_amount', label: 'Funding Amount', fieldType: 'number' },
      { name: 'next_call', label: 'Next Call', fieldType: 'date' },
    ],
    issues,
  )
  assert.deepEqual(out, { funding_amount: '2500000', Notes: 'Warm lead' })
  assert.deepEqual(issues.map((i) => i.problem).sort(), [
    'placeholder',
    'type_mismatch',
  ])
})

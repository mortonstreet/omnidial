import assert from 'node:assert/strict'
import test from 'node:test'
import { createHash, createHmac } from 'crypto'
import { verifyHubSpotSignature } from '../src/lib/hubspot-signature'

const secret = 'test-secret'
const body =
  '[{"eventId":1,"subscriptionType":"contact.deletion","objectId":42}]'
const uri = 'https://api.example.com/api/webhooks/hubspot'
const now = 1_760_000_000_000

const v3 = (ts: number, u = uri) =>
  createHmac('sha256', secret).update(`POST${u}${body}${ts}`).digest('base64')

test('accepts a fresh v3 signature', () => {
  const result = verifyHubSpotSignature({
    clientSecret: secret,
    method: 'POST',
    uri,
    rawBody: body,
    now,
    headers: {
      'x-hubspot-signature-v3': v3(now),
      'x-hubspot-request-timestamp': String(now),
    },
  })
  assert.equal(result.valid, true)
})

test('rejects a replayed v3 signature older than 5 minutes', () => {
  const ts = now - 6 * 60 * 1000
  const result = verifyHubSpotSignature({
    clientSecret: secret,
    method: 'POST',
    uri,
    rawBody: body,
    now,
    headers: {
      'x-hubspot-signature-v3': v3(ts),
      'x-hubspot-request-timestamp': String(ts),
    },
  })
  assert.equal(result.valid, false)
})

test('rejects a tampered body', () => {
  const result = verifyHubSpotSignature({
    clientSecret: secret,
    method: 'POST',
    uri,
    rawBody: body.replace('42', '43'),
    now,
    headers: {
      'x-hubspot-signature-v3': v3(now),
      'x-hubspot-request-timestamp': String(now),
    },
  })
  assert.equal(result.valid, false)
})

test('falls back to v1 and rejects unsigned requests', () => {
  const v1 = createHash('sha256')
    .update(secret + body)
    .digest('hex')
  assert.equal(
    verifyHubSpotSignature({
      clientSecret: secret,
      method: 'POST',
      uri,
      rawBody: body,
      headers: {
        'x-hubspot-signature': v1,
        'x-hubspot-signature-version': 'v1',
      },
    }).valid,
    true,
  )
  assert.equal(
    verifyHubSpotSignature({
      clientSecret: secret,
      method: 'POST',
      uri,
      rawBody: body,
      headers: {},
    }).valid,
    false,
  )
})

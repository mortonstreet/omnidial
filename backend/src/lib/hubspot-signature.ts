import { createHash, createHmac, timingSafeEqual } from 'crypto'

/** HubSpot: reject requests whose timestamp is older than 5 minutes. */
const MAX_AGE_MS = 5 * 60 * 1000

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/**
 * HubSpot hashes the URI with percent-encoded characters decoded, except the
 * `?` that starts the query string.
 */
const decodeUri = (uri: string) => {
  try {
    return decodeURI(uri).replace(/%3A/gi, ':').replace(/%2F/gi, '/')
  } catch {
    return uri
  }
}

export interface HubSpotSignatureInput {
  clientSecret: string
  method: string
  /** Full URL HubSpot called, e.g. https://api.example.com/api/webhooks/hubspot */
  uri: string
  rawBody: string
  headers: Record<string, string | string[] | undefined>
  now?: number
}

const header = (
  headers: HubSpotSignatureInput['headers'],
  name: string,
): string | undefined => {
  const value = headers[name.toLowerCase()]
  return Array.isArray(value) ? value[0] : value
}

/**
 * Verify a HubSpot webhook. Prefers v3 (HMAC + replay window); falls back to
 * v1 (sha256 of secret + body), which legacy apps also send.
 */
export const verifyHubSpotSignature = (
  input: HubSpotSignatureInput,
): { valid: boolean; reason?: string } => {
  const { clientSecret, method, rawBody, headers } = input
  if (!clientSecret)
    return { valid: false, reason: 'HubSpot client secret not configured' }

  const v3 = header(headers, 'x-hubspot-signature-v3')
  const timestamp = header(headers, 'x-hubspot-request-timestamp')
  if (v3 && timestamp) {
    const age = (input.now ?? Date.now()) - Number(timestamp)
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      return { valid: false, reason: 'Stale or invalid timestamp' }
    }
    const expected = createHmac('sha256', clientSecret)
      .update(
        `${method.toUpperCase()}${decodeUri(input.uri)}${rawBody}${timestamp}`,
        'utf8',
      )
      .digest('base64')
    return safeEqual(expected, v3)
      ? { valid: true }
      : { valid: false, reason: 'v3 mismatch' }
  }

  const v1 = header(headers, 'x-hubspot-signature')
  const version = header(headers, 'x-hubspot-signature-version')
  if (v1 && (!version || version === 'v1')) {
    const expected = createHash('sha256')
      .update(clientSecret + rawBody, 'utf8')
      .digest('hex')
    return safeEqual(expected, v1)
      ? { valid: true }
      : { valid: false, reason: 'v1 mismatch' }
  }

  return { valid: false, reason: 'Missing signature headers' }
}

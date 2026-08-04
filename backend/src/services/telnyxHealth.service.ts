import { TELNYX_API_BASE } from '@/lib/telnyx'
import logger from '@/lib/logger'

export interface TelnyxHealth {
  healthy: boolean
  latencyMs: number
  httpStatus?: number
  error?: string
  checkedAt: string
}

// Telnyx rate-limits aggressively (error 10011), and every dialer client would
// otherwise probe independently. One probe per window, shared by all callers.
const CACHE_TTL_MS = 60_000
const PROBE_TIMEOUT_MS = 8_000

let cached: TelnyxHealth | null = null
let cachedAt = 0
let inFlight: Promise<TelnyxHealth> | null = null

/**
 * Probes the Telnyx Client Credential API — the endpoint the browser dialer
 * depends on for telephony tokens, and the one that fails during Voice SDK
 * incidents. Deliberately not the status page: on 2026-08-04 status.telnyx.com
 * reported an open incident for an hour while this endpoint served normally,
 * so the vendor's own status is not a reliable signal for a given account.
 */
const runProbe = async (): Promise<TelnyxHealth> => {
  const startedAt = Date.now()
  const apiKey = process.env.TELNYX_API_KEY

  if (!apiKey) {
    return {
      healthy: false,
      latencyMs: 0,
      error: 'TELNYX_API_KEY not configured',
      checkedAt: new Date().toISOString(),
    }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)

  try {
    const response = await fetch(
      `${TELNYX_API_BASE}/telephony_credentials?page%5Bsize%5D=1`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      },
    )

    const latencyMs = Date.now() - startedAt

    // 429 means we are probing too often, not that Telnyx is down. Treating it
    // as an outage would show a false banner to every rep.
    if (response.status === 429) {
      return {
        healthy: true,
        latencyMs,
        httpStatus: 429,
        error: 'rate limited by probe frequency, treated as healthy',
        checkedAt: new Date().toISOString(),
      }
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return {
        healthy: false,
        latencyMs,
        httpStatus: response.status,
        error: body.slice(0, 200) || `HTTP ${response.status}`,
        checkedAt: new Date().toISOString(),
      }
    }

    return {
      healthy: true,
      latencyMs,
      httpStatus: response.status,
      checkedAt: new Date().toISOString(),
    }
  } catch (error) {
    const latencyMs = Date.now() - startedAt
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `probe timed out after ${PROBE_TIMEOUT_MS}ms`
          : error.message
        : String(error)

    logger.warn({ error, latencyMs }, '[TelnyxHealth] Probe failed')

    return {
      healthy: false,
      latencyMs,
      error: message,
      checkedAt: new Date().toISOString(),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export const getTelnyxHealth = async (
  { force = false } = {},
): Promise<TelnyxHealth> => {
  const fresh = cached && Date.now() - cachedAt < CACHE_TTL_MS

  if (!force && fresh && cached) {
    return cached
  }

  // Collapse concurrent callers onto a single outbound probe.
  if (inFlight) return inFlight

  inFlight = runProbe()
    .then((result) => {
      cached = result
      cachedAt = Date.now()
      return result
    })
    .finally(() => {
      inFlight = null
    })

  return inFlight
}

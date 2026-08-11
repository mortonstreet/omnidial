const MAX_RETRIES = 4
const BASE_BACKOFF_MS = 1000

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const parseRetryAfterMs = (response: Response): number | undefined => {
  const header = response.headers.get('retry-after')
  if (!header) return undefined

  // HubSpot sends whole seconds; some proxies send an HTTP date instead.
  const seconds = Number(header)
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000)

  const until = Date.parse(header)
  return Number.isNaN(until) ? undefined : Math.max(0, until - Date.now())
}

const isRetryable = (status: number) => status === 429 || status >= 500

/**
 * HubSpot throttles hard - search endpoints far more strictly than the rest -
 * so a bulk sync hits 429 long before it hits anything wrong with the data.
 * Retry those instead of surfacing them as a failed lead, honouring
 * Retry-After when HubSpot sends it and backing off exponentially otherwise.
 */
export const hubspotFetch = async (
  url: string,
  init?: RequestInit,
  options: { maxRetries?: number; baseBackoffMs?: number } = {},
): Promise<Response> => {
  const maxRetries = options.maxRetries ?? MAX_RETRIES
  const baseBackoffMs = options.baseBackoffMs ?? BASE_BACKOFF_MS

  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init)

    if (!isRetryable(response.status) || attempt >= maxRetries) {
      return response
    }

    // Body is left unread so the retry does not race a consumed stream.
    const waitMs = parseRetryAfterMs(response) ?? baseBackoffMs * 2 ** attempt
    await sleep(waitMs)
  }
}

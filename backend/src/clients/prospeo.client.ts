/**
 * Prospeo API Client
 * https://prospeo.io/api-documentation
 *
 * Prospeo is a B2B data provider that specializes in finding contact information
 * (email and phone) from LinkedIn profiles.
 */

const PROSPEO_BASE_URL = 'https://api.prospeo.io'

interface ProspeoEnrichPersonResponse {
  error?: boolean
  error_code?: string
  message?: string
  free_enrichment?: boolean
  person?: {
    first_name?: string | null
    last_name?: string | null
    current_job_title?: string | null
    email?: {
      email?: string | null
    } | null
    mobile?: {
      mobile?: string | null
    } | null
    phones?: Array<{
      phone?: string | null
      number?: string | null
    }>
    phone_numbers?: string[]
    location?: {
      city?: string | null
      state?: string | null
      country?: string | null
    } | null
  } | null
  company?: {
    name?: string | null
  } | null
  credits_remaining?: number
}

export interface ProspeoEnrichResult {
  success: boolean
  email?: string
  phone?: string
  phoneNumbers?: string[]
  firstName?: string
  lastName?: string
  company?: string
  title?: string
  location?: string
  creditsRemaining: number
  creditsUsed?: number
  errorMessage?: string
}

interface ProspeoEnrichOptions {
  includeMobile?: boolean
  requireEmail?: boolean
  requireMobile?: boolean
  onlyVerifiedEmail?: boolean
  onlyVerifiedMobile?: boolean
}

const parseProspeoError = (response: Response, errorText: string): string => {
  console.error('[Prospeo] API error response:', errorText)

  try {
    const errorJson = JSON.parse(errorText)
    if (errorJson.message === 'INVALID_API_KEY') {
      return 'Invalid Prospeo API key. Please check your API key in Settings > Data Vendors and ensure it is correct.'
    }
    // Running out of plan credits is the one limit we *do* want surfaced
    // plainly, so it is never confused with a key, quota, or network problem.
    const creditCode = errorJson.message ?? errorJson.error_code
    if (
      typeof creditCode === 'string' &&
      /CREDIT|QUOTA/i.test(creditCode) &&
      !/INVALID/i.test(creditCode)
    ) {
      return 'Prospeo credits exhausted. Your plan quota is used up — top up or wait for the next renewal to continue enriching.'
    }
    if (typeof errorJson.message === 'string') {
      return `Prospeo API error: ${errorJson.message}`
    }
    if (typeof errorJson.error_code === 'string') {
      return `Prospeo API error: ${errorJson.error_code}`
    }
  } catch {
    // Not JSON, fall back to the raw response.
  }

  if (response.status === 401) {
    return 'Prospeo authentication failed. Please verify your API key is correct and active.'
  }

  if (response.status === 429) {
    const retryAfter = response.headers.get('retry-after')
    return retryAfter
      ? `Prospeo rate limit reached. Please retry in ${retryAfter} seconds.`
      : 'Prospeo rate limit reached. Please retry shortly.'
  }

  return `Prospeo API error: ${response.status} - ${errorText}`
}

const locationToString = (
  location?: {
    city?: string | null
    state?: string | null
    country?: string | null
  } | null,
): string | undefined => {
  if (!location) return undefined
  const parts = [location.city, location.state, location.country].filter(
    Boolean,
  )
  return parts.length > 0 ? parts.join(', ') : undefined
}

const compactPhones = (data: ProspeoEnrichPersonResponse): string[] => {
  const person = data.person
  return Array.from(
    new Set(
      [
        person?.mobile?.mobile,
        ...(person?.phone_numbers ?? []),
        ...(person?.phones ?? []).map((phone) => phone.phone ?? phone.number),
      ].filter((value): value is string => !!value),
    ),
  )
}

const parseProspeoPayload = (
  text: string,
): ProspeoEnrichPersonResponse | null => {
  try {
    return JSON.parse(text) as ProspeoEnrichPersonResponse
  } catch {
    return null
  }
}

/**
 * Enrich a lead using their LinkedIn URL
 */
export async function enrichFromLinkedIn(
  apiKey: string,
  linkedInUrl: string,
  options: ProspeoEnrichOptions = {},
): Promise<ProspeoEnrichResult> {
  console.log('[Prospeo] Calling enrich-person API with URL:', linkedInUrl)
  console.log('[Prospeo] API key present:', !!apiKey, 'length:', apiKey?.length)

  const requireMobile =
    options.requireMobile ?? options.onlyVerifiedMobile ?? false
  const requireEmail =
    options.requireEmail ?? options.onlyVerifiedEmail ?? false
  const includeMobile = requireMobile || (options.includeMobile ?? true)

  const response = await fetch(`${PROSPEO_BASE_URL}/enrich-person`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-KEY': apiKey,
    },
    body: JSON.stringify({
      data: {
        linkedin_url: linkedInUrl,
      },
      enrich_mobile: includeMobile,
      only_verified_email: requireEmail,
      only_verified_mobile: requireMobile,
    }),
  })

  console.log('[Prospeo] API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    const errorData = parseProspeoPayload(errorText)
    if (errorData?.error_code === 'NO_MATCH') {
      return {
        success: true,
        creditsRemaining: errorData.credits_remaining ?? 0,
        creditsUsed: 0,
        errorMessage: 'No requested Prospeo contact data found for this lead.',
      }
    }

    return {
      success: false,
      creditsRemaining: 0,
      errorMessage: parseProspeoError(response, errorText),
    }
  }

  const data: ProspeoEnrichPersonResponse = await response.json()

  if (data.error) {
    if (data.error_code === 'NO_MATCH') {
      return {
        success: true,
        creditsRemaining: data.credits_remaining ?? 0,
        creditsUsed: 0,
        errorMessage: 'No requested Prospeo contact data found for this lead.',
      }
    }

    return {
      success: false,
      creditsRemaining: data.credits_remaining ?? 0,
      errorMessage:
        data.message ?? data.error_code ?? 'Unknown Prospeo enrichment error',
    }
  }

  const phoneNumbers = compactPhones(data)
  const email = data.person?.email?.email ?? undefined

  return {
    success: true,
    email,
    phone: phoneNumbers[0],
    phoneNumbers,
    firstName: data.person?.first_name ?? undefined,
    lastName: data.person?.last_name ?? undefined,
    company: data.company?.name ?? undefined,
    title: data.person?.current_job_title ?? undefined,
    location: locationToString(data.person?.location),
    creditsRemaining: data.credits_remaining ?? 0,
    creditsUsed: data.free_enrichment ? 0 : includeMobile ? 10 : 1,
  }
}

/**
 * Test the API connection by making a minimal API call
 */
export async function testConnection(apiKey: string): Promise<{
  success: boolean
  message: string
  creditsRemaining: number | null
}> {
  try {
    const response = await fetch(`${PROSPEO_BASE_URL}/account-information`, {
      method: 'GET',
      headers: {
        'X-KEY': apiKey,
      },
    })

    const data = await response.json()

    if (!response.ok || data.error) {
      // Check for specific error types
      if (data.message === 'INVALID_API_KEY') {
        return {
          success: false,
          message: 'Invalid API key. Please check your Prospeo API key.',
          creditsRemaining: null,
        }
      }
      return {
        success: false,
        message: data.message || `Connection failed: ${response.status}`,
        creditsRemaining: null,
      }
    }

    return {
      success: true,
      message: 'Prospeo connection successful',
      creditsRemaining: data.response?.remaining_credits ?? null,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      creditsRemaining: null,
    }
  }
}

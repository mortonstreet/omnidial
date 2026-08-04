/**
 * LeadMagic API Client
 * https://api.leadmagic.io
 *
 * LeadMagic is a mobile phone number finder that uses LinkedIn profile URLs
 * to locate contact information.
 */

const LEADMAGIC_BASE_URL = 'https://api.leadmagic.io'
const REQUEST_TIMEOUT_MS = 30_000

interface LeadMagicMobileFinderResponse {
  profile_url?: string
  email?: string
  mobile_number?: string
  credits_consumed?: number
  message?: string
}

interface LeadMagicCreditsResponse {
  credits?: number
  message?: string
}

export interface LeadMagicEnrichResult {
  success: boolean
  email?: string
  phone?: string
  creditsUsed: number
  errorMessage?: string
}

/**
 * Enrich a lead using their LinkedIn URL via the mobile-finder endpoint
 */
export async function enrichFromLinkedIn(
  apiKey: string,
  linkedInUrl: string,
): Promise<LeadMagicEnrichResult> {
  console.log('[LeadMagic] Calling mobile-finder API with URL:', linkedInUrl)

  let response: Response
  try {
    response = await fetch(`${LEADMAGIC_BASE_URL}/mobile-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify({
        profile_url: linkedInUrl,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      console.error(
        '[LeadMagic] Request timed out after',
        REQUEST_TIMEOUT_MS,
        'ms',
      )
      return {
        success: false,
        creditsUsed: 0,
        errorMessage: 'LeadMagic API request timed out. Please try again.',
      }
    }
    console.error('[LeadMagic] Network error:', error)
    return {
      success: false,
      creditsUsed: 0,
      errorMessage: `LeadMagic API connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }

  console.log('[LeadMagic] API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[LeadMagic] API error response:', errorText)

    if (response.status === 401 || response.status === 403) {
      return {
        success: false,
        creditsUsed: 0,
        errorMessage:
          'Invalid LeadMagic API key. Please check your API key in Settings > Data Vendors.',
      }
    }

    if (response.status === 429) {
      return {
        success: false,
        creditsUsed: 0,
        errorMessage:
          'LeadMagic rate limit exceeded. Please wait and try again.',
      }
    }

    return {
      success: false,
      creditsUsed: 0,
      errorMessage: `LeadMagic API error: ${response.status} - ${errorText}`,
    }
  }

  let data: LeadMagicMobileFinderResponse
  try {
    data = await response.json()
  } catch {
    console.error('[LeadMagic] Failed to parse response JSON')
    return {
      success: false,
      creditsUsed: 0,
      errorMessage: 'LeadMagic returned an invalid response',
    }
  }

  console.log('[LeadMagic] Response data:', {
    has_email: !!data.email,
    has_mobile: !!data.mobile_number,
    credits_consumed: data.credits_consumed,
    message: data.message,
  })

  const hasPhone = !!data.mobile_number && data.mobile_number.trim().length > 0
  const hasEmail = !!data.email && data.email.trim().length > 0

  if (!hasPhone && !hasEmail) {
    return {
      success: false,
      creditsUsed: data.credits_consumed ?? 0,
      errorMessage: data.message ?? 'No contact information found',
    }
  }

  return {
    success: true,
    email: hasEmail ? data.email!.trim() : undefined,
    phone: hasPhone ? data.mobile_number!.trim() : undefined,
    creditsUsed: data.credits_consumed ?? (hasPhone ? 5 : 0),
  }
}

/**
 * Test the API connection by checking credits balance
 */
export async function testConnection(apiKey: string): Promise<{
  success: boolean
  message: string
  creditsRemaining: number | null
}> {
  try {
    const response = await fetch(`${LEADMAGIC_BASE_URL}/credits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      const errorText = await response.text()

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: 'Invalid API key. Please check your LeadMagic API key.',
          creditsRemaining: null,
        }
      }

      return {
        success: false,
        message: `Connection failed: ${response.status} - ${errorText}`,
        creditsRemaining: null,
      }
    }

    let data: LeadMagicCreditsResponse
    try {
      data = await response.json()
    } catch {
      return {
        success: false,
        message: 'LeadMagic returned an invalid response',
        creditsRemaining: null,
      }
    }

    return {
      success: true,
      message: `LeadMagic connection successful. Credits remaining: ${data.credits ?? 'unknown'}`,
      creditsRemaining: data.credits ?? null,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return {
        success: false,
        message: 'LeadMagic API request timed out',
        creditsRemaining: null,
      }
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      creditsRemaining: null,
    }
  }
}

/**
 * Prospeo API Client
 * https://prospeo.io/api-documentation
 *
 * Prospeo is a B2B data provider that specializes in finding contact information
 * (email and phone) from LinkedIn profiles.
 */

const PROSPEO_BASE_URL = 'https://api.prospeo.io'

interface ProspeoLinkedInResponse {
  response: {
    email?: {
      email: string
      mx_records: boolean
      smtp_check: boolean
      accept_all: boolean
      disposable: boolean
      free: boolean
    }
    phone_numbers?: string[]
    first_name?: string
    last_name?: string
    company?: string
    job_title?: string
    location?: string
  }
  credits_remaining: number
  status: string
  message?: string
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
  errorMessage?: string
}

/**
 * Enrich a lead using their LinkedIn URL
 */
export async function enrichFromLinkedIn(
  apiKey: string,
  linkedInUrl: string,
): Promise<ProspeoEnrichResult> {
  console.log(
    '[Prospeo] Calling linkedin-email-finder API with URL:',
    linkedInUrl,
  )
  console.log('[Prospeo] API key present:', !!apiKey, 'length:', apiKey?.length)

  const response = await fetch(`${PROSPEO_BASE_URL}/linkedin-email-finder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-KEY': apiKey,
    },
    body: JSON.stringify({
      url: linkedInUrl,
    }),
  })

  console.log('[Prospeo] API response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('[Prospeo] API error response:', errorText)

    // Parse specific error types
    if (response.status === 401) {
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.message === 'INVALID_API_KEY') {
          return {
            success: false,
            creditsRemaining: 0,
            errorMessage:
              'Invalid Prospeo API key. Please check your API key in Settings > Data Vendors and ensure it is correct.',
          }
        }
      } catch {
        // Not JSON, use default message
      }
      return {
        success: false,
        creditsRemaining: 0,
        errorMessage:
          'Prospeo authentication failed. Please verify your API key is correct and active.',
      }
    }

    return {
      success: false,
      creditsRemaining: 0,
      errorMessage: `Prospeo API error: ${response.status} - ${errorText}`,
    }
  }

  const data: ProspeoLinkedInResponse = await response.json()

  if (data.status !== 'success') {
    return {
      success: false,
      creditsRemaining: data.credits_remaining ?? 0,
      errorMessage: data.message ?? 'Unknown Prospeo error',
    }
  }

  return {
    success: true,
    email: data.response.email?.email,
    phone: data.response.phone_numbers?.[0],
    phoneNumbers: data.response.phone_numbers ?? [],
    firstName: data.response.first_name,
    lastName: data.response.last_name,
    company: data.response.company,
    title: data.response.job_title,
    location: data.response.location,
    creditsRemaining: data.credits_remaining,
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
    // Prospeo doesn't have a dedicated health/credits endpoint,
    // so we make a real API call with a known LinkedIn URL to test
    // This will use 1 credit but confirms the key works
    const response = await fetch(`${PROSPEO_BASE_URL}/linkedin-email-finder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-KEY': apiKey,
      },
      body: JSON.stringify({
        url: 'https://www.linkedin.com/in/williamhgates/', // Bill Gates - a known public profile
      }),
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
      creditsRemaining: data.credits_remaining ?? null,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection failed',
      creditsRemaining: null,
    }
  }
}

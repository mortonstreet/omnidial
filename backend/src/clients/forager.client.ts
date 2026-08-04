/**
 * Forager API Client
 * https://forager.ai/docs/api
 *
 * Forager is a B2B data provider that finds contact information
 * from various sources including LinkedIn profiles.
 */

const FORAGER_BASE_URL = 'https://api.forager.ai/v1'

interface ForagerPersonResponse {
  success: boolean
  data?: {
    person?: {
      first_name?: string
      last_name?: string
      email?: string
      email_status?: 'verified' | 'unverified' | 'catch-all'
      phone?: string
      mobile_phone?: string
      direct_dial?: string
      linkedin_url?: string
      company?: string
      title?: string
      location?: string
    }
  }
  credits_used?: number
  credits_remaining?: number
  error?: string
}

export interface ForagerEnrichResult {
  success: boolean
  email?: string
  phone?: string
  mobilePhone?: string
  directDial?: string
  firstName?: string
  lastName?: string
  company?: string
  title?: string
  location?: string
  creditsUsed: number
  creditsRemaining: number
  errorMessage?: string
}

/**
 * Enrich a lead using their LinkedIn URL
 */
export async function enrichFromLinkedIn(
  apiKey: string,
  linkedInUrl: string,
): Promise<ForagerEnrichResult> {
  const response = await fetch(`${FORAGER_BASE_URL}/person/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      linkedin_url: linkedInUrl,
      require_email: true,
      require_phone: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      creditsUsed: 0,
      creditsRemaining: 0,
      errorMessage: `Forager API error: ${response.status} - ${errorText}`,
    }
  }

  const data: ForagerPersonResponse = await response.json()

  if (!data.success || !data.data?.person) {
    return {
      success: false,
      creditsUsed: data.credits_used ?? 0,
      creditsRemaining: data.credits_remaining ?? 0,
      errorMessage: data.error ?? 'No person data found',
    }
  }

  const person = data.data.person

  return {
    success: true,
    email: person.email,
    phone: person.phone,
    mobilePhone: person.mobile_phone,
    directDial: person.direct_dial,
    firstName: person.first_name,
    lastName: person.last_name,
    company: person.company,
    title: person.title,
    location: person.location,
    creditsUsed: data.credits_used ?? 1,
    creditsRemaining: data.credits_remaining ?? 0,
  }
}

/**
 * Enrich a lead by name and company (fallback if no LinkedIn URL)
 */
export async function enrichByNameAndCompany(
  apiKey: string,
  firstName: string,
  lastName: string,
  company: string,
): Promise<ForagerEnrichResult> {
  const response = await fetch(`${FORAGER_BASE_URL}/person/enrich`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      company,
      require_email: true,
      require_phone: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    return {
      success: false,
      creditsUsed: 0,
      creditsRemaining: 0,
      errorMessage: `Forager API error: ${response.status} - ${errorText}`,
    }
  }

  const data: ForagerPersonResponse = await response.json()

  if (!data.success || !data.data?.person) {
    return {
      success: false,
      creditsUsed: data.credits_used ?? 0,
      creditsRemaining: data.credits_remaining ?? 0,
      errorMessage: data.error ?? 'No person data found',
    }
  }

  const person = data.data.person

  return {
    success: true,
    email: person.email,
    phone: person.phone,
    mobilePhone: person.mobile_phone,
    directDial: person.direct_dial,
    firstName: person.first_name,
    lastName: person.last_name,
    company: person.company,
    title: person.title,
    location: person.location,
    creditsUsed: data.credits_used ?? 1,
    creditsRemaining: data.credits_remaining ?? 0,
  }
}

/**
 * Test the API connection
 */
export async function testConnection(apiKey: string): Promise<{
  success: boolean
  message: string
  creditsRemaining: number | null
}> {
  try {
    const response = await fetch(`${FORAGER_BASE_URL}/account`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      return {
        success: false,
        message: `Connection failed: ${response.status}`,
        creditsRemaining: null,
      }
    }

    const data = await response.json()

    return {
      success: true,
      message: 'Forager connection successful',
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

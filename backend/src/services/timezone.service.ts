import * as leadRepo from '@/repositories/lead.repository'
import { db } from '@/lib/db'
import {
  lookupTimezoneFromLocation,
  resolveTimezoneOffline,
  isValidIanaTimezone,
  type TimezoneSource,
} from '@/lib/timezoneResolver'

const SERPER_API_KEY = process.env.SERPER_API_KEY || ''
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || ''
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

interface SerperSearchResponse {
  organic: Array<{
    title: string
    link: string
    snippet: string
  }>
  knowledgeGraph?: {
    title?: string
    description?: string
    attributes?: Record<string, string>
  }
}

interface AIResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
}

/**
 * Extract location from Serper search results for a LinkedIn URL
 */
async function searchLinkedInWithSerper(
  linkedInUrl: string,
): Promise<string | null> {
  if (!SERPER_API_KEY) return null

  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: linkedInUrl,
        num: 5,
      }),
    })

    if (!response.ok) {
      console.error('Serper search error for LinkedIn:', response.status)
      return null
    }

    const data = (await response.json()) as SerperSearchResponse

    // Look for location in snippets - LinkedIn snippets often include location
    // e.g., "John Smith - Sales Manager - Company | LinkedIn · Detroit Metropolitan Area"
    if (data.organic) {
      for (const result of data.organic) {
        if (!result.link?.includes('linkedin.com')) continue

        const snippet = result.snippet || ''
        const title = result.title || ''
        const combined = `${title} ${snippet}`

        // Common LinkedIn location patterns
        const locationPatterns = [
          // "· Detroit Metropolitan Area" or "· San Francisco Bay Area"
          /[·|]\s*([A-Z][A-Za-z\s]+(?:Metropolitan|Metro)?\s*Area)/,
          // "Location: City, State"
          /Location:\s*([A-Za-z\s,]+)/,
          // "Based in City" or "based in City, State"
          /[Bb]ased\s+in\s+([A-Z][A-Za-z\s,]+)/,
          // Common LinkedIn snippet format: "City, State · connections"
          /([A-Z][A-Za-z\s]+,\s*[A-Z]{2})\s*[·|]/,
          // "Greater City Area"
          /Greater\s+([A-Z][A-Za-z\s]+)\s+Area/,
        ]

        for (const pattern of locationPatterns) {
          const match = combined.match(pattern)
          if (match?.[1]) {
            return match[1].trim()
          }
        }
      }
    }

    // Check knowledge graph
    if (data.knowledgeGraph?.attributes) {
      const location =
        data.knowledgeGraph.attributes['Location'] ||
        data.knowledgeGraph.attributes['Lives in'] ||
        data.knowledgeGraph.attributes['Based in']
      if (location) return location
    }

    return null
  } catch (error) {
    console.error('Serper LinkedIn search error:', error)
    return null
  }
}

/**
 * Use Perplexity Sonar to extract location from LinkedIn profile
 */
async function extractLocationWithPerplexity(
  linkedInUrl: string,
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://omnidial.io',
        'X-Title': 'OmniDial',
      },
      body: JSON.stringify({
        model: 'perplexity/sonar',
        messages: [
          {
            role: 'user',
            content: `What city/metro area is this LinkedIn person located in? ${linkedInUrl}

Reply with ONLY the location (city and state/country), nothing else. If you cannot determine the location, reply with exactly "UNKNOWN".`,
          },
        ],
        max_tokens: 100,
        temperature: 0.1,
      }),
    })

    if (!response.ok) {
      console.error('Perplexity location extraction error:', response.status)
      return null
    }

    const data = (await response.json()) as AIResponse
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content || content === 'UNKNOWN' || content.length > 100) {
      return null
    }

    return content
  } catch (error) {
    console.error('Perplexity location extraction error:', error)
    return null
  }
}

/**
 * Use AI to map an unusual location string to an IANA timezone
 */
async function mapLocationToTimezoneWithAI(
  location: string,
): Promise<string | null> {
  if (!OPENROUTER_API_KEY) return null

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://omnidial.io',
        'X-Title': 'OmniDial',
      },
      body: JSON.stringify({
        // claude-3.5-haiku was retired and 404s on OpenRouter
        model: 'anthropic/claude-haiku-4.5',
        messages: [
          {
            role: 'user',
            content: `What is the IANA timezone for this location: "${location}"?

Reply with ONLY the IANA timezone identifier (e.g., "America/New_York"), nothing else. If you cannot determine it, reply with exactly "UNKNOWN".`,
          },
        ],
        max_tokens: 50,
        temperature: 0,
      }),
    })

    if (!response.ok) return null

    const data = (await response.json()) as AIResponse
    const content = data.choices?.[0]?.message?.content?.trim()

    if (!content || content === 'UNKNOWN') return null

    // Validate against the runtime's real timezone database rather than a shape
    // regex. A regex accepts anything slash-shaped, which is how hallucinated
    // zones ended up on US leads in this database.
    return isValidIanaTimezone(content) ? content : null
  } catch (error) {
    console.error('AI timezone mapping error:', error)
    return null
  }
}

export interface ResolveTimezoneParams {
  leadId: string
  organizationId: string
  forceResolve?: boolean
}

export interface ResolveTimezoneResult {
  timezone: string | null
  cached: boolean
  location?: string | null
  /** Which signal produced the answer — useful when auditing a wrong result. */
  source?: TimezoneSource | 'linkedin-serper' | 'linkedin-perplexity' | null
}

/**
 * How long a failed resolution stays cached before we try again.
 *
 * A null timezone must NOT be cached forever. The paid enrichment paths fail
 * for reasons that are fixed later (expired key, exhausted credits, retired
 * model); permanently pinning those leads to "unknown" is what silently
 * hollowed out the dialer's timezone ordering.
 */
const FAILED_RESOLUTION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Resolve the timezone for a lead.
 *
 * Offline signals (area code, location custom fields) are tried first: they
 * are free, instant, and cover most of the database. The paid LinkedIn lookups
 * only run for leads the offline resolver cannot place, and only when their
 * keys are configured — so the dialer keeps working when those credits run out.
 */
export const resolveTimezone = async (
  params: ResolveTimezoneParams,
): Promise<ResolveTimezoneResult> => {
  const { leadId, organizationId, forceResolve = false } = params

  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // A successful resolution is cached indefinitely; a failed one only briefly.
  if (lead.timezoneResolvedAt && !forceResolve) {
    const isStaleFailure =
      !lead.timezone &&
      Date.now() - lead.timezoneResolvedAt.getTime() > FAILED_RESOLUTION_TTL_MS

    if (lead.timezone || !isStaleFailure) {
      return {
        timezone: lead.timezone ?? null,
        cached: true,
      }
    }
  }

  // Step 1: offline resolution — no network, no keys, no cost.
  const offline = resolveTimezoneOffline({
    customFields: lead.customFields,
    phone: lead.phone,
    normalizedPhone: lead.normalizedPhone,
  })

  let timezone: string | null = offline.timezone
  let location: string | null = offline.signal
  let source: ResolveTimezoneResult['source'] = offline.source

  // Step 2: only pay for enrichment when offline resolution came up empty
  // and the provider keys are actually configured.
  if (!timezone && lead.linkedInUrl) {
    let linkedInLocation = await searchLinkedInWithSerper(lead.linkedInUrl)
    let linkedInSource: ResolveTimezoneResult['source'] = linkedInLocation
      ? 'linkedin-serper'
      : null

    if (!linkedInLocation) {
      linkedInLocation = await extractLocationWithPerplexity(lead.linkedInUrl)
      if (linkedInLocation) linkedInSource = 'linkedin-perplexity'
    }

    if (linkedInLocation) {
      // Static lookup first (fast, no API call), AI mapping only as a last resort
      timezone =
        lookupTimezoneFromLocation(linkedInLocation) ??
        (await mapLocationToTimezoneWithAI(linkedInLocation))

      if (timezone) {
        location = linkedInLocation
        source = linkedInSource
      }
    }
  }

  await db
    .updateTable('lead')
    .set({
      timezone,
      timezoneResolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .execute()

  return {
    timezone,
    cached: false,
    location,
    source: timezone ? source : null,
  }
}

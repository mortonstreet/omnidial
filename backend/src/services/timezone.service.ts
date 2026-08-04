import * as leadRepo from '@/repositories/lead.repository'
import { db } from '@/lib/db'

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

// Common LinkedIn metro area → IANA timezone mapping
const LOCATION_TIMEZONE_MAP: Record<string, string> = {
  // US - Eastern
  'new york': 'America/New_York',
  'new york city': 'America/New_York',
  nyc: 'America/New_York',
  manhattan: 'America/New_York',
  brooklyn: 'America/New_York',
  boston: 'America/New_York',
  philadelphia: 'America/New_York',
  miami: 'America/New_York',
  atlanta: 'America/New_York',
  washington: 'America/New_York',
  'washington dc': 'America/New_York',
  'washington, dc': 'America/New_York',
  dc: 'America/New_York',
  charlotte: 'America/New_York',
  raleigh: 'America/New_York',
  pittsburgh: 'America/New_York',
  detroit: 'America/Detroit',
  'detroit metropolitan': 'America/Detroit',
  cleveland: 'America/New_York',
  columbus: 'America/New_York',
  jacksonville: 'America/New_York',
  orlando: 'America/New_York',
  tampa: 'America/New_York',
  richmond: 'America/New_York',
  baltimore: 'America/New_York',
  hartford: 'America/New_York',
  providence: 'America/New_York',
  buffalo: 'America/New_York',
  rochester: 'America/New_York',
  'grand rapids': 'America/Detroit',
  indianapolis: 'America/Indiana/Indianapolis',
  cincinnati: 'America/New_York',
  louisville: 'America/Kentucky/Louisville',
  nashville: 'America/Chicago',
  // US - Central
  chicago: 'America/Chicago',
  dallas: 'America/Chicago',
  houston: 'America/Chicago',
  austin: 'America/Chicago',
  'san antonio': 'America/Chicago',
  minneapolis: 'America/Chicago',
  'st. louis': 'America/Chicago',
  'saint louis': 'America/Chicago',
  'kansas city': 'America/Chicago',
  milwaukee: 'America/Chicago',
  memphis: 'America/Chicago',
  'new orleans': 'America/Chicago',
  'oklahoma city': 'America/Chicago',
  omaha: 'America/Chicago',
  'des moines': 'America/Chicago',
  madison: 'America/Chicago',
  // US - Mountain
  denver: 'America/Denver',
  phoenix: 'America/Phoenix',
  'salt lake city': 'America/Denver',
  albuquerque: 'America/Denver',
  tucson: 'America/Phoenix',
  boise: 'America/Boise',
  'colorado springs': 'America/Denver',
  // US - Pacific
  'los angeles': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  seattle: 'America/Los_Angeles',
  portland: 'America/Los_Angeles',
  'san diego': 'America/Los_Angeles',
  'san jose': 'America/Los_Angeles',
  sacramento: 'America/Los_Angeles',
  'las vegas': 'America/Los_Angeles',
  'bay area': 'America/Los_Angeles',
  'silicon valley': 'America/Los_Angeles',
  // US - Other
  honolulu: 'Pacific/Honolulu',
  anchorage: 'America/Anchorage',
  // Canada
  toronto: 'America/Toronto',
  vancouver: 'America/Vancouver',
  montreal: 'America/Toronto',
  calgary: 'America/Edmonton',
  edmonton: 'America/Edmonton',
  ottawa: 'America/Toronto',
  winnipeg: 'America/Winnipeg',
  // UK & Europe
  london: 'Europe/London',
  paris: 'Europe/Paris',
  berlin: 'Europe/Berlin',
  amsterdam: 'Europe/Amsterdam',
  dublin: 'Europe/Dublin',
  madrid: 'Europe/Madrid',
  barcelona: 'Europe/Madrid',
  rome: 'Europe/Rome',
  milan: 'Europe/Rome',
  zurich: 'Europe/Zurich',
  munich: 'Europe/Berlin',
  stockholm: 'Europe/Stockholm',
  copenhagen: 'Europe/Copenhagen',
  oslo: 'Europe/Oslo',
  helsinki: 'Europe/Helsinki',
  vienna: 'Europe/Vienna',
  brussels: 'Europe/Brussels',
  lisbon: 'Europe/Lisbon',
  warsaw: 'Europe/Warsaw',
  prague: 'Europe/Prague',
  // Asia-Pacific
  singapore: 'Asia/Singapore',
  'hong kong': 'Asia/Hong_Kong',
  tokyo: 'Asia/Tokyo',
  sydney: 'Australia/Sydney',
  melbourne: 'Australia/Melbourne',
  mumbai: 'Asia/Kolkata',
  bangalore: 'Asia/Kolkata',
  bengaluru: 'Asia/Kolkata',
  delhi: 'Asia/Kolkata',
  hyderabad: 'Asia/Kolkata',
  shanghai: 'Asia/Shanghai',
  beijing: 'Asia/Shanghai',
  dubai: 'Asia/Dubai',
  'tel aviv': 'Asia/Jerusalem',
  seoul: 'Asia/Seoul',
  // South America
  'sao paulo': 'America/Sao_Paulo',
  'buenos aires': 'America/Argentina/Buenos_Aires',
  'mexico city': 'America/Mexico_City',
  bogota: 'America/Bogota',
  lima: 'America/Lima',
  santiago: 'America/Santiago',
}

// US state abbreviations/names → timezone (for cases where only state is available)
const STATE_TIMEZONE_MAP: Record<string, string> = {
  // Eastern
  connecticut: 'America/New_York',
  ct: 'America/New_York',
  delaware: 'America/New_York',
  de: 'America/New_York',
  florida: 'America/New_York',
  fl: 'America/New_York',
  georgia: 'America/New_York',
  ga: 'America/New_York',
  maine: 'America/New_York',
  me: 'America/New_York',
  maryland: 'America/New_York',
  md: 'America/New_York',
  massachusetts: 'America/New_York',
  ma: 'America/New_York',
  michigan: 'America/Detroit',
  mi: 'America/Detroit',
  'new hampshire': 'America/New_York',
  nh: 'America/New_York',
  'new jersey': 'America/New_York',
  nj: 'America/New_York',
  'new york': 'America/New_York',
  ny: 'America/New_York',
  'north carolina': 'America/New_York',
  nc: 'America/New_York',
  ohio: 'America/New_York',
  oh: 'America/New_York',
  pennsylvania: 'America/New_York',
  pa: 'America/New_York',
  'rhode island': 'America/New_York',
  ri: 'America/New_York',
  'south carolina': 'America/New_York',
  sc: 'America/New_York',
  vermont: 'America/New_York',
  vt: 'America/New_York',
  virginia: 'America/New_York',
  va: 'America/New_York',
  'west virginia': 'America/New_York',
  wv: 'America/New_York',
  'district of columbia': 'America/New_York',
  // Central
  alabama: 'America/Chicago',
  al: 'America/Chicago',
  arkansas: 'America/Chicago',
  ar: 'America/Chicago',
  illinois: 'America/Chicago',
  il: 'America/Chicago',
  iowa: 'America/Chicago',
  ia: 'America/Chicago',
  kansas: 'America/Chicago',
  ks: 'America/Chicago',
  louisiana: 'America/Chicago',
  la: 'America/Chicago',
  minnesota: 'America/Chicago',
  mn: 'America/Chicago',
  mississippi: 'America/Chicago',
  ms: 'America/Chicago',
  missouri: 'America/Chicago',
  mo: 'America/Chicago',
  nebraska: 'America/Chicago',
  ne: 'America/Chicago',
  'north dakota': 'America/Chicago',
  nd: 'America/Chicago',
  oklahoma: 'America/Chicago',
  ok: 'America/Chicago',
  'south dakota': 'America/Chicago',
  sd: 'America/Chicago',
  tennessee: 'America/Chicago',
  tn: 'America/Chicago',
  texas: 'America/Chicago',
  tx: 'America/Chicago',
  wisconsin: 'America/Chicago',
  wi: 'America/Chicago',
  // Mountain
  arizona: 'America/Phoenix',
  az: 'America/Phoenix',
  colorado: 'America/Denver',
  co: 'America/Denver',
  idaho: 'America/Boise',
  id: 'America/Boise',
  montana: 'America/Denver',
  mt: 'America/Denver',
  'new mexico': 'America/Denver',
  nm: 'America/Denver',
  utah: 'America/Denver',
  ut: 'America/Denver',
  wyoming: 'America/Denver',
  wy: 'America/Denver',
  // Pacific
  california: 'America/Los_Angeles',
  ca: 'America/Los_Angeles',
  nevada: 'America/Los_Angeles',
  nv: 'America/Los_Angeles',
  oregon: 'America/Los_Angeles',
  or: 'America/Los_Angeles',
  washington: 'America/Los_Angeles',
  wa: 'America/Los_Angeles',
  // Other
  alaska: 'America/Anchorage',
  ak: 'America/Anchorage',
  hawaii: 'Pacific/Honolulu',
  hi: 'Pacific/Honolulu',
  // Indiana is tricky but mostly Eastern
  indiana: 'America/Indiana/Indianapolis',
  in: 'America/Indiana/Indianapolis',
  kentucky: 'America/Kentucky/Louisville',
  ky: 'America/Kentucky/Louisville',
}

/**
 * Try to match a location string to an IANA timezone using static lookup tables
 */
function lookupTimezoneFromLocation(location: string): string | null {
  const normalized = location
    .toLowerCase()
    .trim()
    // Remove common LinkedIn suffixes
    .replace(/\s*metropolitan\s*area\s*/g, '')
    .replace(/\s*metro\s*area\s*/g, '')
    .replace(/\s*area\s*$/, '')
    .replace(/,\s*united states\s*$/i, '')
    .replace(/,\s*usa\s*$/i, '')
    .replace(/,\s*us\s*$/i, '')
    .replace(/,\s*canada\s*$/i, '')
    .trim()

  // Direct city match
  if (LOCATION_TIMEZONE_MAP[normalized]) {
    return LOCATION_TIMEZONE_MAP[normalized]
  }

  // Try matching city part (before comma): "Detroit, Michigan" → "detroit"
  const parts = normalized.split(',').map((p) => p.trim())
  if (parts.length >= 1) {
    const city = parts[0]
    if (LOCATION_TIMEZONE_MAP[city]) {
      return LOCATION_TIMEZONE_MAP[city]
    }
  }

  // Try matching state part (after comma): "Some City, Ohio" → look up "ohio"
  if (parts.length >= 2) {
    const state = parts[parts.length - 1].trim()
    if (STATE_TIMEZONE_MAP[state]) {
      return STATE_TIMEZONE_MAP[state]
    }
  }

  // Try state match on full string
  if (STATE_TIMEZONE_MAP[normalized]) {
    return STATE_TIMEZONE_MAP[normalized]
  }

  return null
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
        model: 'anthropic/claude-3.5-haiku',
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

    // Validate it looks like an IANA timezone
    if (/^[A-Z][a-zA-Z_]+\/[A-Za-z_]+/.test(content)) {
      return content
    }

    return null
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
}

/**
 * Resolve the timezone for a lead based on their LinkedIn location
 */
export const resolveTimezone = async (
  params: ResolveTimezoneParams,
): Promise<ResolveTimezoneResult> => {
  const { leadId, organizationId, forceResolve = false } = params

  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // Return cached result unless forcing re-resolution
  if (lead.timezoneResolvedAt && !forceResolve) {
    return {
      timezone: lead.timezone ?? null,
      cached: true,
    }
  }

  // Need a LinkedIn URL to resolve
  if (!lead.linkedInUrl) {
    return {
      timezone: null,
      cached: false,
    }
  }

  let location: string | null = null
  let timezone: string | null = null

  // Step 1: Try Serper to search for LinkedIn URL and extract location
  location = await searchLinkedInWithSerper(lead.linkedInUrl)

  // Step 2: If Serper didn't find location, try Perplexity
  if (!location) {
    location = await extractLocationWithPerplexity(lead.linkedInUrl)
  }

  // Step 3: Map location to timezone
  if (location) {
    // Try static lookup first (fast, no API call)
    timezone = lookupTimezoneFromLocation(location)

    // Fall back to AI mapping for unusual locations
    if (!timezone) {
      timezone = await mapLocationToTimezoneWithAI(location)
    }
  }

  // Save result (even if null - timezoneResolvedAt prevents retries)
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
  }
}

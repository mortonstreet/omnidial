import { SmartQueryFilters, FilterValue } from '@shared/types/src/requests/lead'

// US State mappings for query parsing
const STATE_MAPPINGS: Record<string, string> = {
  california: 'CA',
  ca: 'CA',
  'new york': 'NY',
  ny: 'NY',
  texas: 'TX',
  tx: 'TX',
  florida: 'FL',
  fl: 'FL',
  illinois: 'IL',
  il: 'IL',
  pennsylvania: 'PA',
  pa: 'PA',
  ohio: 'OH',
  oh: 'OH',
  georgia: 'GA',
  ga: 'GA',
  'north carolina': 'NC',
  nc: 'NC',
  michigan: 'MI',
  mi: 'MI',
  'new jersey': 'NJ',
  nj: 'NJ',
  virginia: 'VA',
  va: 'VA',
  washington: 'WA',
  wa: 'WA',
  arizona: 'AZ',
  az: 'AZ',
  massachusetts: 'MA',
  ma: 'MA',
  tennessee: 'TN',
  tn: 'TN',
  indiana: 'IN',
  in: 'IN',
  missouri: 'MO',
  mo: 'MO',
  maryland: 'MD',
  md: 'MD',
  wisconsin: 'WI',
  wi: 'WI',
  colorado: 'CO',
  co: 'CO',
  minnesota: 'MN',
  mn: 'MN',
  'south carolina': 'SC',
  sc: 'SC',
  alabama: 'AL',
  al: 'AL',
  louisiana: 'LA',
  la: 'LA',
  kentucky: 'KY',
  ky: 'KY',
  oregon: 'OR',
  or: 'OR',
  oklahoma: 'OK',
  ok: 'OK',
  connecticut: 'CT',
  ct: 'CT',
  utah: 'UT',
  ut: 'UT',
  iowa: 'IA',
  ia: 'IA',
  nevada: 'NV',
  nv: 'NV',
  arkansas: 'AR',
  ar: 'AR',
  mississippi: 'MS',
  ms: 'MS',
  kansas: 'KS',
  ks: 'KS',
  'new mexico': 'NM',
  nm: 'NM',
  nebraska: 'NE',
  ne: 'NE',
  'west virginia': 'WV',
  wv: 'WV',
  idaho: 'ID',
  id: 'ID',
  hawaii: 'HI',
  hi: 'HI',
  'new hampshire': 'NH',
  nh: 'NH',
  maine: 'ME',
  me: 'ME',
  montana: 'MT',
  mt: 'MT',
  'rhode island': 'RI',
  ri: 'RI',
  delaware: 'DE',
  de: 'DE',
  'south dakota': 'SD',
  sd: 'SD',
  'north dakota': 'ND',
  nd: 'ND',
  alaska: 'AK',
  ak: 'AK',
  vermont: 'VT',
  vt: 'VT',
  wyoming: 'WY',
  wy: 'WY',
}

// Common title patterns
const TITLE_PATTERNS = [
  'VP',
  'Vice President',
  'Director',
  'Manager',
  'CEO',
  'CTO',
  'CFO',
  'COO',
  'CMO',
  'CIO',
  'CISO',
  'President',
  'Executive',
  'Head',
  'Lead',
  'Senior',
  'Principal',
  'Founder',
  'Owner',
  'Partner',
]

export interface ParsedQuery {
  filters: SmartQueryFilters
  humanReadable: string
}

/**
 * Parse a natural language query into structured filters
 */
export const parseSmartQuery = (query: string): ParsedQuery => {
  const filters: SmartQueryFilters = {}
  const conditions: string[] = []
  const lowerQuery = query.toLowerCase()

  // Title patterns - look for common job titles
  for (const title of TITLE_PATTERNS) {
    const titleLower = title.toLowerCase()
    const titleRegex = new RegExp(`\\b${titleLower}s?\\b`, 'i')
    if (titleRegex.test(lowerQuery)) {
      filters.title = { operator: 'contains', value: title }
      conditions.push(`title CONTAINS "${title}"`)
      break // Only match first title
    }
  }

  // State patterns - check for state names or abbreviations
  for (const [name, abbr] of Object.entries(STATE_MAPPINGS)) {
    const stateRegex = new RegExp(
      `\\b(from|in|at)\\s+${name}\\b|\\b${name}\\b`,
      'i',
    )
    if (stateRegex.test(lowerQuery)) {
      // Check customFields for state since Lead model doesn't have state column
      // We'll search company field for state info as a fallback
      filters.company = { operator: 'contains', value: abbr }
      conditions.push(`location CONTAINS "${abbr}"`)
      break
    }
  }

  // Email domain patterns - @domain
  const emailMatch = query.match(/@(\w+(?:\.\w+)?)/i)
  if (emailMatch) {
    filters.email = { operator: 'contains', value: emailMatch[1] }
    conditions.push(`email CONTAINS "@${emailMatch[1]}"`)
  }

  // Company patterns - "at [company]" or "from [company]"
  const companyMatch = query.match(
    /(?:at|from|with)\s+([A-Za-z0-9\s]+?)(?:\s+(?:in|who|that|and)|$)/i,
  )
  if (companyMatch && !filters.company) {
    const companyName = companyMatch[1].trim()
    // Don't match if it's a state name
    if (!STATE_MAPPINGS[companyName.toLowerCase()]) {
      filters.company = { operator: 'contains', value: companyName }
      conditions.push(`company CONTAINS "${companyName}"`)
    }
  }

  // "tech companies" pattern
  if (/\btech\s*compan/i.test(lowerQuery)) {
    if (!filters.company) {
      filters.company = { operator: 'contains', value: 'tech' }
      conditions.push('company CONTAINS "tech"')
    }
  }

  // Date patterns - "this week", "this month", "this year"
  const datePatterns: Array<{
    pattern: RegExp
    getDate: () => Date
    label: string
  }> = [
    {
      pattern: /this\s+week/i,
      getDate: () => {
        const d = new Date()
        d.setDate(d.getDate() - d.getDay())
        d.setHours(0, 0, 0, 0)
        return d
      },
      label: 'this week',
    },
    {
      pattern: /this\s+month/i,
      getDate: () => {
        const d = new Date()
        d.setDate(1)
        d.setHours(0, 0, 0, 0)
        return d
      },
      label: 'this month',
    },
    {
      pattern: /this\s+year/i,
      getDate: () => {
        const d = new Date()
        d.setMonth(0, 1)
        d.setHours(0, 0, 0, 0)
        return d
      },
      label: 'this year',
    },
    {
      pattern: /last\s+(\d+)\s+days?/i,
      getDate: () => {
        const match = lowerQuery.match(/last\s+(\d+)\s+days?/i)
        const days = match ? parseInt(match[1], 10) : 7
        const d = new Date()
        d.setDate(d.getDate() - days)
        d.setHours(0, 0, 0, 0)
        return d
      },
      label: 'recently',
    },
  ]

  for (const { pattern, getDate, label } of datePatterns) {
    if (pattern.test(lowerQuery)) {
      filters.createdAt = { operator: 'gte', value: getDate().toISOString() }
      conditions.push(`created ${label}`)
      break
    }
  }

  // "haven't called" / "not called" / "never called" patterns
  if (
    /haven'?t\s+called|not\s+called|never\s+called|no\s+calls/i.test(lowerQuery)
  ) {
    // This would need a join with call records - mark for frontend handling
    filters._notCalled = { operator: 'eq', value: true }
    conditions.push('no calls made')
  }

  // Generate human-readable interpretation
  const humanReadable =
    conditions.length > 0
      ? conditions.join(' AND ')
      : 'No specific filters detected'

  return { filters, humanReadable }
}

/**
 * Convert smart query filters to repository-compatible filters
 */
export const filtersToRepositoryQuery = (
  filters: SmartQueryFilters,
): {
  search?: string
  titleFilter?: FilterValue
  emailFilter?: FilterValue
  companyFilter?: FilterValue
  createdAtFilter?: FilterValue
} => {
  return {
    titleFilter: filters.title,
    emailFilter: filters.email,
    companyFilter: filters.company,
    createdAtFilter: filters.createdAt,
  }
}

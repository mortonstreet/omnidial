import { validateAndNormalizePhone } from '@/lib/phone'

export interface ParsedCsvLead {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  normalizedPhone: string | null
  company?: string
  title?: string
  linkedInUrl?: string
  website?: string
  customFields: Record<string, string>
}

type CsvMappableField = Exclude<
  keyof ParsedCsvLead,
  'normalizedPhone' | 'customFields'
>

export const FIELD_MAPPINGS: Record<string, CsvMappableField> = {
  first_name: 'firstName',
  firstname: 'firstName',
  'first name': 'firstName',
  first: 'firstName',
  last_name: 'lastName',
  lastname: 'lastName',
  'last name': 'lastName',
  last: 'lastName',
  email: 'email',
  email_address: 'email',
  'email address': 'email',
  'e-mail': 'email',
  phone: 'phone',
  phone_number: 'phone',
  phonenumber: 'phone',
  'phone number': 'phone',
  mobile: 'phone',
  mobile_phone: 'phone',
  'mobile phone': 'phone',
  'mobile international format': 'phone',
  'mobile national format': 'phone',
  cell: 'phone',
  cell_phone: 'phone',
  'cell phone': 'phone',
  cellphone: 'phone',
  telephone: 'phone',
  tel: 'phone',
  work_phone: 'phone',
  'work phone': 'phone',
  direct_phone: 'phone',
  'direct phone': 'phone',
  'direct dial': 'phone',
  direct: 'phone',
  number: 'phone',
  contact_phone: 'phone',
  'contact phone': 'phone',
  company: 'company',
  company_name: 'company',
  'company name': 'company',
  organization: 'company',
  org: 'company',
  employer: 'company',
  title: 'title',
  job_title: 'title',
  jobtitle: 'title',
  'job title': 'title',
  position: 'title',
  role: 'title',
  linkedin: 'linkedInUrl',
  linkedin_url: 'linkedInUrl',
  linked_in_url: 'linkedInUrl',
  linkedinurl: 'linkedInUrl',
  'linkedin url': 'linkedInUrl',
  'linked in url': 'linkedInUrl',
  'linkedin profile': 'linkedInUrl',
  linkedin_profile_url: 'linkedInUrl',
  'linkedin profile url': 'linkedInUrl',
  'person linkedin url': 'linkedInUrl',
  'person linkedin': 'linkedInUrl',
  website: 'website',
  website_url: 'website',
  websiteurl: 'website',
  'website url': 'website',
  domain: 'website',
  company_website: 'website',
  'company website': 'website',
  'company domain': 'website',
  url: 'website',
  site: 'website',
}

const MAPPED_EMPTY_VALUES = new Set([
  'not revealed',
  'not available',
  'n/a',
  'na',
  'none',
  'null',
  'unknown',
  '-',
  '--',
])

export function normalizeHeader(header: string): string {
  return header
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

export function parseCSV(content: string): {
  headers: string[]
  rows: string[][]
} {
  const parsedRows = parseCSVRows(content).filter((row) =>
    row.some((cell) => cell.trim()),
  )

  if (parsedRows.length === 0) {
    return { headers: [], rows: [] }
  }

  const [headers, ...rows] = parsedRows
  return { headers, rows }
}

function parseCSVRows(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < content.length; i++) {
    const char = content[i]
    const nextChar = content[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim())
      current = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      row.push(current.trim())
      rows.push(row)
      row = []
      current = ''
    } else {
      current += char
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current.trim())
    rows.push(row)
  }

  return rows
}

export function mapCsvRowToLead(
  headers: string[],
  row: string[],
  options: { requirePhone: boolean },
):
  | { lead: ParsedCsvLead; error?: undefined }
  | { lead?: undefined; error: string } {
  const lead: Partial<Omit<ParsedCsvLead, 'normalizedPhone' | 'customFields'>> =
    {}
  const customFields: Record<string, string> = {}

  for (let i = 0; i < headers.length && i < row.length; i++) {
    const originalHeader = headers[i]?.trim()
    const normalizedHeader = normalizeHeader(originalHeader)
    const value = row[i]?.trim()

    if (!originalHeader || !value) continue

    const mappedField = FIELD_MAPPINGS[normalizedHeader]
    if (mappedField) {
      const mappedValue = normalizeMappedValue(mappedField, value)
      if (mappedValue && !lead[mappedField]) {
        lead[mappedField] = mappedValue
      }
      continue
    }

    customFields[originalHeader] = value
  }

  if (options.requirePhone && !lead.phone) {
    return { error: 'Missing required phone field' }
  }

  if (!options.requirePhone && !lead.phone && !lead.linkedInUrl) {
    return { error: 'Missing required phone or LinkedIn URL field' }
  }

  let normalizedPhone: string | null = null
  if (lead.phone) {
    normalizedPhone = validateAndNormalizePhone(lead.phone)
    if (!normalizedPhone) {
      if (!options.requirePhone && lead.linkedInUrl) {
        lead.phone = undefined
      } else {
        return { error: `Invalid phone number format: "${lead.phone}"` }
      }
    }
  }

  return {
    lead: {
      ...lead,
      normalizedPhone,
      customFields,
    },
  }
}

function normalizeMappedValue(
  field: CsvMappableField,
  value: string,
): string | undefined {
  const trimmed = value.trim()
  if (!trimmed || MAPPED_EMPTY_VALUES.has(trimmed.toLowerCase())) {
    return undefined
  }

  if (field === 'website') {
    return normalizeWebsite(trimmed)
  }

  return trimmed
}

function normalizeWebsite(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value
  }

  return `https://${value.replace(/^\/+/, '')}`
}

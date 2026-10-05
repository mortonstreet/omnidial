/**
 * One set of cleaning rules for lead data, whatever the source: CSV import,
 * HubSpot import / webhook, the API, and right before pushing to a CRM.
 *
 * Every function is pure and returns the cleaned value plus the problems it
 * found, so callers can keep good data, drop bad data, and report why -
 * instead of storing "N/A" as a company or "1.55E+10" as a phone.
 */
import { validateAndNormalizePhone } from '@/lib/phone'

export interface HygieneIssue {
  field: string
  value: string
  problem:
    | 'placeholder'
    | 'invalid_email'
    | 'invalid_phone'
    | 'excel_scientific_notation'
    | 'invalid_money'
    | 'negative_money'
    | 'invalid_url'
    | 'invalid_linkedin'
    | 'too_long'
    | 'type_mismatch'
}

const PLACEHOLDERS = new Set([
  'n/a',
  'na',
  'n.a.',
  'none',
  'null',
  'nil',
  'undefined',
  'unknown',
  'tbd',
  'tba',
  '-',
  '--',
  '---',
  '.',
  '?',
  '??',
  'x',
  'xx',
  'not revealed',
  'not available',
  'not provided',
  'no data',
  '#n/a',
  '#value!',
  '#ref!',
  '#name?',
  '#div/0!',
  '#null!',
  'blank',
  '(blank)',
  'empty',
])

// Control characters and the replacement char left by bad decoding.
const JUNK_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F�​-‍﻿]/g

export const isPlaceholder = (value: string): boolean =>
  PLACEHOLDERS.has(value.trim().toLowerCase())

/** Trim, collapse whitespace, strip junk characters, drop placeholders. */
export const cleanText = (
  value: unknown,
  field = 'text',
  issues?: HygieneIssue[],
  maxLength = 255,
): string | null => {
  if (value === null || value === undefined) return null
  const raw = String(value)
  const text = raw.replace(JUNK_CHARS, '').replace(/\s+/g, ' ').trim()
  if (!text) return null
  if (isPlaceholder(text)) {
    issues?.push({ field, value: raw, problem: 'placeholder' })
    return null
  }
  if (text.length > maxLength) {
    issues?.push({ field, value: raw.slice(0, 80), problem: 'too_long' })
    return text.slice(0, maxLength).trim()
  }
  return text
}

const EMAIL =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/

export const normalizeEmail = (
  value: unknown,
  issues?: HygieneIssue[],
  field = 'email',
): string | null => {
  const text = cleanText(value, field, issues, 320)
  if (!text) return null
  const email = text
    .replace(/^mailto:/i, '')
    .replace(/^.*<(.+)>\s*$/, '$1') // "Jane Doe <jane@x.com>"
    .replace(/\s+/g, '')
    .replace(/[.,;]+$/, '')
    .toLowerCase()
  if (!EMAIL.test(email)) {
    issues?.push({ field, value: String(value), problem: 'invalid_email' })
    return null
  }
  return email
}

const EXCEL_SCIENTIFIC = /^\d(\.\d+)?e\+\d+$/i
const EXTENSION = /\s*(?:ext\.?|extension|x|#)\s*(\d{1,6})\s*$/i

export interface CleanPhone {
  /** E.164, e.g. +15551234567 */
  e164: string
  extension: string | null
}

export const normalizePhoneValue = (
  value: unknown,
  issues?: HygieneIssue[],
  field = 'phone',
  defaultCountry: 'US' = 'US',
): CleanPhone | null => {
  const text = cleanText(value, field, issues, 64)
  if (!text) return null
  if (EXCEL_SCIENTIFIC.test(text)) {
    // The digits were already lost when the spreadsheet saved it.
    issues?.push({ field, value: text, problem: 'excel_scientific_notation' })
    return null
  }
  const extMatch = text.match(EXTENSION)
  const base = extMatch ? text.slice(0, extMatch.index) : text
  const e164 = validateAndNormalizePhone(base, defaultCountry)
  if (!e164) {
    issues?.push({ field, value: text, problem: 'invalid_phone' })
    return null
  }
  return { e164, extension: extMatch?.[1] ?? null }
}

/**
 * "$12,000", "12k", "USD 1.2M", "€ 9.500,00" -> number. Negative, ambiguous
 * or non-numeric values return null with an issue.
 */
export const parseMoney = (
  value: unknown,
  issues?: HygieneIssue[],
  field = 'dealValue',
): number | null => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null
    if (value < 0) {
      issues?.push({ field, value: String(value), problem: 'negative_money' })
      return null
    }
    return Math.round(value * 100) / 100
  }
  const text = cleanText(value, field, issues, 64)
  if (!text) return null

  let s = text
    .replace(/\b(usd|eur|gbp|cad|aud)\b/gi, '')
    .replace(/[$€£¥\s]/g, '')
  const negative = /^-|^\(.*\)$/.test(s)
  s = s.replace(/[()]/g, '').replace(/^-/, '')

  const suffix = s.match(/([kmb])$/i)?.[1]?.toLowerCase()
  if (suffix) s = s.slice(0, -1)

  // European "9.500,00": comma is the decimal separator.
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else {
    s = s.replace(/,/g, '')
  }

  if (!/^\d+(\.\d+)?$/.test(s)) {
    issues?.push({ field, value: text, problem: 'invalid_money' })
    return null
  }
  if (negative) {
    issues?.push({ field, value: text, problem: 'negative_money' })
    return null
  }
  const multiplier =
    suffix === 'k' ? 1e3 : suffix === 'm' ? 1e6 : suffix === 'b' ? 1e9 : 1
  const amount = Number(s) * multiplier
  if (amount > 9_999_999_999.99) {
    issues?.push({ field, value: text, problem: 'invalid_money' })
    return null
  }
  return Math.round(amount * 100) / 100
}

export const normalizeUrl = (
  value: unknown,
  issues?: HygieneIssue[],
  field = 'website',
): string | null => {
  const text = cleanText(value, field, issues, 2048)
  if (!text) return null
  const withScheme = /^https?:\/\//i.test(text) ? text : `https://${text}`
  try {
    const url = new URL(withScheme)
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname)) throw new Error()
    return url.toString().replace(/\/$/, '')
  } catch {
    issues?.push({ field, value: text, problem: 'invalid_url' })
    return null
  }
}

export const normalizeLinkedInUrl = (
  value: unknown,
  issues?: HygieneIssue[],
  field = 'linkedInUrl',
): string | null => {
  const url = normalizeUrl(value, issues, field)
  if (!url) return null
  const parsed = new URL(url)
  if (!/(^|\.)linkedin\.com$/i.test(parsed.hostname)) {
    issues?.push({ field, value: url, problem: 'invalid_linkedin' })
    return null
  }
  const path = parsed.pathname.replace(/\/+$/, '')
  return `https://www.linkedin.com${path}`
}

export const normalizeCustomFieldKey = (key: string): string =>
  key.replace(JUNK_CHARS, '').replace(/\s+/g, ' ').trim()

export interface CustomFieldDefinition {
  name: string
  label: string
  fieldType: string
}

const toSnake = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')

/**
 * Clean custom fields: normalise keys, drop placeholders, map "Funding Amount"
 * / "funding amount " onto the schema's `funding_amount`, and coerce values to
 * the schema type. Values that don't fit the type are dropped with an issue
 * rather than stored as junk.
 */
export const cleanCustomFields = (
  fields: Record<string, unknown> | null | undefined,
  definitions: CustomFieldDefinition[] = [],
  issues?: HygieneIssue[],
): Record<string, string> => {
  const byKey = new Map<string, CustomFieldDefinition>()
  for (const def of definitions) {
    byKey.set(toSnake(def.name), def)
    byKey.set(toSnake(def.label), def)
  }

  const out: Record<string, string> = {}
  for (const [rawKey, rawValue] of Object.entries(fields ?? {})) {
    const key = normalizeCustomFieldKey(rawKey)
    if (!key) continue
    const def = byKey.get(toSnake(key))
    const field = def?.name ?? key
    const value = coerceCustomValue(
      rawValue,
      def?.fieldType ?? 'text',
      field,
      issues,
    )
    if (value !== null && out[field] === undefined) out[field] = value
  }
  return out
}

const coerceCustomValue = (
  value: unknown,
  fieldType: string,
  field: string,
  issues?: HygieneIssue[],
): string | null => {
  switch (fieldType) {
    case 'number': {
      const text = cleanText(value, field, issues, 64)
      if (!text) return null
      const n =
        parseMoney(text, undefined, field) ??
        (Number.isFinite(Number(text)) ? Number(text) : null)
      if (n === null)
        issues?.push({ field, value: text, problem: 'type_mismatch' })
      return n === null ? null : String(n)
    }
    case 'email':
      return normalizeEmail(value, issues, field)
    case 'phone':
      return normalizePhoneValue(value, issues, field)?.e164 ?? null
    case 'url':
      return normalizeUrl(value, issues, field)
    case 'date': {
      const text = cleanText(value, field, issues, 64)
      if (!text) return null
      const date = new Date(text)
      if (Number.isNaN(date.getTime())) {
        issues?.push({ field, value: text, problem: 'type_mismatch' })
        return null
      }
      return date.toISOString().slice(0, 10)
    }
    default:
      return cleanText(value, field, issues, 2000)
  }
}

export interface LeadFieldsInput {
  firstName?: unknown
  lastName?: unknown
  email?: unknown
  phone?: unknown
  company?: unknown
  title?: unknown
  website?: unknown
  linkedInUrl?: unknown
  dealValue?: unknown
}

export interface CleanLeadFields {
  firstName?: string | null
  lastName?: string | null
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  website?: string | null
  linkedInUrl?: string | null
  dealValue?: number | null
}

/**
 * Clean only the fields present on the input (undefined stays undefined, so
 * partial updates don't blank other fields). Invalid values become null.
 */
export const cleanLeadFields = (
  input: LeadFieldsInput,
  issues: HygieneIssue[] = [],
): CleanLeadFields => {
  const out: CleanLeadFields = {}
  const has = (key: keyof LeadFieldsInput) => input[key] !== undefined

  if (has('firstName'))
    out.firstName = cleanText(input.firstName, 'firstName', issues)
  if (has('lastName'))
    out.lastName = cleanText(input.lastName, 'lastName', issues)
  if (has('company')) out.company = cleanText(input.company, 'company', issues)
  if (has('title')) out.title = cleanText(input.title, 'title', issues)
  if (has('email')) out.email = normalizeEmail(input.email, issues)
  if (has('phone'))
    out.phone = normalizePhoneValue(input.phone, issues)?.e164 ?? null
  if (has('website')) out.website = normalizeUrl(input.website, issues)
  if (has('linkedInUrl'))
    out.linkedInUrl = normalizeLinkedInUrl(input.linkedInUrl, issues)
  if (has('dealValue')) out.dealValue = parseMoney(input.dealValue, issues)
  return out
}

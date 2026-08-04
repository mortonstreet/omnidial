/**
 * Phone number normalization and validation utilities
 *
 * Handles various phone number formats, validates them, and normalizes for consistent storage
 * Uses libphonenumber-js for robust international phone number handling
 */

import {
  parsePhoneNumber,
  isValidPhoneNumber,
  CountryCode,
} from 'libphonenumber-js'

/**
 * Validate and normalize a phone number to E.164 format for storage
 * Returns null if the phone number is invalid
 *
 * Supports:
 * - US/Canada (+1): 10 digits after country code
 * - International: Various formats validated by libphonenumber-js
 *
 * Examples:
 * - "555-123-4567" -> "+15551234567" (valid US)
 * - "(555) 123-4567" -> "+15551234567" (valid US)
 * - "+44 20 7946 0958" -> "+442079460958" (valid UK)
 * - "123" -> null (invalid)
 * - "555-123-456" -> null (invalid - wrong digit count)
 */
export function validateAndNormalizePhone(
  phone: string,
  defaultCountry: CountryCode = 'US',
): string | null {
  if (!phone || typeof phone !== 'string') return null

  const trimmed = phone.trim()
  if (!trimmed) return null

  try {
    // First try parsing with the default country
    if (isValidPhoneNumber(trimmed, defaultCountry)) {
      const parsed = parsePhoneNumber(trimmed, defaultCountry)
      if (parsed) {
        return parsed.format('E.164')
      }
    }

    // Try parsing as international (with explicit country code)
    const intlParsed = parsePhoneNumber(trimmed)
    if (intlParsed?.isValid()) {
      return intlParsed.format('E.164')
    }

    return null
  } catch {
    return null
  }
}

/**
 * Check if a phone number is a valid US 10DLC number
 * (10-digit US number suitable for A2P messaging)
 *
 * Rules:
 * - Must be exactly 10 digits (or 11 with leading 1)
 * - Area code (first 3 digits) can't start with 0 or 1
 * - Exchange (next 3 digits) can't start with 0 or 1
 */
export function isValidUS10DLC(phone: string): boolean {
  if (!phone) return false

  const digitsOnly = phone.replace(/\D/g, '')

  // Handle 11-digit format with leading 1
  let tenDigits = digitsOnly
  if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
    tenDigits = digitsOnly.slice(1)
  }

  if (tenDigits.length !== 10) return false

  const areaCode = tenDigits.slice(0, 3)
  const exchange = tenDigits.slice(3, 6)

  // Area code and exchange can't start with 0 or 1
  if (areaCode[0] === '0' || areaCode[0] === '1') return false
  if (exchange[0] === '0' || exchange[0] === '1') return false

  return true
}

/**
 * Normalize a phone number to a consistent format for comparison
 * Strips all non-digit characters and returns digits only
 *
 * Examples:
 * - "+1 (555) 123-4567" -> "15551234567"
 * - "555-123-4567" -> "5551234567"
 * - "+15551234567" -> "15551234567"
 */
export function normalizePhone(phone: string): string {
  if (!phone) return ''

  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '')

  return digitsOnly
}

/**
 * Normalize to E.164 format (with + prefix and country code)
 * Assumes US (+1) if no country code present
 *
 * Note: For robust validation, use validateAndNormalizePhone() instead.
 * This function is kept for backward compatibility.
 *
 * Examples:
 * - "555-123-4567" -> "+15551234567"
 * - "1-555-123-4567" -> "+15551234567"
 * - "+44 20 7946 0958" -> "+442079460958"
 */
export function normalizeToE164(
  phone: string,
  defaultCountryCode = '1',
): string {
  if (!phone) return ''

  const digitsOnly = phone.replace(/\D/g, '')

  // If already has country code (11+ digits starting with country code)
  if (digitsOnly.length >= 11) {
    return `+${digitsOnly}`
  }

  // If it's a 10-digit US number, add country code
  if (digitsOnly.length === 10) {
    return `+${defaultCountryCode}${digitsOnly}`
  }

  // Return with + prefix for other formats
  return `+${digitsOnly}`
}

/**
 * Check if two phone numbers match (normalized comparison)
 */
export function phoneNumbersMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizePhone(phone1)
  const normalized2 = normalizePhone(phone2)

  if (!normalized1 || !normalized2) return false

  // Direct match
  if (normalized1 === normalized2) return true

  // Handle cases where one has country code and one doesn't
  // e.g., "15551234567" vs "5551234567"
  if (normalized1.length === 11 && normalized2.length === 10) {
    return normalized1.slice(1) === normalized2
  }
  if (normalized2.length === 11 && normalized1.length === 10) {
    return normalized2.slice(1) === normalized1
  }

  return false
}

/**
 * Extract the last N digits from a phone number (useful for loose matching)
 */
export function getLastNDigits(phone: string, n = 10): string {
  const digitsOnly = phone.replace(/\D/g, '')
  return digitsOnly.slice(-n)
}

/**
 * Format a phone number for display
 * Returns formatted string like "(555) 123-4567" for US numbers
 */
export function formatPhoneForDisplay(phone: string): string {
  if (!phone) return ''

  try {
    const parsed = parsePhoneNumber(phone, 'US')
    if (parsed) {
      return parsed.formatNational()
    }
  } catch {
    // Fall through to basic formatting
  }

  // Basic formatting fallback for 10-digit numbers
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }

  return phone
}

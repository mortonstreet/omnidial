import { createHash } from 'crypto'

/**
 * Build a canonical LinkedIn lookup key from any LinkedIn URL variant.
 * Returns `https://www.linkedin.com/in/{username}` (lowercase).
 */
export function buildLinkedInLookupKey(url: string): string {
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i)
  if (match) {
    return `https://www.linkedin.com/in/${match[1].toLowerCase()}`
  }
  return url.toLowerCase()
}

/**
 * Build an identity-based lookup key by hashing name + email + company.
 * Used as fallback when no LinkedIn URL is available.
 */
export function buildIdentityLookupKey(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
  company?: string | null,
): string | null {
  const parts = [firstName, lastName, email, company]
    .filter(Boolean)
    .map((s) => s!.toLowerCase().trim())

  if (parts.length < 2) return null

  const input = parts.join('|')
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Company-domain helpers for matching email threads to a lead when we only
 * know their name. Free mailbox domains never count as a company domain.
 */

const FREE_MAIL = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'ymail.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'zoho.com',
  'yandex.com',
  'mail.com',
  'comcast.net',
])

const host = (value: string) => {
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    )
    return url.hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** The lead's company domain from a work email, else from the website. */
export const companyDomain = (lead: {
  email?: string | null
  website?: string | null
}): string | null => {
  const fromEmail = lead.email?.split('@')[1]?.trim().toLowerCase()
  if (fromEmail && !FREE_MAIL.has(fromEmail)) return fromEmail
  const fromSite = lead.website ? host(lead.website) : null
  return fromSite && !FREE_MAIL.has(fromSite) ? fromSite : null
}

/** True when any address belongs to the domain or one of its subdomains. */
export const anyAddressOnDomain = (
  addresses: string[],
  domain: string,
): boolean =>
  addresses.some((address) => {
    const d = address.split('@')[1]?.toLowerCase()
    return !!d && (d === domain || d.endsWith(`.${domain}`))
  })

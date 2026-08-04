const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "aol.com",
  "icloud.com",
  "me.com",
  "msn.com",
  "live.com",
  "protonmail.com",
  "proton.me",
  "gmx.com",
  "mail.com",
  "yandex.com",
  "zoho.com",
]);

/**
 * Best-effort company domain for a lead. Prefers an explicit website; falls
 * back to the email domain, but never for consumer mailboxes — a gmail.com
 * logo on a lead is worse than no logo at all.
 */
export function resolveCompanyDomain(input: {
  website?: string | null;
  email?: string | null;
}): string | null {
  const { website, email } = input;

  if (website) {
    const trimmed = website.trim();
    if (trimmed) {
      try {
        const withProtocol = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        const host = new URL(withProtocol).hostname.toLowerCase();
        return host.replace(/^www\./, "");
      } catch {
        // fall through to email
      }
    }
  }

  if (email) {
    const at = email.lastIndexOf("@");
    if (at > 0) {
      const host = email.slice(at + 1).trim().toLowerCase();
      if (host && !FREE_EMAIL_DOMAINS.has(host)) {
        return host;
      }
    }
  }

  return null;
}

/**
 * logo.dev image URL. Returns null when unconfigured so callers render their
 * fallback rather than a broken request.
 */
export function buildLogoUrl(domain: string, size = 64): string | null {
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  if (!token) return null;

  const params = new URLSearchParams({
    token,
    size: String(size),
    format: "png",
    retina: "true",
  });
  return `https://img.logo.dev/${encodeURIComponent(domain)}?${params.toString()}`;
}

/** Initials shown when no logo is available. */
export function companyInitials(name?: string | null): string {
  if (!name) return "?";
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

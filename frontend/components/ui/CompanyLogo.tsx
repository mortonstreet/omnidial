"use client";

import { useState } from "react";
import { buildLogoUrl, companyInitials, resolveCompanyDomain } from "@/lib/logo";
import { cn } from "@/lib/utils";

interface CompanyLogoProps {
  company?: string | null;
  website?: string | null;
  email?: string | null;
  size?: number;
  className?: string;
}

/**
 * Company logo via logo.dev, falling back to initials.
 *
 * logo.dev returns a placeholder rather than a 404 for unknown domains, so we
 * also treat load errors as "no logo" and show initials — a wrong logo on a
 * lead is worse than none.
 */
export function CompanyLogo({
  company,
  website,
  email,
  size = 32,
  className,
}: CompanyLogoProps) {
  const [failed, setFailed] = useState(false);

  const domain = resolveCompanyDomain({ website, email });
  const src = domain ? buildLogoUrl(domain, size * 2) : null;

  const dimension = { width: size, height: size };

  if (!src || failed) {
    return (
      <div
        style={dimension}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground font-medium",
          className,
        )}
        aria-hidden="true"
      >
        <span style={{ fontSize: Math.max(10, size * 0.36) }}>
          {companyInitials(company)}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={company ? `${company} logo` : "Company logo"}
      style={dimension}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(
        "shrink-0 rounded-md bg-muted object-contain",
        className,
      )}
    />
  );
}

export default CompanyLogo;

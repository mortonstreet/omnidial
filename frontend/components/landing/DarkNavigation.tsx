"use client";

import Link from "next/link";
import OmniDialLogo from "@/components/landing/OmniDialLogo";
import { BOOKING_URL, getSignInUrl } from "@/lib/marketing-links";

/**
 * Marketing navigation. The Products / Company / Pricing mega-menus were
 * removed along with the pages behind them — the site is a hero and a footer,
 * and dropdowns pointing at routes that no longer exist are worse than none.
 * Buttons intentionally match the hero pair.
 */
export default function DarkNavigation() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-[#0a0a0a]">
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center">
            <OmniDialLogo size={32} showText textSize="md" />
          </Link>

          <div className="flex items-center gap-2.5">
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg px-4 py-2 text-sm font-semibold text-black transition-transform duration-200 hover:scale-[1.02]
                         bg-[linear-gradient(110deg,#ffffff_0%,#cfcace_45%,#ffffff_100%)]"
            >
              Request access
            </a>

            <a
              href={getSignInUrl()}
              className="rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10
                         bg-[linear-gradient(110deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.14)_100%)]"
            >
              Sign in
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}

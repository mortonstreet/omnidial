import Link from "next/link";
import type { Metadata } from "next";
import DarkNavigation from "@/components/landing/DarkNavigation";
import OmniDialFooter from "@/components/landing/OmniDialFooter";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";
import { BOOKING_URL, getSignInUrl } from "@/lib/marketing-links";

export const metadata: Metadata = {
  title: "OmniDial | Sales Dialer Built for Closers",
  description:
    "Parallel dialing, local presence, and live coaching in one place. Reach more prospects without burning your numbers.",
};

/**
 * Marketing page: hero and footer only.
 *
 * DarkFeaturesGrid and DarkFooter are deliberately not used — DarkFooter also
 * renders a "More calls. More connects." headline and a four-column link farm,
 * which collided with the hero.
 */
export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0a] text-white">
      <DarkNavigation />

      <main className="flex flex-1 items-center justify-center px-6 pt-32 pb-24">
        <div className="flex w-full max-w-3xl flex-col items-center text-center">
          {/* Continuously rotating mark */}
          <Logo3DSpinner size={160} className="mb-12" />

          <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            The sales dialer built for closers
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-white/55 sm:text-lg">
            Parallel dialing, local presence, and live coaching in one place.
            Reach more prospects without burning your numbers.
          </p>

          <div className="mt-12 flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            {/* Invite-only: the primary path is a call, not a signup form */}
            <a
              href={BOOKING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full rounded-xl px-7 py-3.5 text-center text-sm font-semibold text-black
                         bg-[linear-gradient(110deg,#ffffff_0%,#cfcace_45%,#ffffff_100%)]
                         shadow-[0_0_40px_-12px_rgba(255,255,255,0.45)]
                         transition-transform duration-200 hover:scale-[1.02] sm:w-auto"
            >
              Request access
            </a>

            <a
              href={getSignInUrl()}
              className="w-full rounded-xl border border-white/15 px-7 py-3.5 text-center text-sm font-semibold text-white
                         bg-[linear-gradient(110deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.05)_50%,rgba(255,255,255,0.14)_100%)]
                         backdrop-blur-sm transition-colors duration-200
                         hover:border-white/30 hover:bg-white/10 sm:w-auto"
            >
              Sign in
            </a>
          </div>

          <p className="mt-6 text-xs text-white/30">
            OmniDial is invite only. Sign in is for approved accounts.
          </p>
        </div>
      </main>

      <OmniDialFooter />
    </div>
  );
}

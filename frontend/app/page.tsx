import Link from "next/link";
import type { Metadata } from "next";
import DarkNavigation from "@/components/landing/DarkNavigation";
import DarkFooter from "@/components/landing/DarkFooter";
import DarkFeaturesGrid from "@/components/landing/DarkFeaturesGrid";
import HeroBackgroundAnimation from "@/components/landing/HeroBackgroundAnimation";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";

export const metadata: Metadata = {
  title: "OmniDial | Sales Dialer Built for Closers",
  description:
    "Parallel dialing, local presence, and live coaching in one place. Reach more prospects without burning your numbers.",
};

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <DarkNavigation />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-24">
          <HeroBackgroundAnimation />

          <div className="relative z-10 max-w-7xl mx-auto px-6">
            <div className="flex flex-col items-center text-center">
              {/* Continuously rotating mark */}
              <div className="mb-10">
                <Logo3DSpinner size={168} />
              </div>

              <h1 className="font-display font-semibold tracking-tight text-4xl sm:text-5xl lg:text-6xl max-w-4xl">
                The sales dialer built for closers
              </h1>

              <p className="mt-6 text-base sm:text-lg text-white/60 max-w-2xl leading-relaxed">
                Parallel dialing, local presence, and live coaching in one
                place. Reach more prospects without burning your numbers.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
                <Link href="/signup" className="w-full sm:w-auto">
                  <span
                    className="block rounded-xl px-7 py-3.5 text-sm font-semibold text-black text-center
                               bg-[linear-gradient(110deg,#ffffff_0%,#cfcace_45%,#ffffff_100%)]
                               shadow-[0_0_40px_-12px_rgba(255,255,255,0.5)]
                               transition-transform duration-200 hover:scale-[1.02]"
                  >
                    Request access
                  </span>
                </Link>

                <Link href="/login" className="w-full sm:w-auto">
                  <span
                    className="block rounded-xl px-7 py-3.5 text-sm font-semibold text-white text-center
                               bg-[linear-gradient(110deg,rgba(255,255,255,0.14)_0%,rgba(255,255,255,0.06)_50%,rgba(255,255,255,0.14)_100%)]
                               border border-white/15 backdrop-blur-sm
                               transition-colors duration-200 hover:border-white/30 hover:bg-white/10"
                  >
                    Log in
                  </span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <DarkFeaturesGrid />
      </main>

      <DarkFooter />
    </div>
  );
}

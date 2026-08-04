"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import DarkScrollReveal from "@/components/landing/DarkScrollReveal";
import DarkDialerIcon from "@/components/landing/DarkDialerIcon";

interface FeaturePageCTAProps {
  headline?: string;
  description?: string;
}

export default function FeaturePageCTA({
  headline = "Ready to dial smarter?",
  description = "Join the waitlist and be first to experience the future of sales dialing.",
}: FeaturePageCTAProps) {
  return (
    <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden">
      {/* Subtle radial gradient */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse at 50% 100%, rgba(59, 130, 246, 0.2) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 text-center">
        <DarkScrollReveal>
          <div className="flex justify-center mb-6 sm:mb-8">
            <DarkDialerIcon />
          </div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl mb-4 sm:mb-6 leading-tight text-white heading-display">
            {headline}
          </h2>
          <p className="text-white/50 text-base sm:text-lg mb-8 sm:mb-10 max-w-xl mx-auto">
            {description}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link href="/waitlist">
              <Button className="w-full sm:w-auto bg-white text-black hover:bg-white/90 rounded-xl px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium h-12 sm:h-14">
                Join the waitlist
              </Button>
            </Link>
            <a
              href="https://cal.com/mortonstreet/15min"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button
                variant="outline"
                className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 rounded-xl px-6 sm:px-8 py-3 sm:py-4 text-sm sm:text-base font-medium h-12 sm:h-14"
              >
                Talk to us
              </Button>
            </a>
          </div>
        </DarkScrollReveal>
      </div>
    </section>
  );
}

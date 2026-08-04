"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";

interface FeaturePageHeroProps {
  badge: string;
  headline: string;
  description: string;
  icon: LucideIcon;
}

export default function FeaturePageHero({
  badge,
  headline,
  description,
  icon: Icon,
}: FeaturePageHeroProps) {
  return (
    <section className="relative min-h-[60vh] flex items-center overflow-hidden pt-24 pb-12">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 w-full">
        <div className="text-center">
          {/* Badge */}
          <div className="flex justify-center mb-6 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <Icon className="w-4 h-4 text-white" aria-hidden="true" />
              <span className="text-sm font-medium text-white/80">{badge}</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white mb-6 animate-fade-in-up tracking-tight heading-display">
            {headline}
          </h1>

          {/* Description */}
          <p className="text-lg sm:text-xl text-white/50 mb-10 max-w-2xl mx-auto animate-fade-in-up-delay-1">
            {description}
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 animate-fade-in-up-delay-2">
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
                Book a demo
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

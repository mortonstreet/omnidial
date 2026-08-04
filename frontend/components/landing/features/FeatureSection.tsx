"use client";

import { ReactNode } from "react";
import DarkScrollReveal from "@/components/landing/DarkScrollReveal";

interface FeatureSectionProps {
  title: string;
  description: string;
  demo: ReactNode;
  reversed?: boolean;
  delay?: number;
}

export default function FeatureSection({
  title,
  description,
  demo,
  reversed = false,
  delay = 0,
}: FeatureSectionProps) {
  return (
    <section className="py-16 sm:py-20 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <DarkScrollReveal delay={delay}>
          <div
            className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
              reversed ? "lg:flex-row-reverse" : ""
            }`}
          >
            {/* Text content */}
            <div className={reversed ? "lg:order-2" : ""}>
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
                {title}
              </h2>
              <p className="text-base sm:text-lg text-white/50 leading-relaxed max-w-lg">
                {description}
              </p>
            </div>

            {/* Demo visualization */}
            <div
              className={`${reversed ? "lg:order-1" : ""}`}
              role="img"
              aria-label={title}
            >
              <div className="bg-[#111111] border border-white/10 rounded-2xl p-6 sm:p-8">
                {demo}
              </div>
            </div>
          </div>
        </DarkScrollReveal>
      </div>
    </section>
  );
}

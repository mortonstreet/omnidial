"use client";

import { LucideIcon } from "lucide-react";
import DarkScrollReveal from "@/components/landing/DarkScrollReveal";

interface Feature {
  title: string;
  description: string;
  icon: LucideIcon;
}

interface FeaturesGridProps {
  title?: string;
  subtitle?: string;
  features: Feature[];
}

export default function FeaturesGrid({
  title = "Key capabilities",
  subtitle,
  features,
}: FeaturesGridProps) {
  return (
    <section className="py-16 sm:py-20 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <DarkScrollReveal>
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-white mb-4 tracking-tight">
              {title}
            </h2>
            {subtitle && (
              <p className="text-base sm:text-lg text-white/50 max-w-2xl mx-auto">
                {subtitle}
              </p>
            )}
          </div>
        </DarkScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <DarkScrollReveal key={index} delay={index * 100}>
              <div className="bg-[#111111] border border-white/5 rounded-xl p-6 hover:border-white/10 transition-colors group">
                <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center mb-4 group-hover:bg-white/10 transition-colors">
                  <feature.icon
                    className="w-6 h-6 text-white/60"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            </DarkScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}

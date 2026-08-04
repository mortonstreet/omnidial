"use client";

import DarkScrollReveal from "@/components/landing/DarkScrollReveal";

interface Stat {
  value: string;
  label: string;
}

interface StatsRowProps {
  stats: Stat[];
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <section className="py-12 sm:py-16 border-y border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <DarkScrollReveal>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white mb-2 tabular-nums">
                  {stat.value}
                </div>
                <div className="text-sm sm:text-base text-white/40">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </DarkScrollReveal>
      </div>
    </section>
  );
}

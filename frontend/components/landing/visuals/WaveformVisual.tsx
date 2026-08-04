"use client";

import { useEffect, useState } from "react";

export function WaveformVisual() {
  const [phase, setPhase] = useState(0);
  const barCount = 12;

  useEffect(() => {
    const interval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 360);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // Generate smooth wave pattern
  const getBarHeight = (index: number) => {
    const offset = (index / barCount) * Math.PI * 2;
    const wave1 = Math.sin((phase * Math.PI) / 180 + offset) * 25;
    const wave2 = Math.sin((phase * Math.PI) / 90 + offset * 1.5) * 15;
    return 45 + wave1 + wave2;
  };

  return (
    <div className="flex items-center justify-center gap-0.5 h-8">
      {Array.from({ length: barCount }).map((_, i) => (
        <div
          key={i}
          className="w-1 bg-foreground/40 rounded-full transition-[height] duration-100 ease-out"
          style={{ height: `${getBarHeight(i)}%` }}
        />
      ))}
    </div>
  );
}

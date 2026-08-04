"use client";

import { useEffect, useState } from "react";

export function SequenceDotsVisual() {
  const [activeIndex, setActiveIndex] = useState(0);
  const dots = 5;

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % dots);
    }, 600);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3">
      {Array.from({ length: dots }).map((_, i) => (
        <div
          key={i}
          className={`w-3 h-3 rounded-full transition-all duration-300 ${
            i === activeIndex
              ? "bg-foreground scale-125"
              : i < activeIndex
              ? "bg-foreground/60"
              : "bg-foreground/20"
          }`}
        />
      ))}
    </div>
  );
}

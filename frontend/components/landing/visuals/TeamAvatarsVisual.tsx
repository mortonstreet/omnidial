"use client";

import { useEffect, useState } from "react";

export function TeamAvatarsVisual() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % 3);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const initials = ["JD", "MK", "AS"];

  return (
    <div className="flex items-center justify-center">
      <div className="flex -space-x-2">
        {initials.map((init, i) => (
          <div
            key={init}
            className={`w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-semibold transition-all duration-500 ${
              activeIndex === i
                ? "bg-foreground/20 text-foreground scale-110 z-10"
                : "bg-muted text-foreground/50"
            }`}
            style={{
              zIndex: activeIndex === i ? 10 : initials.length - i,
            }}
          >
            {init}
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

export function PipelineVisual() {
  const [cardPosition, setCardPosition] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCardPosition((prev) => (prev + 1) % 3);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-2 justify-center">
      {[0, 1, 2].map((col) => (
        <div
          key={col}
          className="w-8 h-14 rounded border border-foreground/20 p-1 flex flex-col gap-1"
        >
          <div
            className={`w-full h-3 rounded-sm transition-all duration-500 ${
              cardPosition === col ? "bg-foreground/60" : "bg-foreground/10"
            }`}
          />
          <div className="w-full h-2 rounded-sm bg-foreground/10" />
        </div>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState, useRef } from "react";

export function MiniChartVisual() {
  const [heights, setHeights] = useState<number[]>([0, 0, 0, 0, 0]);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const targetHeights = [40, 65, 45, 80, 55];

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          // Stagger the animation of each bar
          targetHeights.forEach((height, i) => {
            setTimeout(() => {
              setHeights((prev) => {
                const next = [...prev];
                next[i] = height;
                return next;
              });
            }, i * 100);
          });
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="flex items-end justify-center gap-1.5 h-12">
      {heights.map((height, i) => (
        <div
          key={i}
          className="w-3 bg-foreground/40 rounded-t transition-all duration-500 ease-out"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

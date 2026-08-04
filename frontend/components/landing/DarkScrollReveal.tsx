"use client";

import { useEffect, useRef, useState, ReactNode } from "react";

interface DarkScrollRevealProps {
  children: ReactNode;
  delay?: number;
  threshold?: number;
  className?: string;
}

export default function DarkScrollReveal({
  children,
  delay = 0,
  threshold = 0.1,
  className = "",
}: DarkScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

  useEffect(() => {
    // Check if mobile/tablet (under 1024px) - disable animations on these devices
    const checkMobile = () => {
      setIsMobileOrTablet(window.innerWidth < 1024);
    };

    checkMobile();
    // No resize listener needed - we only check on mount to avoid animation mid-session
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // On mobile/tablet or reduced motion, skip animation - show content immediately
    if (prefersReducedMotion || isMobileOrTablet) {
      element.classList.add("visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Apply delay before adding visible class
          setTimeout(() => {
            element.classList.add("visible");
          }, delay);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [delay, threshold, isMobileOrTablet]);

  // On mobile/tablet, don't use scroll-reveal class at all to avoid any flash
  if (isMobileOrTablet) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <div ref={ref} className={`scroll-reveal ${className}`}>
      {children}
    </div>
  );
}

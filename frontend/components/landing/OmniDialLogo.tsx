"use client";

import { useState } from "react";

interface OmniDialLogoProps {
  size?: number;
  animated?: boolean;
  showText?: boolean;
  textSize?: "sm" | "md" | "lg";
  className?: string;
}

export default function OmniDialLogo({
  size = 40,
  animated: _animated = true,
  showText = false,
  textSize = "md",
  className = "",
}: OmniDialLogoProps) {
  const [isHovered, setIsHovered] = useState(false);

  const textSizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  return (
    <div
      className={`flex items-center gap-2 ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className="relative flex items-center justify-center transition-all duration-300"
        style={{
          width: size,
          height: size,
          transform: isHovered ? "scale(1.05)" : "scale(1)",
        }}
      >
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          className="transition-all duration-300"
          style={{
            filter: isHovered
              ? "drop-shadow(0 0 5px rgba(255,255,255,0.45))"
              : "none",
          }}
        >
          <defs>
            <linearGradient
              id="od-mark-anim"
              x1="4"
              y1="3"
              x2="20"
              y2="21"
              gradientUnits="userSpaceOnUse"
            >
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="0.5" stopColor="#b9b3b7" />
              <stop offset="1" stopColor="#ffffff" />
            </linearGradient>
          </defs>
          {/* Thick twisted ring — the seams sit where the profile turns */}
          <circle
            cx="12"
            cy="12"
            r="7.4"
            stroke="url(#od-mark-anim)"
            strokeWidth="5"
            fill="none"
          />
          <path d="M12 4.6 V7.2" stroke="#0a0a0a" strokeOpacity="0.5" strokeWidth="1.1" />
          <path d="M19.4 12 H16.8" stroke="#0a0a0a" strokeOpacity="0.35" strokeWidth="1.1" />
          <path d="M12 19.4 V16.8" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="1.1" />
        </svg>
      </div>

      {showText && (
        <span
          className={`font-medium tracking-tight text-white ${textSizeClasses[textSize]}`}
        >
          OmniDial
        </span>
      )}
    </div>
  );
}

// Export a simple static version for non-interactive contexts
export function OmniDialLogoStatic({
  size = 40,
  className = "",
  color = "white",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Solid-colour variant: callers pass an explicit colour, so no gradient */}
        <circle cx="12" cy="12" r="7.4" stroke={color} strokeWidth="5" fill="none"/>
        <path d="M12 4.6 V7.2" stroke="#0a0a0a" strokeOpacity="0.45" strokeWidth="1.1"/>
        <path d="M12 19.4 V16.8" stroke="#0a0a0a" strokeOpacity="0.25" strokeWidth="1.1"/>
      </svg>
    </div>
  );
}

// Minimal icon version for compact spaces
export function OmniDialIcon({
  size = 24,
  className = "",
  color = "white",
}: {
  size?: number;
  className?: string;
  color?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
      >
        {/* Compact: seams dropped, they turn to mush below ~20px */}
        <circle cx="12" cy="12" r="7.4" stroke={color} strokeWidth="5" fill="none"/>
      </svg>
    </div>
  );
}

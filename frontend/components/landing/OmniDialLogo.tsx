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
        >
          <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2.5" fill="none"
            className="transition-all duration-300"
            style={{
              filter: isHovered ? "drop-shadow(0 0 4px rgba(255,255,255,0.5))" : "none",
            }}
          />
          <circle cx="17" cy="7" r="2.5" fill="white"
            className="transition-all duration-300"
            style={{
              filter: isHovered ? "drop-shadow(0 0 4px rgba(255,255,255,0.5))" : "none",
            }}
          />
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
        <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="2.5" fill="none"/>
        <circle cx="17" cy="7" r="2.5" fill={color}/>
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
        <circle cx="12" cy="12" r="7" stroke={color} strokeWidth="2.5" fill="none"/>
        <circle cx="17" cy="7" r="2.5" fill={color}/>
      </svg>
    </div>
  );
}

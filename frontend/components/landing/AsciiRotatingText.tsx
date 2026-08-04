"use client";

import { useEffect, useState, useCallback } from "react";

// Static front-facing OMNIDIAL - 3D shadow block style (matches backend)
const OMNIDIAL_STATIC = `
  ██████╗ ████████╗███╗   ███╗    ██████╗ ██╗ █████╗ ██╗     ███████╗██████╗
 ██╔════╝ ╚══██╔══╝████╗ ████║    ██╔══██╗██║██╔══██╗██║     ██╔════╝██╔══██╗
 ██║  ███╗   ██║   ██╔████╔██║    ██║  ██║██║███████║██║     █████╗  ██████╔╝
 ██║   ██║   ██║   ██║╚██╔╝██║    ██║  ██║██║██╔══██║██║     ██╔══╝  ██╔══██╗
 ╚██████╔╝   ██║   ██║ ╚═╝ ██║    ██████╔╝██║██║  ██║███████╗███████╗██║  ██║
  ╚═════╝    ╚═╝   ╚═╝     ╚═╝    ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
`.trim();

// Glitch frames - corrupted/distorted versions
const GLITCH_FRAMES = [
  `
  ▓▓▓▓▓▓╗ ████████╗███╗   ███╗    ██████╗ ██╗ █████╗ ██╗     ███████╗██████╗
 ▓▓╔════╝ ╚══██╔══╝████╗ ████║    ██╔══██╗██║██╔══██╗██║     ██╔════╝██╔══██╗
 ▓▓║  ███╗   ██║   ██╔████╔██║    ██║  ██║██║███████║██║     █████╗  ██████╔╝
 ▓▓║   ██║   ██║   ██║╚██╔╝██║    ██║  ██║██║██╔══██║██║     ██╔══╝  ██╔══██╗
 ╚▓▓▓▓▓▓╔╝   ██║   ██║ ╚═╝ ██║    ██████╔╝██║██║  ██║███████╗███████╗██║  ██║
  ╚═════╝    ╚═╝   ╚═╝     ╚═╝    ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
`.trim(),
  `
  ██████╗ ████████╗███╗   ███╗    ░░░░░░╗ ██╗ █████╗ ██╗     ░░░░░░░╗██████╗
 ██╔════╝ ╚══██╔══╝████╗ ████║    ░░╔══██╗██║██╔══██╗██║     ░░╔════╝██╔══██╗
 ██║  ███╗   ██║   ██╔████╔██║    ░░║  ██║██║███████║██║     ░░░░░╗  ██████╔╝
 ██║   ██║   ██║   ██║╚██╔╝██║    ░░║  ██║██║██╔══██║██║     ░░╔══╝  ██╔══██╗
 ╚██████╔╝   ██║   ██║ ╚═╝ ██║    ░░░░░░╔╝██║██║  ██║███████╗░░░░░░░╗██║  ██║
  ╚═════╝    ╚═╝   ╚═╝     ╚═╝    ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
`.trim(),
  `
  ▒▒▒▒▒▒╗ ▒▒▒▒▒▒▒▒╗▒▒▒╗   ▒▒▒╗    ▒▒▒▒▒▒╗ ▒▒╗ ▒▒▒▒▒╗ ▒▒╗     ▒▒▒▒▒▒▒╗▒▒▒▒▒▒╗
 ▒▒╔════╝ ╚══▒▒╔══╝▒▒▒▒╗ ▒▒▒▒║    ▒▒╔══▒▒╗▒▒║▒▒╔══▒▒╗▒▒║     ▒▒╔════╝▒▒╔══▒▒╗
 ▒▒║  ▒▒▒╗   ▒▒║   ▒▒╔▒▒▒▒╔▒▒║    ▒▒║  ▒▒║▒▒║▒▒▒▒▒▒▒║▒▒║     ▒▒▒▒▒╗  ▒▒▒▒▒▒╔╝
 ▒▒║   ▒▒║   ▒▒║   ▒▒║╚▒▒╔╝▒▒║    ▒▒║  ▒▒║▒▒║▒▒╔══▒▒║▒▒║     ▒▒╔══╝  ▒▒╔══▒▒╗
 ╚▒▒▒▒▒▒╔╝   ▒▒║   ▒▒║ ╚═╝ ▒▒║    ▒▒▒▒▒▒╔╝▒▒║▒▒║  ▒▒║▒▒▒▒▒▒▒╗▒▒▒▒▒▒▒╗▒▒║  ▒▒║
  ╚═════╝    ╚═╝   ╚═╝     ╚═╝    ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
`.trim(),
  `
  ██████╗ ░░░░░░░░╗███╗   ███╗    ██████╗ ██╗ █████╗ ██╗     ███████╗██████╗
 ██╔════╝ ╚══░░╔══╝████╗ ████║    ██╔══██╗██║██╔══██╗██║     ██╔════╝██╔══██╗
 ██║  ███╗   ░░║   ██╔████╔██║    ██║  ██║██║░░░░░░░║██║     █████╗  ██████╔╝
 ██║   ██║   ░░║   ██║╚██╔╝██║    ██║  ██║██║██╔══██║░░║     ██╔══╝  ██╔══██╗
 ╚██████╔╝   ░░║   ██║ ╚═╝ ██║    ██████╔╝░░║██║  ██║███████╗███████╗██║  ██║
  ╚═════╝    ╚═╝   ╚═╝     ╚═╝    ╚═════╝ ╚═╝╚═╝  ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝
`.trim(),
];

export interface AsciiRotatingTextProps {
  className?: string;
  /** Scale factor for the text size */
  scale?: "nav" | "xs" | "sm" | "md" | "lg" | "xl";
  /** Interval between glitches in ms (default: 4000) */
  glitchInterval?: number;
}

const scaleClasses = {
  nav: "text-[6px] leading-[1.15]",
  xs: "text-[7px] leading-[1.15]",
  sm: "text-[8px] leading-[1.15]",
  md: "text-[10px] leading-[1.15]",
  lg: "text-xs leading-[1.15]",
  xl: "text-sm leading-[1.15]",
};

export function AsciiRotatingText({
  className = "",
  scale = "md",
  glitchInterval = 4000,
}: AsciiRotatingTextProps) {
  const [currentFrame, setCurrentFrame] = useState(OMNIDIAL_STATIC);
  const [isGlitching, setIsGlitching] = useState(false);

  const triggerGlitch = useCallback(() => {
    setIsGlitching(true);

    // Rapid glitch sequence
    const glitchSequence = [
      { frame: GLITCH_FRAMES[Math.floor(Math.random() * GLITCH_FRAMES.length)], delay: 0 },
      { frame: GLITCH_FRAMES[Math.floor(Math.random() * GLITCH_FRAMES.length)], delay: 50 },
      { frame: OMNIDIAL_STATIC, delay: 100 },
      { frame: GLITCH_FRAMES[Math.floor(Math.random() * GLITCH_FRAMES.length)], delay: 150 },
      { frame: OMNIDIAL_STATIC, delay: 200 },
    ];

    glitchSequence.forEach(({ frame, delay }) => {
      setTimeout(() => setCurrentFrame(frame), delay);
    });

    setTimeout(() => {
      setCurrentFrame(OMNIDIAL_STATIC);
      setIsGlitching(false);
    }, 250);
  }, []);

  useEffect(() => {
    // Initial delay before first glitch
    const initialDelay = setTimeout(() => {
      triggerGlitch();
    }, glitchInterval / 2);

    // Regular glitch interval
    const interval = setInterval(() => {
      triggerGlitch();
    }, glitchInterval);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [glitchInterval, triggerGlitch]);

  return (
    <div className={`ascii-rotating-text ${className}`}>
      <pre
        className={`font-mono select-none whitespace-pre transition-opacity duration-75 ${scaleClasses[scale]} ${isGlitching ? "opacity-90" : ""}`}
        style={{ color: "currentColor" }}
        aria-label="OmniDial"
      >
        {currentFrame}
      </pre>
    </div>
  );
}

export default AsciiRotatingText;

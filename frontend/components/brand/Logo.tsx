"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { LogoFull } from "./LogoFull";
import { LogoIcon } from "./LogoIcon";

interface LogoProps {
  /**
   * Force collapsed state (icon only) - used by sidebar
   */
  collapsed?: boolean;
  /**
   * Enable scroll-based collapse - used by marketing site header
   * When true, collapses to icon after scrolling past threshold
   */
  scrollCollapse?: boolean;
  /**
   * Scroll threshold in pixels before collapsing (default: 50)
   */
  scrollThreshold?: number;
  /**
   * Additional class name for the container
   */
  className?: string;
  /**
   * Class name for the full logo SVG
   */
  fullClassName?: string;
  /**
   * Class name for the icon-only SVG
   */
  iconClassName?: string;
  /**
   * Variant for different use cases
   * - "auto": Show full on desktop, icon on mobile (default)
   * - "full": Always show full wordmark
   * - "icon": Always show icon only
   */
  variant?: "auto" | "full" | "icon";
}

/**
 * Smart logo component that handles responsive behavior:
 * - Sidebar collapse state
 * - Mobile breakpoint (auto-collapses on small screens)
 * - Scroll-based collapse for marketing headers
 */
export function Logo({
  collapsed = false,
  scrollCollapse = false,
  scrollThreshold = 50,
  className,
  fullClassName,
  iconClassName,
  variant = "auto",
}: LogoProps) {
  const [hasScrolled, setHasScrolled] = useState(false);

  // Handle scroll-based collapse
  useEffect(() => {
    if (!scrollCollapse) return;

    const handleScroll = () => {
      setHasScrolled(window.scrollY > scrollThreshold);
    };

    // Check initial scroll position
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [scrollCollapse, scrollThreshold]);

  // Determine if we should show collapsed state
  const isCollapsed = collapsed || (scrollCollapse && hasScrolled);

  // For "full" variant, always show full logo
  if (variant === "full") {
    return (
      <div className={cn("flex items-center", className)}>
        <LogoFull className={fullClassName} />
      </div>
    );
  }

  // For "icon" variant, always show icon only
  if (variant === "icon") {
    return (
      <div className={cn("flex items-center", className)}>
        <LogoIcon className={iconClassName} />
      </div>
    );
  }

  // Auto variant: responsive with state-based transitions
  return (
    <div className={cn("relative flex items-center", className)}>
      {/* Full logo - hidden on mobile, visible on desktop when not collapsed */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out overflow-hidden",
          // Mobile: always hidden (show icon instead)
          "hidden md:block",
          // Desktop: animate based on collapsed state
          isCollapsed
            ? "opacity-0 max-w-0"
            : "opacity-100 max-w-[200px]"
        )}
      >
        <LogoFull className={fullClassName} />
      </div>

      {/* Icon only - visible on mobile, or on desktop when collapsed */}
      <div
        className={cn(
          "transition-all duration-300 ease-in-out",
          // Always visible on mobile
          "block",
          // Desktop: only show when collapsed
          isCollapsed
            ? "md:block md:opacity-100"
            : "md:hidden md:opacity-0"
        )}
      >
        <LogoIcon className={iconClassName} />
      </div>
    </div>
  );
}

export { LogoFull } from "./LogoFull";
export { LogoIcon } from "./LogoIcon";

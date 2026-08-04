"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface BentoItemProps {
  children: React.ReactNode;
  className?: string;
  size?: "1x1" | "2x1" | "1x2" | "2x2";
}

function BentoItem({ children, className, size = "1x1" }: BentoItemProps) {
  // On mobile, all items are 1x1. Sizes apply from sm breakpoint up
  const sizeClasses = {
    "1x1": "",
    "2x1": "sm:col-span-2 lg:col-span-2",
    "1x2": "sm:row-span-2 lg:row-span-2",
    "2x2": "sm:col-span-2 sm:row-span-2 lg:col-span-2 lg:row-span-2",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "border border-border rounded-lg bg-card",
        "p-4 sm:p-5 md:p-6 transition-all duration-150",
        "hover:border-ring sm:hover:scale-[1.02]",
        sizeClasses[size],
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

function BentoGrid({ children, className }: BentoGridProps) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4",
        "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
        "auto-rows-[minmax(160px,auto)] sm:auto-rows-[minmax(180px,auto)] md:auto-rows-[minmax(200px,auto)]",
        className
      )}
    >
      {children}
    </div>
  );
}

interface BentoFeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  size?: "1x1" | "2x1" | "1x2" | "2x2";
  className?: string;
  children?: React.ReactNode;
}

function BentoFeatureCard({
  icon,
  title,
  description,
  size = "1x1",
  className,
  children,
}: BentoFeatureCardProps) {
  return (
    <BentoItem size={size} className={cn("flex flex-col", className)}>
      <div className="flex-1">
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-muted flex items-center justify-center mb-3 sm:mb-4 text-foreground">
          {icon}
        </div>
        <h3 className="font-semibold text-foreground mb-1 sm:mb-2 text-sm sm:text-base">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      {children && <div className="mt-3 sm:mt-4">{children}</div>}
    </BentoItem>
  );
}

export { BentoGrid, BentoItem, BentoFeatureCard };

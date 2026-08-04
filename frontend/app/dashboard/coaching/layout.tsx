"use client";

import { FeatureGate } from "@/components/guards/FeatureGate";

export default function CoachingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FeatureGate feature="coaching">{children}</FeatureGate>;
}

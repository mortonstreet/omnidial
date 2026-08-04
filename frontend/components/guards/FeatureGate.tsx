"use client";

import { ReactNode } from "react";
import { useCanAccessFeature } from "@/hooks/api/useSubscription";
import { AppFeature } from "@shared/types/src/stripe";
import { UpgradePrompt } from "@/components/billing/UpgradePrompt";

interface FeatureGateProps {
  feature: AppFeature;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ feature, children, fallback }: FeatureGateProps) {
  const { canAccess, isLoading } = useCanAccessFeature(feature);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!canAccess) {
    return <>{fallback ?? <UpgradePrompt feature={feature} />}</>;
  }

  return <>{children}</>;
}

"use client";

import { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppFeature } from "@shared/types/src/stripe";
import { UpgradeModal } from "./UpgradeModal";

const FEATURE_LABELS: Record<string, { title: string; description: string }> = {
  coaching: {
    title: "Sales Coaching",
    description:
      "Get AI-powered coaching insights on your calls to improve your team's performance.",
  },
};

interface UpgradePromptProps {
  feature: AppFeature;
}

export function UpgradePrompt({ feature }: UpgradePromptProps) {
  const [showModal, setShowModal] = useState(false);
  const info = FEATURE_LABELS[feature] ?? {
    title: feature.charAt(0).toUpperCase() + feature.slice(1),
    description: "This feature requires a Pro plan.",
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center px-6">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {info.title} is a Pro Feature
        </h2>
        <p className="text-muted-foreground max-w-md mb-8">{info.description}</p>
        <Button onClick={() => setShowModal(true)} size="lg">
          <Sparkles className="w-4 h-4 mr-2" />
          Upgrade to Pro
        </Button>
      </div>

      <UpgradeModal open={showModal} onOpenChange={setShowModal} />
    </>
  );
}

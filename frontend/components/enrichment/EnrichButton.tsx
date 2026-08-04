"use client";

import { Sparkles, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEnrichLead } from "@/hooks/api/useEnrichment";
import { toast } from "sonner";

interface EnrichButtonProps {
  leadId: string;
  enrichmentStatus?: string | null;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "icon";
  onComplete?: () => void;
}

export function EnrichButton({
  leadId,
  enrichmentStatus,
  variant = "outline",
  size = "default",
  onComplete,
}: EnrichButtonProps) {
  const enrichLead = useEnrichLead();

  const isEnriched = enrichmentStatus === "enriched";

  const handleEnrich = async () => {
    try {
      const result = await enrichLead.mutateAsync({
        leadId,
        forceRefresh: isEnriched,
      });
      if (result.success) {
        toast.success(
          `Enriched lead (${result.fieldsEnriched.length} fields, ${result.creditsUsed} credits)`
        );
      } else {
        toast.error(result.errorMessage || "Enrichment failed");
      }
      onComplete?.();
    } catch {
      toast.error("Failed to enrich lead");
    }
  };

  if (size === "icon") {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleEnrich}
        disabled={enrichLead.isPending}
        className="h-10 w-10"
        aria-label={isEnriched ? "Re-enrich lead" : "Enrich lead"}
      >
        {enrichLead.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : isEnriched ? (
          <RefreshCw className="w-4 h-4" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleEnrich}
      disabled={enrichLead.isPending}
    >
      {enrichLead.isPending ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : isEnriched ? (
        <RefreshCw className="w-4 h-4" />
      ) : (
        <Sparkles className="w-4 h-4" />
      )}
      {isEnriched ? "Re-enrich" : "Enrich"}
    </Button>
  );
}

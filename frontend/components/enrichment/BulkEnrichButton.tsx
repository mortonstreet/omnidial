"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBulkEnrich } from "@/hooks/api/useEnrichment";
import { toast } from "sonner";

interface BulkEnrichButtonProps {
  leadIds: string[];
  onComplete?: () => void;
  onClearSelection?: () => void;
}

export function BulkEnrichButton({
  leadIds,
  onComplete,
  onClearSelection,
}: BulkEnrichButtonProps) {
  const bulkEnrich = useBulkEnrich();
  const [progress, setProgress] = useState<string | null>(null);

  const handleBulkEnrich = async () => {
    if (leadIds.length === 0) return;

    try {
      let totalEnriched = 0;
      let totalFailed = 0;
      let totalCredits = 0;

      if (leadIds.length <= 100) {
        const result = await bulkEnrich.mutateAsync({ leadIds });
        totalEnriched = result.totalEnriched;
        totalFailed = result.totalFailed;
        totalCredits = result.totalCreditsUsed;
      } else {
        const chunks: string[][] = [];
        for (let i = 0; i < leadIds.length; i += 100) {
          chunks.push(leadIds.slice(i, i + 100));
        }

        for (let i = 0; i < chunks.length; i++) {
          setProgress(`Enriching batch ${i + 1}/${chunks.length}...`);
          const result = await bulkEnrich.mutateAsync({ leadIds: chunks[i] });
          totalEnriched += result.totalEnriched;
          totalFailed += result.totalFailed;
          totalCredits += result.totalCreditsUsed;
        }
        setProgress(null);
      }

      toast.success(
        `Enriched ${totalEnriched} of ${leadIds.length} leads${totalFailed > 0 ? ` (${totalFailed} failed)` : ""} (${totalCredits} credits used)`
      );
      onClearSelection?.();
      onComplete?.();
    } catch {
      setProgress(null);
      toast.error("Bulk enrichment failed");
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleBulkEnrich}
      disabled={bulkEnrich.isPending || leadIds.length === 0}
    >
      {bulkEnrich.isPending ? (
        <>
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          {progress || "Enriching..."}
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4 mr-1" />
          Enrich ({leadIds.length})
        </>
      )}
    </Button>
  );
}

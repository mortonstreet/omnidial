"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import type { DataVendorProvider, VendorDataType } from "@shared/types/src";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  useBulkEnrich,
  useEnrichmentVendors,
} from "@/hooks/api/useEnrichment";
import {
  getActiveContactEnrichmentVendors,
  getEnrichmentProviderLabel,
} from "@/lib/enrichment-ui";
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
  const { data: vendorsData, isLoading: vendorsLoading } =
    useEnrichmentVendors();
  const [progress, setProgress] = useState<string | null>(null);

  const activeVendors = useMemo(
    () => getActiveContactEnrichmentVendors(vendorsData?.data),
    [vendorsData?.data],
  );
  const contactDataTypes: VendorDataType[] = ["phone", "email"];

  const handleBulkEnrich = async (provider: DataVendorProvider) => {
    if (leadIds.length === 0) return;

    const providerLabel = getEnrichmentProviderLabel(provider);

    try {
      let totalEnriched = 0;
      let totalFailed = 0;
      let totalCredits = 0;
      let firstError: string | null = null;

      if (leadIds.length <= 100) {
        const result = await bulkEnrich.mutateAsync({
          leadIds,
          providers: [provider],
          dataTypes: contactDataTypes,
        });
        totalEnriched = result.totalEnriched;
        totalFailed = result.totalFailed;
        totalCredits = result.totalCreditsUsed;
        firstError =
          result.results.find((leadResult) => !leadResult.success)
            ?.errorMessage ?? null;
      } else {
        const chunks: string[][] = [];
        for (let i = 0; i < leadIds.length; i += 100) {
          chunks.push(leadIds.slice(i, i + 100));
        }

        for (let i = 0; i < chunks.length; i++) {
          setProgress(
            `${providerLabel}: batch ${i + 1}/${chunks.length}...`,
          );
          const result = await bulkEnrich.mutateAsync({
            leadIds: chunks[i],
            providers: [provider],
            dataTypes: contactDataTypes,
          });
          totalEnriched += result.totalEnriched;
          totalFailed += result.totalFailed;
          totalCredits += result.totalCreditsUsed;
          firstError =
            firstError ??
            result.results.find((leadResult) => !leadResult.success)
              ?.errorMessage ??
            null;
        }
        setProgress(null);
      }

      const totalNoUpdate = leadIds.length - totalEnriched - totalFailed;
      const creditsText = `${totalCredits} credit${totalCredits === 1 ? "" : "s"} used`;

      if (totalEnriched > 0) {
        toast.success(
          `${providerLabel} updated ${totalEnriched} of ${leadIds.length} leads${
            totalFailed > 0 ? ` (${totalFailed} failed)` : ""
          }${totalNoUpdate > 0 ? ` (${totalNoUpdate} unchanged)` : ""} (${creditsText})`
        );
      } else if (totalFailed > 0) {
        toast.error(
          firstError
            ? `No leads were enriched. ${firstError}`
            : `No leads were enriched. ${totalFailed} failed.`
        );
      } else {
        toast.info(
          `${providerLabel} found no missing contact data for ${leadIds.length} selected lead${
            leadIds.length === 1 ? "" : "s"
          }. (${creditsText})`
        );
      }
      onClearSelection?.();
      onComplete?.();
    } catch {
      setProgress(null);
      toast.error(`${providerLabel} bulk enrichment failed`);
    }
  };

  const isPending = bulkEnrich.isPending;
  const disabled =
    vendorsLoading ||
    isPending ||
    leadIds.length === 0 ||
    activeVendors.length === 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          title={
            activeVendors.length === 0
              ? "No enrichment providers connected"
              : "Enrichment providers"
          }
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              {progress || "Enriching..."}
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-1" />
              Enrich with ({leadIds.length})
              <ChevronDown className="h-4 w-4" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {activeVendors.map((vendor) => (
          <DropdownMenuItem
            key={vendor.id}
            onClick={() => handleBulkEnrich(vendor.provider)}
          >
            <span className="mr-2 flex h-4 w-4 items-center justify-center">
              <BrandLogo provider={vendor.provider} size={16} />
            </span>
            {getEnrichmentProviderLabel(vendor.provider)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

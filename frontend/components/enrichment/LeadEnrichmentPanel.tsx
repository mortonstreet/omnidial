"use client";

import { useState } from "react";
import {
  RefreshCw,
  Check,
  AlertCircle,
  Clock,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { useEnrichLead, useEnrichmentVendors } from "@/hooks/api/useEnrichment";

interface LeadEnrichmentPanelProps {
  leadId: string;
  enrichmentStatus?: "none" | "partial" | "complete" | "failed";
  enrichmentSources?: string[];
  lastEnrichedAt?: string;
  onEnrichComplete?: () => void;
}

export function LeadEnrichmentPanel({
  leadId,
  enrichmentStatus = "none",
  enrichmentSources = [],
  lastEnrichedAt,
  onEnrichComplete,
}: LeadEnrichmentPanelProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);
  const [forceRefresh, setForceRefresh] = useState(false);

  // Only fetch vendors when the user opens the enrichment options panel
  const { data: vendors } = useEnrichmentVendors(showOptions);
  const enrichLead = useEnrichLead();

  const handleEnrich = async () => {
    try {
      await enrichLead.mutateAsync({
        leadId,
        providers: selectedProviders.length > 0 ? selectedProviders : undefined,
        forceRefresh,
      });
      onEnrichComplete?.();
      setShowOptions(false);
    } catch (error) {
      console.error("Failed to enrich lead:", error);
    }
  };

  const toggleProvider = (provider: string) => {
    setSelectedProviders((prev) =>
      prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
    );
  };

  const getStatusIcon = () => {
    switch (enrichmentStatus) {
      case "complete":
        return <Check className="w-4 h-4 text-green-500" />;
      case "partial":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "failed":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (enrichmentStatus) {
      case "complete":
        return "Fully enriched";
      case "partial":
        return "Partially enriched";
      case "failed":
        return "Enrichment failed";
      default:
        return "Not enriched";
    }
  };

  const activeVendors = vendors?.data?.filter((v) => v.isActive) || [];

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-sm">Data Enrichment</h4>
          <div className="flex items-center gap-2 mt-1">
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {getStatusText()}
            </span>
          </div>
        </div>

        <button
          onClick={() => setShowOptions(!showOptions)}
          disabled={enrichLead.isPending}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted border border-border rounded-md hover:border-foreground/20 disabled:opacity-50 transition-colors"
        >
          {enrichLead.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {enrichmentStatus === "none" ? "Enrich" : "Re-enrich"}
          <ChevronDown
            className={`w-4 h-4 transition-transform ${
              showOptions ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {/* Source badges */}
      {enrichmentSources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {enrichmentSources.map((source) => (
            <span
              key={source}
              className="px-2 py-0.5 text-xs bg-muted rounded-full capitalize"
            >
              {source}
            </span>
          ))}
        </div>
      )}

      {/* Last enriched */}
      {lastEnrichedAt && (
        <p className="text-xs text-muted-foreground">
          Last enriched:{" "}
          {new Date(lastEnrichedAt).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}

      {/* Options panel */}
      {showOptions && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* Provider selection */}
          {activeVendors.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Select providers (leave empty for all)
              </label>
              <div className="flex flex-wrap gap-2">
                {activeVendors.map((vendor) => (
                  <button
                    key={vendor.id}
                    type="button"
                    onClick={() => toggleProvider(vendor.provider)}
                    className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                      selectedProviders.includes(vendor.provider)
                        ? "border-foreground bg-foreground/5"
                        : "border-border hover:border-foreground/20"
                    }`}
                  >
                    {vendor.provider}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Force refresh option */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={forceRefresh}
              onChange={(e) => setForceRefresh(e.target.checked)}
              className="w-4 h-4 rounded border-border"
            />
            <span className="text-sm">Force refresh existing data</span>
          </label>

          {/* Enrich button */}
          <button
            onClick={handleEnrich}
            disabled={enrichLead.isPending || activeVendors.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-background rounded-md hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {enrichLead.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Enriching...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Start Enrichment
              </>
            )}
          </button>

          {activeVendors.length === 0 && (
            <p className="text-xs text-amber-500">
              No active vendors configured. Add vendors in settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

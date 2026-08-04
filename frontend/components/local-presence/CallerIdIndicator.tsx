"use client";

import { MapPin, Phone, Check, AlertTriangle, Loader2 } from "lucide-react";
import { useLocalPresencePreview } from "@/hooks/api/useLocalPresence";

interface CallerIdIndicatorProps {
  leadPhone: string;
  compact?: boolean;
}

export function CallerIdIndicator({
  leadPhone,
  compact = false,
}: CallerIdIndicatorProps) {
  const { data: preview, isLoading } = useLocalPresencePreview(leadPhone);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        {!compact && <span className="text-sm">Selecting caller ID...</span>}
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  const isLocalMatch = preview.matchType === "exact" || preview.matchType === "region";

  if (compact) {
    return (
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs ${
          isLocalMatch
            ? "bg-green-500/10 text-green-500"
            : "bg-amber-500/10 text-amber-500"
        }`}
        title={
          isLocalMatch
            ? `Local match: ${preview.selectedPoolNumber?.phoneNumber}`
            : `Fallback: ${preview.selectedPoolNumber?.phoneNumber}`
        }
      >
        <MapPin className="w-3 h-3" />
        {isLocalMatch ? "Local" : "Fallback"}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
        isLocalMatch
          ? "bg-green-500/5 border-green-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${
          isLocalMatch ? "bg-green-500/10" : "bg-amber-500/10"
        }`}
      >
        {isLocalMatch ? (
          <Check className="w-5 h-5 text-green-500" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-amber-500" />
        )}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <span className="font-mono text-sm">{preview.selectedPoolNumber?.phoneNumber}</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          {isLocalMatch ? (
            <span className="text-xs text-green-500">
              Regional match
            </span>
          ) : (
            <span className="text-xs text-amber-500">
              No local match - using fallback
            </span>
          )}
          {preview.selectedPoolNumber?.region && (
            <span className="text-xs text-muted-foreground">
              • {preview.selectedPoolNumber.region}
            </span>
          )}
        </div>
      </div>

      {/* Match details */}
      <div className="text-right">
        <div className="text-xs text-muted-foreground">Lead area code</div>
        <div className="font-mono text-sm">{preview.leadAreaCode || "—"}</div>
      </div>
    </div>
  );
}

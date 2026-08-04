"use client";

import { Brain, Loader2 } from "lucide-react";
import { useLeadIntelligence } from "@/hooks/api/useCallIntelligence";
import { CallIntelligenceCard } from "./CallIntelligenceCard";

interface LeadIntelligenceHistoryProps {
  leadId: string;
}

export function LeadIntelligenceHistory({ leadId }: LeadIntelligenceHistoryProps) {
  const { data: intelligence, isLoading } = useLeadIntelligence(leadId);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!intelligence || intelligence.length === 0) {
    return (
      <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No intelligence extracted yet</p>
          <p className="text-xs mt-1">
            Use &quot;Extract Intel&quot; on a call with 30+ seconds of recording
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Brain className="w-4 h-4 text-primary" />
        <span className="font-medium text-sm">
          Call Intelligence ({intelligence.length})
        </span>
      </div>
      {intelligence.map((intel) => (
        <CallIntelligenceCard key={intel.id} intelligence={intel} />
      ))}
    </div>
  );
}

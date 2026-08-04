"use client";

import { Sparkles, Loader2 } from "lucide-react";
import { useLeadCoaching } from "@/hooks/api/useCoaching";
import { CoachingCard } from "@/components/coaching";

interface LeadCoachingHistoryProps {
  leadId: string;
  limit?: number;
}

export function LeadCoachingHistory({ leadId, limit = 20 }: LeadCoachingHistoryProps) {
  const { data: coaching, isLoading } = useLeadCoaching(leadId, { limit });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!coaching || coaching.length === 0) {
    return (
      <div className="p-4 sm:p-6 rounded-xl border border-border bg-card">
        <div className="text-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            No coaching yet
          </h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Call coaching feedback will appear here after calls with this lead are analyzed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Coaching History
        </h3>
        <span className="text-sm text-muted-foreground">
          {coaching.length} {coaching.length === 1 ? "call" : "calls"} analyzed
        </span>
      </div>
      {coaching.map((item) => (
        <CoachingCard key={item.id} coaching={item} />
      ))}
    </div>
  );
}

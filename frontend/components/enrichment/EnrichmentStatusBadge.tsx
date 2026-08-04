"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EnrichmentStatusBadgeProps {
  status?: string | null;
  sources?: string[] | null;
  compact?: boolean;
}

export function EnrichmentStatusBadge({
  status,
  sources,
  compact = false,
}: EnrichmentStatusBadgeProps) {
  if (!status) return null;

  const config: Record<string, { color: string; label: string }> = {
    enriched: { color: "bg-green-500", label: "Enriched" },
    failed: { color: "bg-red-500", label: "Failed" },
    pending: { color: "bg-amber-500", label: "Pending" },
  };

  const { color, label } = config[status] || { color: "bg-gray-400", label: status };

  const dot = (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${color}`} />
      {!compact && <span className="text-xs text-muted-foreground">{label}</span>}
    </span>
  );

  if (compact && sources && sources.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">{dot}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">
              {label} via {sources.join(", ")}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return dot;
}

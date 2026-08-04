"use client";

import { useState } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  Calendar,
  Voicemail,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  X,
  Brain,
} from "lucide-react";
import { useLeadCalls, type LeadCall } from "@/hooks/api/useLeads";
import { useDispositions, useSetCallDisposition } from "@/hooks/api/useCalls";
import { useGenerateIntelligence } from "@/hooks/api/useCallIntelligence";
import { useActiveOrganization } from "@/lib/auth-client";
import { AudioPlayer } from "@/components/ui/audio-player";
import { CallIntelligenceCard } from "@/components/intelligence";
import { toast } from "sonner";
import type { CallIntelligenceRecord } from "@shared/types/src/requests/callIntelligence";

interface LeadCallHistoryProps {
  leadId: string;
  leadName?: string;
  limit?: number;
  showTitle?: boolean;
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than 24 hours ago - show relative time
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return minutes < 1 ? "Just now" : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }

  // Less than 7 days - show day name
  if (diff < 604800000) {
    return date.toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  }

  // Otherwise show date
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

interface Disposition {
  id: string;
  label: string;
  color: string | null;
}

function CallItem({ call, dispositions, leadName }: { call: LeadCall; dispositions: Disposition[]; leadName?: string }) {
  const [isEditingDisposition, setIsEditingDisposition] = useState(false);
  const [intelResult, setIntelResult] = useState<CallIntelligenceRecord | null>(null);
  const setDispositionMutation = useSetCallDisposition();
  const generateIntelligence = useGenerateIntelligence();

  const canExtractIntel = call.recordingUrl && (call.duration || 0) >= 30;

  const statusColors: Record<string, string> = {
    completed: "text-green-500",
    "no-answer": "text-yellow-500",
    busy: "text-orange-500",
    failed: "text-red-500",
    canceled: "text-muted-foreground",
  };

  const handleDispositionSelect = async (dispositionId: string) => {
    try {
      await setDispositionMutation.mutateAsync({ callId: call.id, dispositionId });
      setIsEditingDisposition(false);
      toast.success("Disposition updated");
    } catch {
      toast.error("Failed to update disposition");
    }
  };

  return (
    <div className="p-3 border-b border-border last:border-b-0 hover:bg-muted/30 transition">
    <div className="group flex items-start gap-3">
      {/* Direction icon */}
      <div
        className={`p-2 rounded-full ${
          call.direction === "inbound" ? "bg-blue-500/10 text-blue-500" : "bg-green-500/10 text-green-500"
        }`}
      >
        {call.direction === "inbound" ? (
          <PhoneIncoming className="w-4 h-4" />
        ) : (
          <PhoneOutgoing className="w-4 h-4" />
        )}
      </div>

      {/* Call details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">
            {call.direction === "inbound" ? call.fromNumber : call.toNumber}
          </span>
          <span className={`text-xs capitalize ${statusColors[call.status] || "text-muted-foreground"}`}>
            {call.status.replace("-", " ")}
          </span>
          {call.voicemailDropped && (
            <span className="flex items-center gap-1 text-xs text-orange-500">
              <Voicemail className="w-3 h-3" />
              VM
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formatDate(call.startedAt)}
          </span>
          {call.duration > 0 && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(call.duration)}
            </span>
          )}
        </div>

        {/* Disposition */}
        <div className="mt-2 flex items-center gap-2">
          {isEditingDisposition ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {dispositions.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleDispositionSelect(d.id)}
                  disabled={setDispositionMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs hover:ring-2 ring-offset-1 ring-offset-background transition disabled:opacity-50"
                  style={{
                    backgroundColor: `${d.color || "#6b7280"}20`,
                    color: d.color || "#6b7280",
                    // @ts-expect-error CSS custom property for ring color
                    "--tw-ring-color": d.color || "#6b7280",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: d.color || "#6b7280" }}
                  />
                  {d.label}
                </button>
              ))}
              <button
                onClick={() => setIsEditingDisposition(false)}
                className="p-1 text-muted-foreground hover:text-foreground transition"
                title="Cancel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <>
              {call.dispositionLabel ? (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs"
                  style={{
                    backgroundColor: `${call.dispositionColor || "#6b7280"}20`,
                    color: call.dispositionColor || "#6b7280",
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: call.dispositionColor || "#6b7280" }}
                  />
                  {call.dispositionLabel}
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">No disposition</span>
              )}
              <button
                onClick={() => setIsEditingDisposition(true)}
                className="p-1 text-muted-foreground hover:text-foreground transition opacity-0 group-hover:opacity-100"
                title="Edit disposition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recording playback & Intel */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {call.recordingUrl && (
          <AudioPlayer
            callId={call.id}
            leadName={leadName}
            callDate={call.startedAt}
            compact
          />
        )}
        {canExtractIntel && (
          <button
            onClick={async () => {
              try {
                const result = await generateIntelligence.mutateAsync(call.id);
                setIntelResult(result.intelligence);
                toast.success("Intelligence extracted");
              } catch (error) {
                const message = error instanceof Error ? error.message : "Failed to extract intelligence";
                toast.error(message);
              }
            }}
            disabled={generateIntelligence.isPending}
            className="p-2 text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            title="Extract Intel"
          >
            {generateIntelligence.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Brain className="w-4 h-4" />
            )}
          </button>
        )}
      </div>
    </div>
      {intelResult && (
        <div className="mt-2">
          <CallIntelligenceCard intelligence={intelResult} />
        </div>
      )}
    </div>
  );
}

export function LeadCallHistory({
  leadId,
  leadName,
  limit = 10,
  showTitle = true,
  collapsible = false,
  defaultExpanded = true,
}: LeadCallHistoryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [page, setPage] = useState(1);
  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  const { data: callsData, isLoading } = useLeadCalls(leadId, { page, limit });
  const { data: dispositionsData } = useDispositions(!!organizationId);
  const calls = callsData?.data || [];
  const pagination = callsData?.pagination;
  const dispositions = (dispositionsData?.data || []) as Disposition[];

  const content = (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Phone className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No calls recorded for this lead
        </div>
      ) : (
        <>
          <div className="divide-y divide-border">
            {calls.map((call) => (
              <CallItem key={call.id} call={call} dispositions={dispositions} leadName={leadName} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">
                {pagination.total} total calls
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={!pagination.hasPrevPage}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => p + 1)}
                  disabled={!pagination.hasNextPage}
                  className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );

  if (collapsible) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition"
        >
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span className="font-medium text-sm">Call History</span>
            {pagination && (
              <span className="text-xs text-muted-foreground">
                ({pagination.total})
              </span>
            )}
          </div>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        {expanded && <div className="border-t border-border">{content}</div>}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {showTitle && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium text-sm">Call History</span>
          {pagination && (
            <span className="text-xs text-muted-foreground">
              ({pagination.total})
            </span>
          )}
        </div>
      )}
      {content}
    </div>
  );
}

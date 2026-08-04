"use client";

import { useState } from "react";
import { useLeadCalls } from "@/hooks/api/useLeads";
import { useDispositions, useSetCallDisposition } from "@/hooks/api/useCalls";
import { format } from "date-fns";
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  PhoneMissed,
  Pencil,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AudioPlayer } from "@/components/ui/audio-player";

interface CallHistoryProps {
  leadId: string;
  leadName?: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function getStatusIcon(status: string, direction: string) {
  if (status === "missed" || status === "failed") {
    return <PhoneMissed className="w-4 h-4 text-red-500" />;
  }
  if (direction === "inbound") {
    return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
  }
  return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
}

function getStatusBadge(status: string) {
  const statusStyles: Record<string, string> = {
    completed: "bg-green-100 text-green-700",
    "in-progress": "bg-blue-100 text-blue-700",
    ringing: "bg-yellow-100 text-yellow-700",
    initiated: "bg-gray-100 text-gray-700",
    failed: "bg-red-100 text-red-700",
    missed: "bg-red-100 text-red-700",
  };

  return (
    <span
      className={`px-2 py-0.5 rounded text-xs capitalize ${
        statusStyles[status] || "bg-gray-100 text-gray-700"
      }`}
    >
      {status}
    </span>
  );
}

export function CallHistory({ leadId, leadName }: CallHistoryProps) {
  const { data, isLoading } = useLeadCalls(leadId, { limit: 50 });
  const { data: dispositionsData } = useDispositions();
  const setDispositionMutation = useSetCallDisposition();
  const [editingCallId, setEditingCallId] = useState<string | null>(null);
  const [selectedDispositionId, setSelectedDispositionId] = useState<string>("");

  const calls = data?.data || [];
  const dispositions = dispositionsData?.data || [];

  const handleEditDisposition = (callId: string, currentDispositionId?: string | null) => {
    setEditingCallId(callId);
    setSelectedDispositionId(currentDispositionId || "");
  };

  const handleSaveDisposition = async (callId: string) => {
    if (!selectedDispositionId) {
      toast.error("Please select a disposition");
      return;
    }
    try {
      await setDispositionMutation.mutateAsync({
        callId,
        dispositionId: selectedDispositionId,
      });
      toast.success("Disposition updated");
      setEditingCallId(null);
      setSelectedDispositionId("");
    } catch {
      toast.error("Failed to update disposition");
    }
  };

  const handleCancelEdit = () => {
    setEditingCallId(null);
    setSelectedDispositionId("");
  };

  const getDispositionLabel = (dispositionId: string | null | undefined) => {
    if (!dispositionId) return null;
    const disposition = dispositions.find((d) => d.id === dispositionId);
    return disposition ? disposition.label : null;
  };

  const getDispositionColor = (dispositionId: string | null | undefined) => {
    if (!dispositionId) return null;
    const disposition = dispositions.find((d) => d.id === dispositionId);
    return disposition?.color || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div className="text-center py-8">
        <Phone className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No calls yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Call history will appear here when calls are made to this lead.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {calls.map((call) => (
        <div
          key={call.id}
          className="p-3 rounded-lg border border-border bg-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                {getStatusIcon(call.status, call.direction)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground capitalize">
                    {call.direction} Call
                  </p>
                  {getStatusBadge(call.status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {call.direction === "inbound"
                    ? `From: ${call.fromNumber}`
                    : `To: ${call.toNumber}`}
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-muted-foreground">
              <p>{format(new Date(call.startedAt), "MMM d, yyyy")}</p>
              <p>{format(new Date(call.startedAt), "h:mm a")}</p>
            </div>
          </div>

          {/* Call details */}
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            {call.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(call.duration)}
              </span>
            )}
            {call.recordingUrl && (
              <AudioPlayer
                callId={call.id}
                leadName={leadName}
                callDate={call.startedAt}
                compact
              />
            )}
            {call.voicemailDropped && (
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-700">
                Voicemail dropped
              </span>
            )}
          </div>

          {/* Disposition section */}
          <div className="mt-3 pt-3 border-t border-border">
            {editingCallId === call.id ? (
              <div className="flex items-center gap-2">
                <select
                  value={selectedDispositionId}
                  onChange={(e) => setSelectedDispositionId(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs rounded border border-input bg-background"
                >
                  <option value="">Select disposition...</option>
                  {dispositions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleSaveDisposition(call.id)}
                  disabled={setDispositionMutation.isPending}
                  className="p-1 text-green-600 hover:bg-green-50 rounded transition"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-muted-foreground hover:bg-muted rounded transition"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Disposition:</span>
                  {getDispositionLabel(call.dispositionId) ? (
                    <span
                      className="px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: getDispositionColor(call.dispositionId) + "20",
                        color: getDispositionColor(call.dispositionId) || undefined,
                      }}
                    >
                      {getDispositionLabel(call.dispositionId)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">Not set</span>
                  )}
                </div>
                <button
                  onClick={() => handleEditDisposition(call.id, call.dispositionId)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                  title="Edit disposition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

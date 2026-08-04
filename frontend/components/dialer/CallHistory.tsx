"use client";

import { useState } from "react";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, User, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useCalls } from "@/hooks/api/useCalls";
import { useActiveOrganization, useSession } from "@/lib/auth-client";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import type { CallResponse } from "@shared/types/src";
import { AudioPlayer } from "@/components/ui/audio-player";

interface CallHistoryProps {
  leadId?: string;
  limit?: number;
}

interface Member {
  id: string;
  userId: string;
  role: string;
}

export function CallHistory({ leadId, limit = 10 }: CallHistoryProps) {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const { data: session } = useSession();
  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  // Get organization members to check user role
  const { data: membersData } = useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];

  // Check if current user is admin or owner
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const isAdminOrOwner = currentUserMember?.role === 'admin' || currentUserMember?.role === 'owner';

  // For members, only show their own calls
  const effectiveLimit = showFullHistory ? 100 : limit;
  const userIdFilter = isAdminOrOwner ? undefined : session?.user?.id;

  const { data: calls, isLoading } = useCalls(
    { leadId, limit: effectiveLimit, userId: userIdFilter },
    !!organizationId
  );

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const getCallIcon = (call: CallResponse) => {
    if (call.status === "missed") {
      return <PhoneMissed className="w-4 h-4 text-red-500" />;
    }
    if (call.direction === "inbound") {
      return <PhoneIncoming className="w-4 h-4 text-blue-500" />;
    }
    return <PhoneOutgoing className="w-4 h-4 text-green-500" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!calls?.data?.length) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No call history yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Role info banner for context */}
      <div className="text-xs text-muted-foreground mb-4">
        {isAdminOrOwner
          ? "Showing all workspace calls"
          : "Showing your calls"}
      </div>

      {calls.data.map((call) => (
        <div
          key={call.id}
          className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition"
        >
          {/* Call direction icon */}
          <div className="flex-shrink-0">{getCallIcon(call)}</div>

          {/* Call info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {/* Show lead name if available, otherwise show phone number */}
              {(call.leadFirstName || call.leadLastName) ? (
                call.leadId ? (
                  <Link
                    href={`/dashboard/leads/${call.leadId}`}
                    className="font-medium text-foreground truncate hover:text-primary hover:underline transition-colors"
                  >
                    {[call.leadFirstName, call.leadLastName].filter(Boolean).join(" ")}
                  </Link>
                ) : (
                  <span className="font-medium text-foreground truncate">
                    {[call.leadFirstName, call.leadLastName].filter(Boolean).join(" ")}
                  </span>
                )
              ) : (
                <span className="font-medium text-foreground truncate font-mono">
                  {call.direction === "inbound" ? call.fromNumber : call.toNumber}
                </span>
              )}
              {call.dispositionLabel && (
                <span
                  className="text-xs px-2 py-0.5 rounded"
                  style={{
                    backgroundColor: call.dispositionColor ? `${call.dispositionColor}20` : undefined,
                    color: call.dispositionColor || undefined,
                  }}
                >
                  {call.dispositionLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* Show phone as secondary info when lead name exists */}
              {(call.leadFirstName || call.leadLastName) && (
                <>
                  <span className="font-mono">
                    {call.direction === "inbound" ? call.fromNumber : call.toNumber}
                  </span>
                  <span>-</span>
                </>
              )}
              <span>{formatDate(call.startedAt)}</span>
              <span>-</span>
              <span>{formatDuration(call.duration)}</span>
              {call.voicemailDropped && (
                <span className="text-yellow-500">VM Dropped</span>
              )}
              {/* Show user/rep name for admins */}
              {isAdminOrOwner && call.userName && (
                <>
                  <span>-</span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    {call.userName}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Play recording button */}
          {call.recordingUrl && (
            <AudioPlayer
              callId={call.id}
              leadName={[call.leadFirstName, call.leadLastName].filter(Boolean).join(" ") || undefined}
              callDate={call.startedAt}
              compact
            />
          )}
        </div>
      ))}

      {/* Show Full History button */}
      {calls.total > limit && (
        <button
          onClick={() => setShowFullHistory(!showFullHistory)}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted/50 transition mt-4"
        >
          {showFullHistory ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show Full History ({calls.total} calls)
            </>
          )}
        </button>
      )}
    </div>
  );
}

"use client";

import { Phone, PhoneCall, Clock, Headphones, Volume2, Mic } from "lucide-react";
import { useStartListenSession } from "@/hooks/api/useSalesFloor";
import type { ActiveRepStatus } from "@shared/types/src/requests/salesFloor";

interface ActiveRepCardProps {
  rep: ActiveRepStatus;
  isManager?: boolean;
  onRepClick?: (rep: ActiveRepStatus) => void;
}

export function ActiveRepCard({ rep, isManager = false, onRepClick }: ActiveRepCardProps) {
  const startListen = useStartListenSession();

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatSessionDuration = (startTime: string | null) => {
    if (!startTime) return "0m";
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const isOnCall = rep.status === "on_call";
  const isDialing = rep.status === "dialing";
  // Can monitor when either dialing or on call (manager wants to hear from initial interaction)
  const canMonitor = (isOnCall || isDialing) && rep.currentCallId;

  const handleListen = async (mode: "listen" | "whisper" | "barge") => {
    if (!rep.currentCallId) return;
    try {
      await startListen.mutateAsync({ callId: rep.currentCallId, mode });
    } catch (error) {
      console.error("Failed to start listen session:", error);
    }
  };

  return (
    <div
      className={`bg-card border rounded-lg p-4 transition-all ${
        isOnCall
          ? "border-green-500 shadow-sm shadow-green-500/20"
          : "border-border"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {rep.userImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={rep.userImage}
              alt={rep.userName}
              className="w-10 h-10 rounded-full"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <span className="text-sm font-medium">
                {rep.userName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h4
              className={`font-medium ${onRepClick ? "cursor-pointer hover:text-primary hover:underline" : ""}`}
              onClick={() => onRepClick?.(rep)}
            >
              {rep.userName}
            </h4>
            {rep.campaignName && (
              <p className="text-xs text-muted-foreground">{rep.campaignName}</p>
            )}
          </div>
        </div>

        {isOnCall ? (
          <span className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
            <PhoneCall className="w-3 h-3" />
            On Call
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs bg-muted text-muted-foreground px-2 py-1 rounded-full">
            <Phone className="w-3 h-3" />
            Dialing
          </span>
        )}
      </div>

      {/* Call info when dialing or on call */}
      {(isOnCall || isDialing) && (
        <div className="bg-muted/50 rounded-md p-3 mb-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {rep.currentLeadName || "Unknown Lead"}
            </span>
            {isOnCall ? (
              <span className="text-sm font-mono text-green-500">
                {formatDuration(rep.callDuration)}
              </span>
            ) : (
              <span className="text-sm text-amber-500 animate-pulse">
                Ringing...
              </span>
            )}
          </div>

          {/* Manager controls - available from initial dial */}
          {isManager && canMonitor && (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => handleListen("listen")}
                disabled={startListen.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-background border border-border rounded-md hover:border-foreground/20 transition-colors"
                title="Listen to the call (silent)"
              >
                <Headphones className="w-3 h-3" />
                Listen
              </button>
              <button
                onClick={() => handleListen("whisper")}
                disabled={startListen.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-background border border-border rounded-md hover:border-foreground/20 transition-colors"
                title="Whisper (only rep hears you)"
              >
                <Volume2 className="w-3 h-3" />
                Whisper
              </button>
              <button
                onClick={() => handleListen("barge")}
                disabled={startListen.isPending}
                className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs bg-background border border-border rounded-md hover:border-foreground/20 transition-colors"
                title="Barge (everyone hears you)"
              >
                <Mic className="w-3 h-3" />
                Barge
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-lg font-bold">{rep.callsThisSession}</div>
          <div className="text-xs text-muted-foreground">Calls</div>
        </div>
        <div>
          <div className="text-lg font-bold text-green-500">
            {rep.connectedThisSession}
          </div>
          <div className="text-xs text-muted-foreground">Connected</div>
        </div>
        <div>
          <div className="text-sm font-medium flex items-center justify-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {formatSessionDuration(rep.sessionStartedAt)}
          </div>
          <div className="text-xs text-muted-foreground">Session</div>
        </div>
      </div>
    </div>
  );
}

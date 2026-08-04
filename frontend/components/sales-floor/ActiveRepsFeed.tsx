"use client";

import { Users, Phone, PhoneCall, Headphones, Volume2, Mic, RefreshCw } from "lucide-react";
import { useStartListenSession } from "@/hooks/api/useSalesFloor";
import type { ActiveRepStatus } from "@shared/types/src/requests/salesFloor";

interface ActiveRepsFeedProps {
  reps: ActiveRepStatus[];
  isLoading: boolean;
  isManager?: boolean;
  onRepClick?: (rep: ActiveRepStatus) => void;
  onRefresh?: () => void;
}

export function ActiveRepsFeed({
  reps,
  isLoading,
  isManager = false,
  onRepClick,
  onRefresh,
}: ActiveRepsFeedProps) {
  const startListen = useStartListenSession();

  const formatDuration = (seconds: number | null | undefined) => {
    if (seconds === null || seconds === undefined) return "00:00";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleListen = async (
    e: React.MouseEvent,
    callId: string,
    mode: "listen" | "whisper" | "barge"
  ) => {
    e.stopPropagation();
    try {
      await startListen.mutateAsync({ callId, mode });
    } catch (error) {
      console.error("Failed to start listen session:", error);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h3 className="font-medium">Active Reps</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {reps.length}
          </span>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto max-h-[500px]">
        {isLoading ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-2 w-16 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : reps.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No active reps
          </div>
        ) : (
          <div className="divide-y divide-border">
            {reps.map((rep) => {
              const isOnCall = rep.status === "on_call";
              const isDialing = rep.status === "dialing";
              const canMonitor = (isOnCall || isDialing) && rep.currentCallId;

              return (
                <div
                  key={rep.userId}
                  className={`p-3 hover:bg-muted/50 transition-colors ${
                    onRepClick ? "cursor-pointer" : ""
                  } ${isOnCall ? "bg-green-500/5" : ""}`}
                  onClick={() => onRepClick?.(rep)}
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    {rep.userImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={rep.userImage}
                        alt={rep.userName}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {rep.userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}

                    {/* Rep info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {rep.userName}
                        </span>
                        {isOnCall ? (
                          <span className="flex items-center gap-1 text-[10px] bg-green-500/10 text-green-500 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                            <PhoneCall className="w-2.5 h-2.5" />
                            {formatDuration(rep.callDuration)}
                          </span>
                        ) : isDialing ? (
                          <span className="flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full">
                            <Phone className="w-2.5 h-2.5" />
                            Dialing
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                            Idle
                          </span>
                        )}
                      </div>
                      {rep.currentLeadName && (isOnCall || isDialing) ? (
                        <p className="text-xs text-muted-foreground truncate">
                          {rep.currentLeadName}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {rep.callsThisSession} calls, {rep.connectedThisSession} connected
                        </p>
                      )}
                    </div>

                    {/* Manager controls (compact) */}
                    {isManager && canMonitor && rep.currentCallId && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => handleListen(e, rep.currentCallId!, "listen")}
                          disabled={startListen.isPending}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Listen"
                        >
                          <Headphones className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleListen(e, rep.currentCallId!, "whisper")}
                          disabled={startListen.isPending}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Whisper"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleListen(e, rep.currentCallId!, "barge")}
                          disabled={startListen.isPending}
                          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors"
                          title="Barge"
                        >
                          <Mic className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

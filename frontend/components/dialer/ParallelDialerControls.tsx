"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Phone,
  PhoneOff,
  Loader2,
  Zap,
  ChevronDown,
  AlertTriangle,
  Check,
  X,
  Building2,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import {
  useStartParallelDialSession,
  useEndParallelDialSession,
  useDialNextBatch,
  useParallelDialSession,
} from "@/hooks/api/useParallelDialer";
import { useDialablePhoneNumbers } from "@/hooks/api/usePhoneNumberAssignments";
import { useActiveOrganization } from "@/lib/auth-client";
import { useParallelDialerPusher } from "@/hooks/useParallelDialerPusher";
import { useDialerContext } from "@/components/providers/DialerProvider";
import type {
  ParallelDialAttemptResponse,
  ParallelDialConnectedEvent,
} from "@shared/types/src";

interface ParallelDialerControlsProps {
  campaignId?: string;
  listId?: string;
  clientId?: string;
  isSessionActive?: boolean;
  currentSessionId?: string;
  onSessionStart?: (sessionId: string, conferenceId: string) => void;
  onSessionEnd?: () => void;
  onLeadConnected?: (attempt: ParallelDialAttemptResponse) => void;
}

type AttemptStatus = "pending" | "dialing" | "ringing" | "connected" | "failed" | "no_answer" | "abandoned" | "voicemail";

const statusConfig: Record<AttemptStatus, { color: string; label: string; icon?: React.ReactNode }> = {
  pending: { color: "bg-gray-400", label: "Pending" },
  dialing: { color: "bg-blue-500 animate-pulse", label: "Dialing..." },
  ringing: { color: "bg-amber-500 animate-pulse", label: "Ringing..." },
  connected: { color: "bg-green-500", label: "Connected", icon: <Check className="w-3 h-3" /> },
  failed: { color: "bg-red-500", label: "Failed", icon: <X className="w-3 h-3" /> },
  no_answer: { color: "bg-gray-500", label: "No Answer" },
  abandoned: { color: "bg-orange-500", label: "Abandoned" },
  voicemail: { color: "bg-purple-500", label: "Voicemail" },
};

export function ParallelDialerControls({
  campaignId,
  listId,
  clientId,
  isSessionActive = false,
  currentSessionId,
  onSessionStart,
  onSessionEnd,
  onLeadConnected,
}: ParallelDialerControlsProps) {
  const [lineCount, setLineCount] = useState(3);
  const [showLineSelector, setShowLineSelector] = useState(false);
  const [showPhoneSelector, setShowPhoneSelector] = useState(false);
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [currentAttempts, setCurrentAttempts] = useState<ParallelDialAttemptResponse[]>([]);
  const [connectedAttempt, setConnectedAttempt] = useState<ParallelDialAttemptResponse | null>(null);
  const [sessionStats, setSessionStats] = useState({ attempts: 0, connects: 0, abandoned: 0 });

  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  // Dialer context for conference audio
  const { joinConference, leaveConference, isInConference, isReady: isDeviceReady } = useDialerContext();

  // API hooks
  const startSession = useStartParallelDialSession();
  const endSession = useEndParallelDialSession();
  const dialNextBatch = useDialNextBatch();
  const { data: dialableNumbers, isLoading: isLoadingNumbers } = useDialablePhoneNumbers(orgId, clientId);
  const { data: sessionData } = useParallelDialSession(currentSessionId);

  // Set default phone number when dialable numbers load
  const defaultPhoneNumber = dialableNumbers && dialableNumbers.length > 0 ? dialableNumbers[0].phoneNumber : "";
  const effectiveFromNumber = selectedFromNumber || defaultPhoneNumber;

  // Update state from session data (necessary for syncing query data with real-time Pusher updates)
  useEffect(() => {
    if (sessionData) {
      if (sessionData.currentAttempts) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCurrentAttempts(sessionData.currentAttempts);
      }
      setSessionStats({
        attempts: sessionData.totalAttempts,
        connects: sessionData.totalConnects,
        abandoned: sessionData.totalAbandoned,
      });
    }
  }, [sessionData]);

  // Handle Pusher events
  const handleConnected = useCallback(
    (event: ParallelDialConnectedEvent) => {
      setConnectedAttempt(event.attempt);
      onLeadConnected?.(event.attempt);
    },
    [onLeadConnected]
  );

  // Subscribe to Pusher events
  useParallelDialerPusher({
    sessionId: currentSessionId,
    onAttemptUpdate: (event) => {
      setCurrentAttempts((prev) => {
        const index = prev.findIndex((a) => a.id === event.attempt.id);
        if (index >= 0) {
          const updated = [...prev];
          updated[index] = event.attempt;
          return updated;
        }
        return [...prev, event.attempt];
      });
    },
    onConnected: handleConnected,
    onEnded: () => {
      setCurrentAttempts([]);
      setConnectedAttempt(null);
    },
  });

  const handleStart = async () => {
    console.log("[ParallelDialer] Starting session with:", { campaignId, listId, lineCount });
    try {
      const result = await startSession.mutateAsync({
        campaignId,
        listId,
        lineCount,
      });
      console.log("[ParallelDialer] Session created:", result);

      // Join the conference immediately after starting
      if (result.conferenceId) {
        console.log("[ParallelDialer] Joining conference:", result.conferenceId);
        // Connect rep's audio to the conference
        try {
          await joinConference(result.conferenceId);
          console.log("[ParallelDialer] Conference join initiated, waiting for connection...");
          onSessionStart?.(result.id, result.conferenceId);
          toast.success("Parallel dial session started - connecting to conference...");
        } catch (conferenceError) {
          console.error("[ParallelDialer] Failed to join conference:", conferenceError);
          toast.error("Failed to connect to conference. Check browser console for details.");
          // End the session since we couldn't join the conference
          try {
            await endSession.mutateAsync(result.id);
          } catch {
            // Ignore cleanup error
          }
          return;
        }
      } else {
        console.error("[ParallelDialer] No conference ID in response:", result);
        toast.error("Session created but no conference ID returned");
      }
    } catch (error) {
      console.error("[ParallelDialer] Failed to start session:", error);
      const message = error instanceof Error ? error.message : "Failed to start session";
      if (message.includes("already has an active")) {
        toast.error("You already have an active parallel dial session. Please end it first.");
      } else {
        toast.error(message);
      }
    }
  };

  const handleDialNextBatch = async () => {
    console.log("[ParallelDialer] handleDialNextBatch called", { currentSessionId, effectiveFromNumber, isInConference });
    if (!currentSessionId || !effectiveFromNumber) {
      console.error("[ParallelDialer] Cannot dial - missing sessionId or fromNumber", { currentSessionId, effectiveFromNumber });
      return;
    }

    try {
      setConnectedAttempt(null);
      console.log("[ParallelDialer] Calling dialNextBatch API");
      const result = await dialNextBatch.mutateAsync({
        sessionId: currentSessionId,
        fromNumber: effectiveFromNumber,
      });
      console.log("[ParallelDialer] dialNextBatch result:", result);
      setCurrentAttempts(result.attempts);
      toast.success(`Dialing ${result.attempts.length} leads`);
    } catch (error) {
      console.error("[ParallelDialer] Failed to dial next batch:", error);
      const message = error instanceof Error ? error.message : "Failed to dial";
      if (message.includes("No more leads")) {
        toast.error("No more leads to dial in this list");
      } else {
        toast.error(message);
      }
    }
  };

  const handleEnd = async () => {
    if (!currentSessionId) return;

    try {
      // Leave the conference first to disconnect rep's audio
      leaveConference();
      await endSession.mutateAsync(currentSessionId);
      setCurrentAttempts([]);
      setConnectedAttempt(null);
      onSessionEnd?.();
      toast.success("Session ended");
    } catch (error) {
      console.error("Failed to end parallel dial session:", error);
      const message = error instanceof Error ? error.message : "Failed to end session";
      toast.error(message);
    }
  };

  const isLoading = startSession.isPending || endSession.isPending;
  const isDialing = dialNextBatch.isPending;
  const hasActiveCall = currentAttempts.some((a) => ["dialing", "ringing", "connected"].includes(a.status));
  const abandonRate = sessionStats.attempts > 0 ? ((sessionStats.abandoned / sessionStats.attempts) * 100).toFixed(1) : "0";
  const canDialBatch = isInConference && !isDialing && !hasActiveCall && effectiveFromNumber;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-amber-500" />
          <h3 className="font-medium">Parallel Dialer</h3>
        </div>
        <div className="flex items-center gap-2">
          {isSessionActive && (
            <div className="flex items-center gap-2">
              {isInConference ? (
                <span className="flex items-center gap-1.5 text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-full">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs bg-amber-500/10 text-amber-500 px-2 py-1 rounded-full">
                  <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  Connecting...
                </span>
              )}
            </div>
          )}
          {/* Line count selector */}
          <div className="relative">
            <button
              onClick={() => !isSessionActive && setShowLineSelector(!showLineSelector)}
              disabled={isSessionActive}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-muted border border-border rounded-md hover:border-foreground/20 transition-colors disabled:opacity-50"
            >
              <span>{lineCount} lines</span>
              {!isSessionActive && <ChevronDown className="w-3 h-3" />}
            </button>
            {showLineSelector && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10 min-w-20">
                {[2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setLineCount(num);
                      setShowLineSelector(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                      lineCount === num ? "bg-muted" : ""
                    }`}
                  >
                    {num} lines
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isSessionActive ? (
        <div className="p-4">
          <p className="text-sm text-muted-foreground mb-4">
            Dial multiple leads simultaneously. First to answer gets connected.
          </p>

          {/* Phone number selector */}
          {clientId && (
            <div className="mb-4">
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Caller ID
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowPhoneSelector(!showPhoneSelector)}
                  disabled={isLoadingNumbers || !dialableNumbers?.length}
                  className="w-full flex items-center justify-between px-3 py-2 bg-muted border border-border rounded-md hover:border-foreground/20 transition-colors disabled:opacity-50"
                >
                  <span className="font-mono text-sm">
                    {effectiveFromNumber || (isLoadingNumbers ? "Loading..." : "No numbers available")}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showPhoneSelector ? "rotate-180" : ""}`} />
                </button>
                {showPhoneSelector && dialableNumbers && dialableNumbers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                    {dialableNumbers.map((num) => (
                      <button
                        key={num.phoneNumber}
                        onClick={() => {
                          setSelectedFromNumber(num.phoneNumber);
                          setShowPhoneSelector(false);
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-muted transition-colors ${
                          effectiveFromNumber === num.phoneNumber ? "bg-muted" : ""
                        }`}
                      >
                        <div className="font-mono text-sm">{num.phoneNumber}</div>
                        {num.friendlyName && (
                          <div className="text-xs text-muted-foreground">{num.friendlyName}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-500">
              Abandoned calls will be tracked for compliance. Ensure you have proper consent to call these leads.
            </p>
          </div>

          {/* Start button */}
          <button
            onClick={handleStart}
            disabled={isLoading || !listId || (!!clientId && !effectiveFromNumber) || !isDeviceReady}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Phone className="w-5 h-5" />
            )}
            {!isDeviceReady ? "Initializing..." : "Start Session"}
          </button>
        </div>
      ) : (
        <>
          {/* Active attempts display */}
          <div className="divide-y divide-border">
            {currentAttempts.length > 0 ? (
              currentAttempts.map((attempt, index) => {
                const status = statusConfig[attempt.status as AttemptStatus] || statusConfig.pending;
                const isConnected = attempt.status === "connected";

                return (
                  <div
                    key={attempt.id}
                    className={`p-3 ${isConnected ? "bg-green-500/5" : ""}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className={`w-2.5 h-2.5 rounded-full ${status.color}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Line {index + 1}</span>
                            {attempt.leadName && (
                              attempt.leadId ? (
                                <Link
                                  href={`/dashboard/leads/${attempt.leadId}`}
                                  className="font-medium text-sm truncate hover:text-primary hover:underline transition-colors"
                                >
                                  {attempt.leadName}
                                </Link>
                              ) : (
                                <span className="font-medium text-sm truncate">{attempt.leadName}</span>
                              )
                            )}
                          </div>
                          {attempt.leadCompany && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Building2 className="w-3 h-3" />
                              <span className="truncate">{attempt.leadCompany}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs">
                        {status.icon}
                        <span className={isConnected ? "text-green-500 font-medium" : "text-muted-foreground"}>
                          {status.label}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              // Empty state - show placeholder lines
              Array.from({ length: lineCount }).map((_, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                    <div className="flex-1">
                      <span className="text-xs text-muted-foreground">Line {i + 1}</span>
                      <div className="text-sm text-muted-foreground">Ready to dial</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Connected lead banner */}
          {connectedAttempt && (
            <div className="p-3 bg-green-500/10 border-t border-green-500/20">
              <div className="flex items-center gap-2 text-green-600">
                <PhoneCall className="w-4 h-4" />
                <span className="font-medium text-sm">
                  Connected to{" "}
                  {connectedAttempt.leadId ? (
                    <Link
                      href={`/dashboard/leads/${connectedAttempt.leadId}`}
                      className="hover:underline"
                    >
                      {connectedAttempt.leadName || "Lead"}
                    </Link>
                  ) : (
                    connectedAttempt.leadName || "Lead"
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="p-3 bg-muted/50 border-t border-border">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{sessionStats.attempts} attempted</span>
              <span className="text-green-500">{sessionStats.connects} connected</span>
              <span className={Number(abandonRate) > 3 ? "text-red-500" : ""}>
                {abandonRate}% abandoned
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="p-4 flex gap-2 border-t border-border">
            <button
              onClick={handleEnd}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-md transition-colors disabled:opacity-50"
            >
              {endSession.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PhoneOff className="w-4 h-4" />
              )}
              Stop Session
            </button>
            <button
              onClick={handleDialNextBatch}
              disabled={!canDialBatch}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-md transition-colors disabled:opacity-50"
            >
              {isDialing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Phone className="w-4 h-4" />
              )}
              {!isInConference ? "Connecting..." : hasActiveCall ? "Calls Active..." : "Dial Next Batch"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

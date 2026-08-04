"use client";

import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOff,
  Clock,
  Building,
  Mic,
  MicOff,
  User,
  Loader2,
  Grid3X3,
  Delete,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useInboundCalls } from "@/hooks/api/useCalls";
import { DispositionSelector } from "./DispositionSelector";
import { VoicemailDropButton } from "./VoicemailDropButton";
import { useDispositions } from "@/hooks/api/useCalls";
import { useActiveOrganization } from "@/lib/auth-client";
import { useLookupLead } from "@/hooks/api/useLeads";
import type { Call } from "@telnyx/webrtc";

interface LeadInfo {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  linkedInUrl?: string | null;
  email?: string | null;
}

type CallState = "idle" | "initiated" | "ringing" | "in-progress" | "completed" | "failed";

interface InboundCallsPanelProps {
  // Dialer state passed from parent
  incomingCall: Call | null;
  connection: Call | null;
  callState: CallState;
  currentCallId: string | null;
  isReady: boolean;
  // Dialer actions
  answerIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  initializeDevice: () => Promise<boolean>;
  // Callback for calling back
  onCallBack?: (phoneNumber: string, leadId?: string) => void;
}

export function InboundCallsPanel({
  incomingCall,
  connection,
  callState,
  currentCallId,
  isReady,
  answerIncomingCall,
  rejectIncomingCall,
  endCall,
  toggleMute,
  initializeDevice,
  onCallBack,
}: InboundCallsPanelProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showDisposition, setShowDisposition] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [showDialpad, setShowDialpad] = useState(false);
  const [dtmfDigits, setDtmfDigits] = useState("");
  const [currentLeadInfo, setCurrentLeadInfo] = useState<LeadInfo | null>(null);

  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  const { data: dispositions } = useDispositions(!!organizationId);
  const { data, isLoading } = useInboundCalls();
  const calls = data?.data || [];
  const lookupLead = useLookupLead();

  // Track previous call state for transition handling
  const prevCallStateRef = useRef(callState);

  // Look up lead when incoming call arrives
  useEffect(() => {
    const callerNumber = incomingCall?.options?.remoteCallerNumber || connection?.options?.remoteCallerNumber;
    if (callerNumber && (incomingCall || callState !== "idle")) {
      lookupLead.mutate(callerNumber, {
        onSuccess: (data) => {
          if (data) {
            setCurrentLeadInfo(data as LeadInfo);
          }
        },
        onError: () => {
          setCurrentLeadInfo(null);
        },
      });
    } else if (callState === "idle") {
      setCurrentLeadInfo(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingCall, connection?.options?.remoteCallerNumber, callState]);

  // Call duration timer
  useEffect(() => {
    const prevCallState = prevCallStateRef.current;
    prevCallStateRef.current = callState;

    let timer: NodeJS.Timeout;
    if (callState === "in-progress") {
      if (prevCallState !== "in-progress") {
        // Reset duration when call starts
        setCallDuration(0);
      }
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    // Handle state transitions
    if (prevCallState !== callState) {
      if (callState === "idle") {
        queueMicrotask(() => {
          setCallDuration(0);
          setShowDisposition(false);
          setIsMuted(false);
          setDtmfDigits("");
          setShowDialpad(false);
        });
      } else if (callState === "completed" && prevCallState === "in-progress") {
        queueMicrotask(() => setShowDisposition(true));
      }
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Initialize device when user wants to answer
  const handleAnswer = async () => {
    if (!isReady) {
      setIsInitializing(true);
      try {
        await initializeDevice();
      } finally {
        setIsInitializing(false);
      }
    }
    answerIncomingCall();
  };

  const handleToggleMute = () => {
    toggleMute();
    setIsMuted(!isMuted);
  };

  const handleEndCall = async () => {
    await endCall();
  };

  const handleDispositionSelect = () => {
    setShowDisposition(false);
  };

  const handleDialpadPress = (digit: string) => {
    if (connection) {
      connection.dtmf(digit);
      setDtmfDigits((prev) => prev + digit);
    }
  };

  const handleDialpadDelete = () => {
    setDtmfDigits((prev) => prev.slice(0, -1));
  };

  const handleDialpadClear = () => {
    setDtmfDigits("");
  };

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return (
      date.toLocaleDateString([], { month: "short", day: "numeric" }) +
      " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-500 bg-green-500/10";
      case "missed":
        return "text-red-500 bg-red-500/10";
      case "ringing":
        return "text-yellow-500 bg-yellow-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "missed":
        return <PhoneMissed className="w-4 h-4" />;
      default:
        return <PhoneIncoming className="w-4 h-4" />;
    }
  };

  const isCallActive = callState === "ringing" || callState === "in-progress";
  const callerNumber = incomingCall?.options?.remoteCallerNumber || connection?.options?.remoteCallerNumber || "Unknown";

  return (
    <div className="space-y-6">
      {/* Active Incoming Call Section */}
      {(incomingCall || isCallActive) && (
        <div className="bg-card border-2 border-green-500/50 rounded-2xl p-6">
          {/* Recording indicator */}
          {callState === "in-progress" && (
            <div className="flex items-center justify-center gap-2 py-2 bg-red-500/10 text-red-500 rounded-lg mb-4">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium">Recording Active</span>
            </div>
          )}

          {/* Caller info */}
          <div className="text-center mb-6">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${
                callState === "in-progress" ? "bg-green-500/20" : "bg-primary/20 animate-pulse"
              }`}
            >
              <User className={`w-10 h-10 ${callState === "in-progress" ? "text-green-500" : "text-primary"}`} />
            </div>

            {incomingCall && callState !== "in-progress" && (
              <div className="flex items-center justify-center gap-2 mb-2">
                <Phone className="w-5 h-5 text-green-500 animate-bounce" />
                <span className="text-sm font-medium text-green-500">Incoming Call</span>
              </div>
            )}

            {callState === "in-progress" && (
              <div className="mb-2">
                <span className="text-4xl font-mono text-foreground">{formatDuration(callDuration)}</span>
                <p className="text-sm text-green-500 mt-1">Connected</p>
              </div>
            )}

            {currentLeadInfo ? (
              <>
                <p className="text-2xl font-bold text-foreground">
                  {[currentLeadInfo.firstName, currentLeadInfo.lastName].filter(Boolean).join(" ") || callerNumber}
                </p>
                {currentLeadInfo.company && (
                  <p className="text-muted-foreground flex items-center justify-center gap-2">
                    <Building className="w-4 h-4" />
                    {currentLeadInfo.company}
                  </p>
                )}
                <p className="text-sm font-mono text-muted-foreground">{callerNumber}</p>
                <div className="flex items-center justify-center gap-4 mt-2">
                  <Link
                    href={`/dashboard/leads/${currentLeadInfo.id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <User className="w-3.5 h-3.5" />
                    View Lead
                  </Link>
                  {currentLeadInfo.linkedInUrl && (
                    <a
                      href={currentLeadInfo.linkedInUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                      </svg>
                      LinkedIn
                    </a>
                  )}
                  {currentLeadInfo.email && (
                    <a
                      href={`https://${currentLeadInfo.email.split("@")[1]}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      {currentLeadInfo.email.split("@")[1]}
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="text-2xl font-mono font-bold text-foreground">{callerNumber}</p>
                <p className="text-muted-foreground">Inbound Call</p>
              </>
            )}
          </div>

          {/* DTMF Dialpad - only shown during active calls */}
          {callState === "in-progress" && (
            <div className="mb-6">
              <button
                onClick={() => setShowDialpad(!showDialpad)}
                className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition py-2"
              >
                <Grid3X3 className="w-4 h-4" />
                {showDialpad ? "Hide keypad" : "Show keypad for DTMF"}
              </button>
              {showDialpad && (
                <div className="mt-3 max-w-xs mx-auto">
                  {/* DTMF Display */}
                  <div className="relative mb-3">
                    <div className="flex items-center justify-between bg-muted/50 border border-border rounded-xl px-4 py-3">
                      <span className="font-mono text-xl tracking-widest text-foreground min-h-[1.75rem] flex-1">
                        {dtmfDigits || <span className="text-muted-foreground text-base">Enter digits...</span>}
                      </span>
                      {dtmfDigits && (
                        <div className="flex items-center gap-1 ml-2">
                          <button
                            onClick={handleDialpadDelete}
                            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                            title="Delete last digit"
                          >
                            <Delete className="w-5 h-5" />
                          </button>
                          <button
                            onClick={handleDialpadClear}
                            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition"
                            title="Clear all"
                          >
                            Clear
                          </button>
                        </div>
                      )}
                    </div>
                    {dtmfDigits && (
                      <p className="text-xs text-muted-foreground mt-1 text-center">
                        {dtmfDigits.length} digit{dtmfDigits.length !== 1 ? "s" : ""} sent
                      </p>
                    )}
                  </div>

                  {/* Dialpad Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                      <button
                        key={digit}
                        onClick={() => handleDialpadPress(digit)}
                        className="py-4 text-xl font-medium bg-muted hover:bg-muted/80 rounded-xl transition active:scale-95 active:bg-primary/20"
                      >
                        {digit}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Call controls */}
          <div className="flex items-center justify-center gap-4">
            {callState === "in-progress" ? (
              <>
                {/* Mute button */}
                <button
                  onClick={handleToggleMute}
                  className={`p-4 rounded-full transition ${
                    isMuted ? "bg-yellow-500 text-white" : "bg-muted hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Voicemail drop button */}
                <VoicemailDropButton callId={currentCallId} disabled={callState !== "in-progress"} />

                {/* End call button */}
                <button
                  onClick={handleEndCall}
                  className="p-5 bg-red-500 hover:bg-red-600 text-white rounded-full transition"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>
              </>
            ) : incomingCall ? (
              <>
                {/* Decline button */}
                <button
                  onClick={rejectIncomingCall}
                  className="p-5 bg-red-500 hover:bg-red-600 text-white rounded-full transition shadow-lg shadow-red-500/30"
                >
                  <PhoneOff className="w-8 h-8" />
                </button>

                {/* Answer button */}
                <button
                  onClick={handleAnswer}
                  disabled={isInitializing}
                  className="p-5 bg-green-500 hover:bg-green-600 text-white rounded-full transition shadow-lg shadow-green-500/30 animate-pulse disabled:opacity-50"
                >
                  {isInitializing ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Phone className="w-8 h-8" />
                  )}
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}

      {/* No active call - show waiting state */}
      {!incomingCall && !isCallActive && (
        <div className="bg-card border border-border rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <PhoneIncoming className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Waiting for Calls</h3>
          <p className="text-muted-foreground text-sm">
            Incoming calls will appear here. Make sure your Telnyx number is configured to route calls to this
            application.
          </p>
          {!isReady && (
            <p className="text-xs text-amber-500 mt-2">
              Device not connected - will initialize when a call arrives
            </p>
          )}
        </div>
      )}

      {/* Call History */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recent Inbound Calls</h2>
          </div>
          {!isLoading && <span className="text-sm text-muted-foreground">{calls.length} calls</span>}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : calls.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No inbound call history yet</div>
        ) : (
          <div className="space-y-2">
            {calls.map(
              (call: {
                id: string;
                fromNumber: string;
                toNumber: string;
                status: string;
                duration?: number;
                startedAt: string;
                leadId?: string | null;
                leadFirstName?: string | null;
                leadLastName?: string | null;
              }) => {
                const hasLead = !!call.leadId;
                const cardContent = (
                  <>
                    <div className="flex items-center gap-4">
                      {/* Status Icon */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${getStatusColor(call.status)}`}
                      >
                        {getStatusIcon(call.status)}
                      </div>

                      {/* Caller Info */}
                      <div>
                        {(call.leadFirstName || call.leadLastName) ? (
                          <>
                            <p className="font-medium">
                              {[call.leadFirstName, call.leadLastName].filter(Boolean).join(" ")}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">{call.fromNumber}</p>
                          </>
                        ) : (
                          <>
                            <p className="font-mono font-medium">{call.fromNumber}</p>
                            <p className="text-sm text-muted-foreground">Unknown caller</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Right side - Time, Duration, Actions */}
                    <div className="flex items-center gap-4">
                      {/* Duration & Time */}
                      <div className="text-right">
                        <p className="text-sm font-mono">{call.duration ? formatDuration(call.duration) : "--:--"}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {formatTime(call.startedAt)}
                        </p>
                      </div>

                      {/* Call Back Button */}
                      {onCallBack && (
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onCallBack(call.fromNumber, call.leadId ?? undefined);
                          }}
                          className="flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm relative z-10"
                        >
                          <Phone className="w-4 h-4" />
                          Call Back
                        </button>
                      )}
                    </div>
                  </>
                );

                return hasLead ? (
                  <Link
                    key={call.id}
                    href={`/dashboard/leads/${call.leadId}`}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition cursor-pointer"
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <div
                    key={call.id}
                    className="flex items-center justify-between p-4 bg-card border border-border rounded-xl hover:bg-muted/50 transition"
                  >
                    {cardContent}
                  </div>
                );
              }
            )}
          </div>
        )}
      </div>

      {/* Disposition modal */}
      {showDisposition && currentCallId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl p-6 max-w-md w-full mx-4 border border-border">
            <h3 className="text-lg font-semibold mb-4">Set Call Status</h3>
            <DispositionSelector
              callId={currentCallId}
              dispositions={dispositions?.data || []}
              onSelect={handleDispositionSelect}
            />
          </div>
        </div>
      )}
    </div>
  );
}

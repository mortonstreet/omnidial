"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Phone, PhoneOff, MicOff, Mic, ChevronDown, Loader2, ShieldCheck, ShieldAlert, Building2 } from "lucide-react";
import { DispositionSelector } from "./DispositionSelector";
import { VoicemailDropButton } from "./VoicemailDropButton";
import { useTwilioPhoneNumbers } from "@/hooks/api/useDialer";
import { useDialablePhoneNumbers } from "@/hooks/api/usePhoneNumberAssignments";
import { useDispositions } from "@/hooks/api/useCalls";
import { useActiveOrganization } from "@/lib/auth-client";
import { useDialerContext } from "@/components/providers/DialerProvider";
import { toast } from "sonner";

interface DialerClient {
  id: string;
  name: string;
}

interface DialerPanelProps {
  phoneNumber?: string;
  leadId?: string;
  campaignId?: string;
  clientId?: string; // Optional: filter phone numbers by assigned client
  clients?: DialerClient[]; // Available clients for selection (manual dialer mode)
  onClientChange?: (clientId: string | undefined) => void; // Callback when client changes
  onCallEnd?: () => void;
  dialTrigger?: number; // Counter that triggers auto-dial when incremented (separate from display)
}

export function DialerPanel({ phoneNumber, leadId, campaignId, clientId, clients, onClientChange, onCallEnd, dialTrigger }: DialerPanelProps) {
  const [dialNumber, setDialNumber] = useState(phoneNumber || "");
  const [selectedFromNumber, setSelectedFromNumber] = useState<string>("");
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [showDisposition, setShowDisposition] = useState(false);
  const [showNumberSelector, setShowNumberSelector] = useState(false);
  const [showClientSelector, setShowClientSelector] = useState(false);
  const [showDtmfKeypad, setShowDtmfKeypad] = useState(false);
  const [shouldAutoDial, setShouldAutoDial] = useState(false);
  const [isDialing, setIsDialing] = useState(false); // Prevent rapid dialing

  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  const {
    device,
    connection,
    callState,
    currentCallId,
    isReady,
    initializeDevice,
    makeCall,
    endCall,
    toggleMute,
  } = useDialerContext();

  const { data: dispositions } = useDispositions(!!organizationId);

  // Fetch phone numbers - filtered by client if clientId is provided
  // Use dialable phone numbers when clientId is provided (respects client assignments)
  const { data: dialableNumbers, isLoading: dialableNumbersLoading } = useDialablePhoneNumbers(
    organizationId,
    clientId
  );
  // Fall back to all Twilio numbers when no clientId (for admin/testing scenarios)
  const { data: allPhoneNumbers, isLoading: allNumbersLoading } = useTwilioPhoneNumbers(
    organizationId,
    !clientId // Only fetch all numbers when no clientId is provided
  );

  // Use dialable numbers when clientId is provided, otherwise use all phone numbers
  const phoneNumbers = clientId ? dialableNumbers : allPhoneNumbers;
  const phoneNumbersLoading = clientId ? dialableNumbersLoading : allNumbersLoading;

  // Reset selected number when clientId changes (different numbers available)
  useEffect(() => {
    queueMicrotask(() => setSelectedFromNumber(""));
  }, [clientId]);

  // Set default from number when phone numbers are loaded (defer to avoid sync setState in effect)
  useEffect(() => {
    if (phoneNumbers && phoneNumbers.length > 0 && !selectedFromNumber) {
      queueMicrotask(() => setSelectedFromNumber(phoneNumbers[0].phoneNumber));
    }
  }, [phoneNumbers, selectedFromNumber]);

  // Update dial number when phoneNumber prop changes (for display only, doesn't trigger dial)
  useEffect(() => {
    if (phoneNumber !== undefined && phoneNumber !== dialNumber) {
      queueMicrotask(() => {
        setDialNumber(phoneNumber);
        // Don't auto-dial here - wait for dialTrigger
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneNumber]);

  // Track dial trigger to initiate auto-dial when explicitly requested
  const prevDialTriggerRef = useRef(dialTrigger);
  useEffect(() => {
    if (dialTrigger !== undefined && dialTrigger > (prevDialTriggerRef.current || 0)) {
      prevDialTriggerRef.current = dialTrigger;
      // Only trigger auto-dial if we have a phone number
      if (dialNumber) {
        setShouldAutoDial(true);
      }
    }
  }, [dialTrigger, dialNumber]);

  // Auto-dial when triggered by power dialer
  useEffect(() => {
    const autoDial = async () => {
      if (!shouldAutoDial || !dialNumber || callState !== "idle" || isDialing) {
        return;
      }

      setShouldAutoDial(false);
      setIsDialing(true);

      try {
        if (!selectedFromNumber) {
          toast.error("Caller ID required", {
            description: "Select a caller ID before starting auto-dial",
          });
          setIsDialing(false);
          return;
        }

        // Request microphone permission first (ensures AudioContext is from user gesture)
        console.log("Auto-dial: Requesting microphone permission...");
        await navigator.mediaDevices.getUserMedia({ audio: true });

        // Initialize device if not ready
        if (!device || !isReady) {
          console.log("Auto-dial: Initializing Twilio device...");
          const success = await initializeDevice();
          if (!success) {
            console.error("Auto-dial: Failed to initialize device");
            setIsDialing(false);
            return;
          }
        }

        // Small delay to ensure device is fully ready
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log("Auto-dial: Making call to", dialNumber);
        await makeCall(dialNumber, leadId, campaignId, selectedFromNumber);
      } catch (err) {
        console.error("Auto-dial failed:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error("Auto-dial failed", {
          description: message,
        });
      } finally {
        setIsDialing(false);
      }
    };
    autoDial();
  }, [shouldAutoDial, dialNumber, callState, isReady, device, leadId, campaignId, selectedFromNumber, makeCall, initializeDevice, isDialing]);

  // Don't auto-initialize - device will be initialized on first call attempt
  // This ensures AudioContext is created from a user gesture (click)

  // Track previous call state for transition handling
  const prevCallStateRef = useRef(callState);

  // Call duration timer with state transition handling
  useEffect(() => {
    const prevCallState = prevCallStateRef.current;
    prevCallStateRef.current = callState;

    // Timer for in-progress calls - reset duration when starting
    let timer: NodeJS.Timeout;
    if (callState === "in-progress") {
      if (prevCallState !== "in-progress") {
        // Reset duration when call starts
        timer = setInterval(() => {
          setCallDuration((prev) => prev === 0 ? 1 : prev + 1);
        }, 1000);
      } else {
        timer = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      }
    }

    // Handle state transitions via microtask to avoid sync setState in effect
    if (prevCallState !== callState) {
      if (callState === "idle") {
        queueMicrotask(() => {
          setCallDuration(0);
          setShowDisposition(false);
        });
      } else if (callState === "initiated" || callState === "ringing") {
        // Reset disposition when starting a new call
        queueMicrotask(() => setShowDisposition(false));
      } else if (callState === "completed" && prevCallState === "in-progress") {
        // Only show disposition if transitioning from in-progress (actual call ended)
        queueMicrotask(() => setShowDisposition(true));
      }
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleCall = useCallback(async () => {
    if (callState === "idle" && dialNumber && !isDialing) {
      // Reset disposition state before starting a new call
      setShowDisposition(false);
      setIsDialing(true);

      if (!selectedFromNumber) {
        toast.error("Caller ID required", {
          description: "Select a caller ID before placing a call",
        });
        setIsDialing(false);
        return;
      }

      try {
        // Request microphone permission first (ensures AudioContext is from user gesture)
        console.log("Requesting microphone permission...");
        await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone permission granted");
      } catch (err) {
        console.error("Microphone permission denied:", err);
        toast.error("Microphone access required", {
          description: "Please allow microphone access to make calls",
        });
        setIsDialing(false);
        return;
      }

      // Initialize device on first call
      if (!device || !isReady) {
        console.log("Initializing Twilio device...");
        const success = await initializeDevice();
        if (!success) {
          console.error("Failed to initialize device");
          toast.error("Failed to connect to dialer", {
            description: "Please check your Telnyx configuration and try again",
          });
          setIsDialing(false);
          return;
        }
        console.log("Device initialized successfully");
      }

      try {
        await makeCall(dialNumber, leadId, campaignId, selectedFromNumber);
      } catch (err) {
        console.error("Failed to make call:", err);
        const message = err instanceof Error ? err.message : "Unknown error";
        toast.error("Failed to place call", {
          description: message,
        });
      } finally {
        setIsDialing(false);
      }
    }
  }, [callState, dialNumber, leadId, campaignId, makeCall, selectedFromNumber, device, isReady, initializeDevice, isDialing]);

  const handleEndCall = useCallback(async () => {
    try {
      await endCall();
    } catch (err) {
      console.error("Failed to end call:", err);
      toast.error("Failed to end call", {
        description: "The call may have already ended",
      });
    }
  }, [endCall]);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    setIsMuted(!isMuted);
  }, [toggleMute, isMuted]);

  const handleDispositionSelect = useCallback((_dispositionId: string) => {
    setShowDisposition(false);
    onCallEnd?.();
  }, [onCallEnd]);

  const handleDialpadPress = (digit: string) => {
    if (connection) {
      connection.dtmf(digit);
    } else {
      setDialNumber((prev) => prev + digit);
    }
  };

  const isCallActive = callState === "ringing" || callState === "in-progress";
  const selectedClient = clients?.find(c => c.id === clientId);
  const hasClients = clients && clients.length > 0;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header - only show when clients available */}
      {hasClients && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-emerald-500" />
            <h3 className="font-medium">Manual Dialer</h3>
          </div>
          {/* Client selector - compact dropdown in header */}
          <div className="relative">
            <button
              onClick={() => !isCallActive && setShowClientSelector(!showClientSelector)}
              disabled={isCallActive}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted border border-border rounded-lg hover:border-foreground/20 transition-colors disabled:opacity-50"
            >
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="max-w-32 truncate">{selectedClient?.name || "Select client"}</span>
              {!isCallActive && <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showClientSelector ? 'rotate-180' : ''}`} />}
            </button>
            {showClientSelector && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-20 min-w-48 max-h-60 overflow-y-auto">
                <button
                  onClick={() => {
                    onClientChange?.(undefined);
                    setShowClientSelector(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${!clientId ? 'bg-muted' : ''}`}
                >
                  <span className="text-muted-foreground">All numbers</span>
                </button>
                {clients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      onClientChange?.(client.id);
                      setShowClientSelector(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${clientId === client.id ? 'bg-muted' : ''}`}
                  >
                    {client.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="p-4">
        {/* Recording indicator - during call */}
        {isCallActive && (
          <div className="flex items-center justify-center mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-recording-pulse" aria-hidden="true" />
              <span className="text-xs text-red-400 uppercase tracking-wide font-medium">Recording</span>
            </div>
          </div>
        )}

        {/* Call duration display */}
        <div className="flex justify-center mb-4">
          <div className={`bg-muted/50 rounded-xl px-6 py-3 transition-all duration-300 ${
            callState === "in-progress" ? "dialer-glow-active" : ""
          }`}>
            <div className="text-3xl font-mono text-foreground tabular-nums tracking-tight text-center">
              {formatDuration(callDuration)}
            </div>
            {callState !== "idle" && (
              <div className="text-xs text-muted-foreground mt-1 text-center capitalize">
                {callState.replace("-", " ")}
              </div>
            )}
          </div>
        </div>

        {/* Caller ID selector - only when not in call */}
        {!isCallActive && (
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Caller ID
            </label>
            {phoneNumbersLoading ? (
              <div className="flex items-center justify-center py-3 bg-muted border border-border rounded-lg">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : phoneNumbers && phoneNumbers.length > 0 ? (
              <div className="relative">
                <button
                  onClick={() => setShowNumberSelector(!showNumberSelector)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-muted border border-border rounded-lg hover:border-foreground/20 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm truncate">
                      {selectedFromNumber || "Select number"}
                    </span>
                    {(() => {
                      const selectedPhone = phoneNumbers.find((p: { phoneNumber: string }) => p.phoneNumber === selectedFromNumber);
                      if (!selectedPhone || !selectedFromNumber) return null;
                      return selectedPhone.callerIdVerified ? (
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      );
                    })()}
                  </div>
                  <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${showNumberSelector ? 'rotate-180' : ''}`} />
                </button>
                {showNumberSelector && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                    {phoneNumbers.map((phone: { phoneNumber: string; friendlyName: string; locality: string | null; region: string | null; callerIdVerified?: boolean }) => (
                      <button
                        key={phone.phoneNumber}
                        onClick={() => {
                          setSelectedFromNumber(phone.phoneNumber);
                          setShowNumberSelector(false);
                        }}
                        className={`w-full px-3 py-2 text-left hover:bg-muted transition-colors ${
                          selectedFromNumber === phone.phoneNumber ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{phone.phoneNumber}</span>
                          {phone.callerIdVerified ? (
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                          )}
                        </div>
                        {phone.friendlyName && (
                          <div className="text-xs text-muted-foreground mt-0.5">{phone.friendlyName}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="px-3 py-2.5 bg-muted border border-border rounded-lg">
                <span className="text-sm text-amber-500">
                  {clientId ? "No numbers assigned" : "No numbers available"}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Phone number input with integrated call button */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              {isCallActive ? "Connected to" : "Phone number"}
            </label>
            <div className="relative">
              <input
                type="tel"
                value={dialNumber}
                onChange={(e) => setDialNumber(e.target.value)}
                disabled={isCallActive}
                placeholder="+1 (555) 123-4567"
                aria-label="Phone number to dial"
                className="w-full h-14 sm:h-12 text-center text-xl sm:text-lg font-mono tracking-wide px-4 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 disabled:opacity-50 transition-all"
              />
              {!isCallActive && dialNumber && (
                <button
                  onClick={() => setDialNumber("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                  aria-label="Clear phone number"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="15" y1="9" x2="9" y2="15"></line>
                    <line x1="9" y1="9" x2="15" y2="15"></line>
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Call action button - full width emerald style matching Start Session */}
          {isCallActive ? (
            <div className="space-y-3">
              {/* In-call controls */}
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleToggleMute}
                  aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
                  aria-pressed={isMuted}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
                    isMuted
                      ? "bg-amber-500 text-white"
                      : "bg-muted border border-border hover:bg-muted/80 text-foreground"
                  }`}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {isMuted ? "Unmute" : "Mute"}
                </button>
                <VoicemailDropButton
                  callId={currentCallId}
                  disabled={callState !== "in-progress"}
                />
              </div>

              {/* DTMF Keypad toggle */}
              <button
                onClick={() => setShowDtmfKeypad(!showDtmfKeypad)}
                className="w-full text-sm text-muted-foreground hover:text-foreground transition py-2"
              >
                {showDtmfKeypad ? "Hide keypad" : "Show keypad"}
              </button>
              {showDtmfKeypad && (
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((digit) => (
                    <button
                      key={digit}
                      onClick={() => handleDialpadPress(digit)}
                      className="h-14 sm:h-12 text-lg font-mono font-medium bg-card border border-border rounded-lg hover:bg-muted active:scale-95 transition-all"
                    >
                      {digit}
                    </button>
                  ))}
                </div>
              )}

              {/* End call button */}
              <button
                onClick={handleEndCall}
                aria-label="End call"
                className="w-full flex items-center justify-center gap-2 px-4 py-4 sm:py-3 min-h-[56px] sm:min-h-0 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </button>
            </div>
          ) : (
            <button
              onClick={handleCall}
              disabled={!dialNumber || !selectedFromNumber || isDialing}
              aria-label={isDialing ? "Dialing..." : "Start call"}
              className="w-full flex items-center justify-center gap-2 px-4 py-4 sm:py-3 min-h-[56px] sm:min-h-0 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDialing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Phone className="w-5 h-5" />
              )}
              {isDialing ? "Connecting..." : "Call"}
            </button>
          )}
        </div>
      </div>

      {/* Call status selector modal */}
      {showDisposition && currentCallId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-md w-full mx-4 border border-border">
            <h3 className="text-lg font-medium mb-4">Set Call Status</h3>
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

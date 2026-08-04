"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TelnyxRTC, Call, INotification } from "@telnyx/webrtc";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import { useDialerConfig } from "@/hooks/api/useDialer";
import type { CapabilityTokenResponse } from "@shared/types/src";

type CallState = "idle" | "initiated" | "ringing" | "in-progress" | "completed" | "failed";
type TelnyxConnection = Call;

const REMOTE_AUDIO_ELEMENT_ID = "remote-audio";

// Persisted dialer selection state (survives tab switches)
interface DialerSelection {
  clientId?: string;
  campaignId?: string;
  listId?: string;
}

// Parallel dialer session state
interface ParallelDialerSession {
  isActive: boolean;
  sessionId?: string;
  conferenceId?: string;
}

// Current lead info for displaying in floating widget
interface CurrentLeadInfo {
  id: string;
  name: string;
  phone: string;
  // Extended fields for mini widget
  firstName?: string | null;
  lastName?: string | null;
  linkedInUrl?: string | null;
  website?: string | null;
  timezone?: string | null;
  campaignId?: string;  // For navigation
  listId?: string;      // For navigation
}

type InitStep = "authenticating" | "connecting" | "registering" | "ready" | null;

interface DialerContextValue {
  device: TelnyxRTC | null;
  connection: TelnyxConnection | null;
  callState: CallState;
  currentCallId: string | null;
  incomingCall: TelnyxConnection | null;
  isReady: boolean;
  error: string | null;
  isInitializing: boolean;
  initStep: InitStep;
  isInConference: boolean;
  initializeDevice: () => Promise<boolean>;
  makeCall: (toNumber: string, leadId?: string, campaignId?: string, fromNumber?: string) => Promise<void>;
  answerIncomingCall: () => void;
  rejectIncomingCall: () => void;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  joinConference: (conferenceId: string) => Promise<void>;
  leaveConference: () => void;
  setConnection: (conn: TelnyxConnection | null) => void;
  setCallState: (state: CallState) => void;
  setCurrentCallId: (id: string | null) => void;
  setError: (error: string | null) => void;
  // Persisted selection state
  dialerSelection: DialerSelection;
  setDialerSelection: (selection: DialerSelection) => void;
  // Parallel dialer session state
  parallelSession: ParallelDialerSession;
  setParallelSession: (session: ParallelDialerSession | ((prev: ParallelDialerSession) => ParallelDialerSession)) => void;
  // Current lead info (for floating widget display)
  currentLeadInfo: CurrentLeadInfo | null;
  setCurrentLeadInfo: (info: CurrentLeadInfo | null) => void;
  // Widget minimized state (persisted to sessionStorage)
  isWidgetMinimized: boolean;
  setIsWidgetMinimized: (minimized: boolean) => void;
}

const DialerContext = createContext<DialerContextValue | null>(null);

const TOKEN_CACHE_KEY = "omnidial-token";
const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 minutes
// Telnyx has no in-place token update; proactively rebuild the client before the token expires
const TOKEN_REFRESH_MS = 45 * 60 * 1000; // 45 minutes

interface CachedToken {
  token: string;
  expiresAt: number;
  sipDomain?: string | null;
}

// SIP domain of the backend's TeXML application. Browser-originated calls
// dial `sip:callid-<id>@<domain>` so the TeXML voice webhook can route them.
let telnyxSipDomain: string | null = null;

function buildSipDestination(target: string): string {
  return telnyxSipDomain ? `sip:${target}@${telnyxSipDomain}` : target;
}

// Shared AudioContext used purely to unlock browser audio after a user gesture
let sharedAudioContext: AudioContext | null = null;

async function resumeSharedAudioContext() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContext();
    }
    if (sharedAudioContext.state !== "running") {
      await sharedAudioContext.resume();
    }
  } catch (error) {
    console.warn("[Dialer] Unable to resume AudioContext", error);
  }
}

function getCachedToken(): string | null {
  try {
    const raw = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedToken = JSON.parse(raw);
    if (Date.now() >= cached.expiresAt) {
      localStorage.removeItem(TOKEN_CACHE_KEY);
      return null;
    }
    if (cached.sipDomain) {
      telnyxSipDomain = cached.sipDomain;
    }
    return cached.token;
  } catch {
    return null;
  }
}

function setCachedToken(token: string, sipDomain?: string | null) {
  if (sipDomain !== undefined) {
    telnyxSipDomain = sipDomain;
  }
  try {
    const data: CachedToken = {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      sipDomain: telnyxSipDomain,
    };
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be unavailable
  }
}

function clearCachedToken() {
  try {
    localStorage.removeItem(TOKEN_CACHE_KEY);
  } catch {
    // noop
  }
}

export function useDialerContext() {
  const context = useContext(DialerContext);
  if (!context) {
    throw new Error("useDialerContext must be used within a DialerProvider");
  }
  return context;
}

export function DialerProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<TelnyxRTC | null>(null);
  const [connection, setConnection] = useState<TelnyxConnection | null>(null);
  const [callState, setCallState] = useState<CallState>("idle");
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<TelnyxConnection | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [initStep, setInitStep] = useState<InitStep>(null);
  const [isInConference, setIsInConference] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Persisted selection state (survives tab switches within dialer)
  const [dialerSelection, setDialerSelection] = useState<DialerSelection>({});

  // Parallel dialer session state
  const [parallelSession, setParallelSession] = useState<ParallelDialerSession>({
    isActive: false,
  });

  // Current lead info for floating widget display
  const [currentLeadInfo, setCurrentLeadInfo] = useState<CurrentLeadInfo | null>(null);

  // Widget minimized state - persisted to sessionStorage
  const WIDGET_MINIMIZED_KEY = "floating-dialer-minimized";
  const [isWidgetMinimized, setIsWidgetMinimizedState] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(WIDGET_MINIMIZED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const setIsWidgetMinimized = useCallback((minimized: boolean) => {
    setIsWidgetMinimizedState(minimized);
    try {
      sessionStorage.setItem(WIDGET_MINIMIZED_KEY, String(minimized));
    } catch {
      // Ignore storage errors
    }
  }, []);

  const deviceRef = useRef<TelnyxRTC | null>(null);
  const queryClient = useQueryClient();

  const activeOrganization = useActiveOrganization();
  const organizationId = activeOrganization?.data?.id;

  // Keep a ref so closures always read the latest organizationId
  const organizationIdRef = useRef(organizationId);
  organizationIdRef.current = organizationId;

  // Check if dialer is configured
  const { data: dialerConfig } = useDialerConfig(organizationId);

  // Fetch capability token
  const { refetch: refetchToken } = useQuery({
    queryKey: QUERY_KEYS.dialerToken(),
    queryFn: async () => {
      const response = await get<{ data: CapabilityTokenResponse }>(ENDPOINTS.DIALER.TOKEN);
      return response.data;
    },
    enabled: false,
    staleTime: 1000 * 60 * 50,
  });

  // Track initialization attempts to prevent race conditions
  const initializationPromiseRef = useRef<Promise<boolean> | null>(null);

  // Call tracking refs (Telnyx delivers all call state via telnyx.notification events,
  // so we track the active/incoming call ids and react to state transitions)
  const activeCallIdRef = useRef<string | null>(null);
  const activeCallModeRef = useRef<"call" | "conference" | null>(null);
  const incomingCallIdRef = useRef<string | null>(null);
  const terminatedCallIdsRef = useRef<Set<string>>(new Set());
  const conferencePendingRef = useRef<{
    resolve: () => void;
    reject: (err: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  } | null>(null);
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptInitRef = useRef<((token: string) => Promise<boolean>) | null>(null);

  // Central handler for Telnyx callUpdate notifications (replaces Twilio's per-call events)
  const handleCallUpdate = useCallback((call: Call) => {
    const state = call.state;
    const isInbound = (call.direction as unknown as string) === "inbound";

    // ----- Inbound calls that haven't been answered yet -----
    if (isInbound && call.id !== activeCallIdRef.current) {
      if (state === "hangup" || state === "destroy" || state === "purge") {
        // Caller hung up / call canceled before answer
        if (incomingCallIdRef.current === call.id) {
          incomingCallIdRef.current = null;
          setIncomingCall(null);
          setCallState("idle");
        }
        return;
      }

      if (state === "active" || state === "answering") {
        if (incomingCallIdRef.current === call.id && state === "active") {
          // Incoming call accepted
          incomingCallIdRef.current = null;
          activeCallIdRef.current = call.id;
          activeCallModeRef.current = "call";
          setConnection(call);
          setCallState("in-progress");
          setIncomingCall(null);
        }
        return;
      }

      // Any other pre-answer state ('new', 'ringing', ...) -> show incoming call UI
      if (incomingCallIdRef.current !== call.id) {
        console.log("Incoming call detected");
        incomingCallIdRef.current = call.id;
        setIncomingCall(call);
      }
      return;
    }

    // ----- Active (outbound or answered) call -----
    if (call.id !== activeCallIdRef.current) return;
    if (terminatedCallIdsRef.current.has(call.id)) return;

    const mode = activeCallModeRef.current;

    switch (state) {
      case "ringing":
      case "early": {
        if (mode === "call") {
          console.log("Call ringing");
          setCallState("ringing");
        }
        break;
      }
      case "active": {
        if (mode === "conference") {
          const pending = conferencePendingRef.current;
          console.log("[DialerProvider] Conference call accepted - connected!");
          setCallState("in-progress");
          setIsInConference(true);
          if (pending) {
            clearTimeout(pending.timeout);
            conferencePendingRef.current = null;
            pending.resolve();
          }
        } else {
          console.log("Call accepted");
          setCallState("in-progress");
        }
        break;
      }
      case "hangup":
      case "destroy": {
        terminatedCallIdsRef.current.add(call.id);
        if (terminatedCallIdsRef.current.size > 100) {
          terminatedCallIdsRef.current.clear();
          terminatedCallIdsRef.current.add(call.id);
        }
        activeCallIdRef.current = null;
        activeCallModeRef.current = null;
        setConnection(null);

        if (mode === "conference") {
          const pending = conferencePendingRef.current;
          if (pending) {
            clearTimeout(pending.timeout);
            conferencePendingRef.current = null;
            console.error("[DialerProvider] Conference call ended before connecting:", call.cause || "unknown");
            setCallState("failed");
            setIsInConference(false);
            pending.reject(new Error("Conference call was rejected"));
          } else {
            console.log("[DialerProvider] Conference disconnected");
            setCallState("idle");
            setIsInConference(false);
          }
        } else {
          console.log("Call disconnected");
          console.log("Disconnect reason:", call.cause || "unknown");
          setCallState("completed");
          setTimeout(() => {
            setCallState((prev) => prev === "completed" ? "idle" : prev);
            setCurrentCallId(null);
          }, 3000);
        }
        break;
      }
      default:
        break;
    }
  }, []);

  // Single attempt to initialize device with a given token
  const attemptInit = useCallback(async (token: string): Promise<boolean> => {
    // Clean up existing device
    if (deviceRef.current) {
      deviceRef.current.disconnect().catch(() => {
        // Ignore disconnect errors during re-init
      });
      deviceRef.current = null;
    }

    setInitStep("connecting");
    const newDevice = new TelnyxRTC({ login_token: token });
    newDevice.remoteElement = REMOTE_AUDIO_ELEMENT_ID;
    await resumeSharedAudioContext();

    // Create a promise that resolves when the client is ready (registered)
    setInitStep("registering");
    let settled = false;
    const registeredPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error("[Dialer] Device registration timeout after 10s");
        console.error("[Dialer] This usually means Telnyx credentials are invalid or missing.");
        console.error("[Dialer] Check: TELNYX_API_KEY, TELNYX_TEXML_APP_ID");
        console.error("[Dialer] Organization ID:", organizationIdRef.current ?? "none");
        settled = true;
        reject(new Error("Device registration timeout — check Telnyx configuration (TELNYX_API_KEY, TELNYX_TEXML_APP_ID)"));
      }, 10000);

      newDevice.on("telnyx.ready", () => {
        clearTimeout(timeout);
        settled = true;
        setIsReady(true);
        setInitStep("ready");
        console.log("[Dialer] Telnyx client registered successfully");
        resolve();
      });

      newDevice.on("telnyx.error", (event) => {
        const telnyxErr = event?.error;
        console.error("[Dialer] Telnyx client error:", telnyxErr?.code ?? "no code", telnyxErr?.message ?? event);
        console.error("[Dialer] Organization ID:", organizationIdRef.current ?? "none");
        if (!settled) {
          clearTimeout(timeout);
          settled = true;
          reject(telnyxErr instanceof Error ? telnyxErr : new Error(telnyxErr?.message ?? "Telnyx client error"));
        }
      });
    });

    newDevice.on("telnyx.socket.close", () => {
      setIsReady(false);
      console.log("Telnyx client unregistered (socket closed)");
    });

    newDevice.on("telnyx.notification", (notification: INotification) => {
      if (notification.type === "callUpdate" && notification.call) {
        handleCallUpdate(notification.call);
      }
    });

    deviceRef.current = newDevice;
    setDevice(newDevice);

    Promise.resolve(newDevice.connect()).catch((err) => {
      console.error("[Dialer] Telnyx connect() failed:", err);
    });
    await registeredPromise;

    // Telnyx login tokens can't be refreshed in place — schedule a client rebuild before expiry
    if (tokenRefreshTimerRef.current) {
      clearTimeout(tokenRefreshTimerRef.current);
    }
    const scheduleRefresh = (delayMs: number) => {
      tokenRefreshTimerRef.current = setTimeout(async () => {
        // Don't drop an in-progress or incoming call — retry shortly
        if (activeCallIdRef.current || incomingCallIdRef.current) {
          scheduleRefresh(60 * 1000);
          return;
        }
        console.log("Token expiring, refreshing...");
        try {
          clearCachedToken();
          const { data: newData } = await refetchToken();
          if (newData?.token) {
            setCachedToken(newData.token, newData.sipDomain);
            await attemptInitRef.current?.(newData.token);
          }
        } catch (err) {
          console.error("[Dialer] Failed to refresh Telnyx token:", err);
        }
      }, delayMs);
    };
    scheduleRefresh(TOKEN_REFRESH_MS);

    return true;
  }, [refetchToken, handleCallUpdate]);

  attemptInitRef.current = attemptInit;

  // Initialize Telnyx client with caching + retry
  const initializeDevice = useCallback(async (): Promise<boolean> => {
    // If already ready, return true
    if (isReady) return true;

    // If there's already an initialization in progress, wait for it
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }

    // Create the initialization promise
    const initPromise = (async (): Promise<boolean> => {
      if (isInitializing) return false;

      const MAX_RETRIES = 2;

      try {
        setIsInitializing(true);
        setError(null);
        setInitStep("authenticating");

        // Try cached token first
        let token = getCachedToken();

        if (!token) {
          const { data } = await refetchToken();
          if (!data?.token) {
            throw new Error("Failed to get capability token");
          }
          token = data.token;
          setCachedToken(token, data.sipDomain);
        }

        // Attempt init with retries
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              // On retry, wait 1s then re-fetch a fresh token (cached one may be bad)
              await new Promise((r) => setTimeout(r, 1000));
              clearCachedToken();
              setInitStep("authenticating");
              const { data } = await refetchToken();
              if (!data?.token) {
                throw new Error("Failed to get capability token");
              }
              token = data.token;
              setCachedToken(token, data.sipDomain);
            }
            await attemptInit(token!);
            return true;
          } catch (err) {
            lastError = err instanceof Error ? err : new Error("Failed to initialize device");
            console.warn(`Telnyx init attempt ${attempt + 1} failed:`, lastError.message);
          }
        }

        throw lastError || new Error("Failed to initialize device");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to initialize device";
        setError(message);
        setInitStep(null);
        console.error("Failed to initialize Telnyx client:", err);
        return false;
      } finally {
        setIsInitializing(false);
        initializationPromiseRef.current = null;
      }
    })();

    initializationPromiseRef.current = initPromise;
    return initPromise;
  }, [refetchToken, isInitializing, isReady, attemptInit]);

  // Clear cached token on org switch
  const prevOrgRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (prevOrgRef.current && organizationId && prevOrgRef.current !== organizationId) {
      clearCachedToken();
    }
    prevOrgRef.current = organizationId;
  }, [organizationId]);

  // Track first user gesture to satisfy browser autoplay policies.
  useEffect(() => {
    if (hasUserInteracted || typeof window === "undefined") {
      return;
    }

    const markInteracted = () => setHasUserInteracted(true);
    window.addEventListener("pointerdown", markInteracted, { once: true, passive: true });
    window.addEventListener("keydown", markInteracted, { once: true });

    return () => {
      window.removeEventListener("pointerdown", markInteracted);
      window.removeEventListener("keydown", markInteracted);
    };
  }, [hasUserInteracted]);

  // Auto-initialize after config is loaded and the user has interacted at least once.
  useEffect(() => {
    if (
      hasUserInteracted &&
      dialerConfig &&
      organizationId &&
      !isReady &&
      !isInitializing &&
      !deviceRef.current
    ) {
      initializeDevice();
    }
  }, [dialerConfig, organizationId, isReady, isInitializing, initializeDevice, hasUserInteracted]);

  // Initiate call mutation
  const initiateCallMutation = useMutation({
    mutationFn: async (params: { toNumber: string; fromNumber: string; leadId?: string; campaignId?: string }) => {
      const response = await post<{ data: { id: string; twilioCallSid: string } }>(
        ENDPOINTS.CALLS.CREATE,
        params
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() });
    },
  });

  // End call mutation
  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      await post(ENDPOINTS.CALLS.END(callId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() });
    },
  });

  // Make outbound call
  const makeCall = useCallback(
    async (toNumber: string, leadId?: string, campaignId?: string, fromNumber?: string) => {
      const currentDevice = deviceRef.current;
      if (!currentDevice) {
        throw new Error("Device not ready");
      }

      const sanitizedToNumber = toNumber.trim();
      const sanitizedFromNumber = fromNumber?.trim() ?? "";

      if (!sanitizedToNumber) {
        throw new Error("Phone number is required");
      }

      if (!sanitizedFromNumber) {
        throw new Error("Select a caller ID before placing a call");
      }

      try {
        await resumeSharedAudioContext();
        setCallState("initiated");

        // Create call record in backend
        const callData = await initiateCallMutation.mutateAsync({
          toNumber: sanitizedToNumber,
          fromNumber: sanitizedFromNumber,
          leadId,
          campaignId,
        });

        setCurrentCallId(callData.id);

        // Dial via Telnyx WebRTC — the backend TeXML voice webhook parses the
        // `callid-` prefix and routes the call to the created call record
        const conn = currentDevice.newCall({
          destinationNumber: buildSipDestination(`callid-${callData.id}`),
          callerNumber: sanitizedFromNumber,
        });

        // Track the call — state transitions arrive via telnyx.notification
        activeCallIdRef.current = conn.id;
        activeCallModeRef.current = "call";

        setConnection(conn);
      } catch (err) {
        let message = err instanceof Error ? err.message : "Failed to make call";

        // Check for billing guard errors from the API response
        const errAny = err as Record<string, unknown>;
        const resp = errAny?.response as Record<string, unknown> | undefined;
        const respData = resp?.data as Record<string, unknown> | undefined;
        const apiError = (respData?.error as string) || (errAny?.message as string) || "";
        if (apiError.includes("OVERAGE_CAP_HIT")) {
          message = "Your organization has reached its overage spending cap. Please visit Settings > Billing to raise the cap or upgrade your plan.";
        } else if (apiError.includes("ACCOUNT_SUSPENDED")) {
          message = "Your account has been suspended. Please visit Settings > Billing to resolve payment issues.";
        } else if (apiError.includes("ACCOUNT_CANCELED")) {
          message = "Your subscription has been canceled. Please visit Settings > Billing to reactivate.";
        } else if (apiError.includes("DAILY_LIMIT_REACHED")) {
          message = "You've reached the daily call limit (200 calls). This limit resets at midnight.";
        } else if (apiError.includes("NO_ACTIVE_SUBSCRIPTION")) {
          message = "No active subscription found. Please visit Settings > Billing to choose a plan.";
        } else if (apiError.includes("BILLING_GUARD_UNAVAILABLE")) {
          message = "Billing verification is temporarily unavailable. Please retry in a moment.";
        }

        setError(message);
        setCallState("failed");
        throw err;
      }
    },
    [initiateCallMutation]
  );

  // End call
  const endCall = useCallback(async () => {
    // First notify backend
    if (currentCallId) {
      try {
        await endCallMutation.mutateAsync(currentCallId);
      } catch (error) {
        console.error("Error ending call on backend:", error);
      }
    }
    // Then hang up the browser call
    if (connection) {
      connection.hangup();
    }
  }, [connection, currentCallId, endCallMutation]);

  // Answer incoming call
  const answerIncomingCall = useCallback(() => {
    if (incomingCall) {
      resumeSharedAudioContext();
      incomingCall.answer();
    }
  }, [incomingCall]);

  // Reject incoming call
  const rejectIncomingCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.hangup();
    }
  }, [incomingCall]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (connection) {
      connection.toggleAudioMute();
    }
  }, [connection]);

  // Join a parallel dial conference
  const joinConference = useCallback(async (conferenceId: string) => {
    console.log("[DialerProvider] joinConference called with:", conferenceId);
    const currentDevice = deviceRef.current;
    if (!currentDevice) {
      console.error("[DialerProvider] Device not ready - deviceRef.current is null");
      throw new Error("Device not ready");
    }

    try {
      setCallState("initiated");
      setError(null);
      await resumeSharedAudioContext();

      console.log("[DialerProvider] Dialing conference with conferenceId:", conferenceId);
      // Dial the conference via the TeXML voice webhook — the backend parses the
      // `conf-` prefix and joins us to the conference room
      const conn = currentDevice.newCall({
        destinationNumber: buildSipDestination(`conf-${conferenceId}`),
      });
      console.log("[DialerProvider] newCall() returned, call initiated");

      // Track the call — state transitions arrive via telnyx.notification
      activeCallIdRef.current = conn.id;
      activeCallModeRef.current = "conference";

      // Set connection immediately so it can be used for disconnect if needed
      setConnection(conn);

      // Return a promise that resolves when connected or rejects on error
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error("[DialerProvider] Conference connection timeout after 15s");
          console.error("[DialerProvider] This usually means the TeXML Application Voice URL is not configured correctly");
          console.error("[DialerProvider] Check that TELNYX_TEXML_APP_ID env var is set and the TeXML Application Voice URL points to your backend webhook");
          conferencePendingRef.current = null;
          // Try to hang up the call
          try {
            conn.hangup();
          } catch (e) {
            console.error("[DialerProvider] Error hanging up timed out call:", e);
          }
          reject(new Error("Conference connection timeout - check Telnyx TeXML Application configuration"));
        }, 15000);

        conferencePendingRef.current = { resolve, reject, timeout };
      });

      console.log("[DialerProvider] Successfully connected to conference");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to join conference";
      console.error("[DialerProvider] joinConference failed:", message, err);
      setError(message);
      setCallState("failed");
      setIsInConference(false);
      throw err;
    }
  }, []);

  // Leave the current conference
  const leaveConference = useCallback(() => {
    if (connection) {
      connection.hangup();
    }
    setIsInConference(false);
  }, [connection]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current);
      }
      if (deviceRef.current) {
        deviceRef.current.disconnect().catch(() => {
          // Ignore disconnect errors on unmount
        });
      }
    };
  }, []);

  // Clear current lead info when call ends
  useEffect(() => {
    if (callState === "idle") {
      setCurrentLeadInfo(null);
    }
  }, [callState]);

  const value: DialerContextValue = {
    device,
    connection,
    callState,
    currentCallId,
    incomingCall,
    isReady,
    error,
    isInitializing,
    initStep,
    isInConference,
    initializeDevice,
    makeCall,
    answerIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    joinConference,
    leaveConference,
    setConnection,
    setCallState,
    setCurrentCallId,
    setError,
    // Persisted selection state
    dialerSelection,
    setDialerSelection,
    // Parallel dialer session state
    parallelSession,
    setParallelSession,
    // Current lead info
    currentLeadInfo,
    setCurrentLeadInfo,
    // Widget minimized state
    isWidgetMinimized,
    setIsWidgetMinimized,
  };

  return (
    <DialerContext.Provider value={value}>
      {children}
      {/* Remote audio playback element for the Telnyx WebRTC client */}
      <audio id={REMOTE_AUDIO_ELEMENT_ID} autoPlay />
    </DialerContext.Provider>
  );
}

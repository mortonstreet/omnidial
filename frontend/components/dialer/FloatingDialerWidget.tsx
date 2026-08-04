"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { PhoneOff, MicOff, Mic, Minimize2, Maximize2, GripVertical, ChevronLeft, ChevronRight, Globe, Loader2 } from "lucide-react";
import { useDialerContext } from "@/components/providers/DialerProvider";
import { ProspectLocalTime } from "@/components/dialer/ProspectLocalTime";
import { useSkipLead, useGoToPrevious } from "@/hooks/api/usePowerDialer";
import { toast } from "sonner";

const STORAGE_KEY = "floating-dialer-position";

interface Position {
  x: number;
  y: number;
}

// Calculate default centered position
function getDefaultPosition(): Position {
  if (typeof window === "undefined") return { x: 100, y: 100 };
  return {
    x: Math.max(20, (window.innerWidth - 288) / 2), // 288 = widget width (w-72)
    y: Math.max(20, (window.innerHeight - 300) / 2),
  };
}

export function FloatingDialerWidget() {
  const pathname = usePathname();
  const router = useRouter();

  const {
    connection,
    callState,
    endCall,
    toggleMute,
    currentLeadInfo,
    isWidgetMinimized,
    setIsWidgetMinimized,
  } = useDialerContext();

  const [position, setPosition] = useState<Position>(getDefaultPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  // Navigation mutations
  const skipMutation = useSkipLead();
  const previousMutation = useGoToPrevious();

  // Check if we have campaign context for navigation
  const hasCampaignContext = !!currentLeadInfo?.campaignId;

  // Determine visibility
  const isOnDialerPage = pathname.startsWith("/dashboard/dialer");
  const isCallActive = ["initiated", "ringing", "in-progress"].includes(callState);
  const shouldShow = isCallActive && !isOnDialerPage;

  // Delay visibility change to allow smooth transitions
  useEffect(() => {
    if (shouldShow) {
      queueMicrotask(() => setIsVisible(true));
    } else {
      // Small delay before hiding to prevent flicker
      const timer = setTimeout(() => setIsVisible(false), 100);
      return () => clearTimeout(timer);
    }
  }, [shouldShow]);

  // Load position from sessionStorage
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        queueMicrotask(() => setPosition(parsed));
      }
    } catch {
      // Ignore errors, use default position
    }
  }, []);

  // Save position to sessionStorage
  const savePosition = useCallback((pos: Position) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Call duration timer
  const prevCallStateRef = useRef(callState);
  useEffect(() => {
    const prevCallState = prevCallStateRef.current;
    prevCallStateRef.current = callState;

    let timer: NodeJS.Timeout;
    if (callState === "in-progress") {
      if (prevCallState !== "in-progress") {
        queueMicrotask(() => setCallDuration(0));
      }
      timer = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }

    if (callState === "idle") {
      queueMicrotask(() => setCallDuration(0));
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [callState]);

  // Sync mute state with connection
  useEffect(() => {
    if (connection) {
      queueMicrotask(() => setIsMuted(connection.isAudioMuted));
    }
  }, [connection]);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    }
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Drag handlers - fixed to use direct left/top positioning
  const handleDragStart = useCallback((clientX: number, clientY: number) => {
    setIsDragging(true);
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  }, [position]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging || !dragStartRef.current || !widgetRef.current) return;

    // Fixed: delta should be current - start (not inverted)
    const deltaX = clientX - dragStartRef.current.x;
    const deltaY = clientY - dragStartRef.current.y;

    const widget = widgetRef.current;
    const maxX = window.innerWidth - widget.offsetWidth;
    const maxY = window.innerHeight - widget.offsetHeight;

    const newX = Math.max(0, Math.min(maxX, dragStartRef.current.posX + deltaX));
    const newY = Math.max(0, Math.min(maxY, dragStartRef.current.posY + deltaY));

    setPosition({ x: newX, y: newY });
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      savePosition(position);
      dragStartRef.current = null;
    }
  }, [isDragging, position, savePosition]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    handleDragStart(e.clientX, e.clientY);
  }, [handleDragStart]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleDragStart(touch.clientX, touch.clientY);
  }, [handleDragStart]);

  // Global event listeners for drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      const touch = e.touches[0];
      handleDragMove(touch.clientX, touch.clientY);
    };

    const handleMouseUp = () => handleDragEnd();
    const handleTouchEnd = () => handleDragEnd();

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  const handleEndCall = useCallback(async () => {
    try {
      await endCall();
    } catch (err) {
      console.error("Failed to end call:", err);
      toast.error("Failed to end call");
    }
  }, [endCall]);

  const handleToggleMute = useCallback(() => {
    toggleMute();
    setIsMuted(!isMuted);
  }, [toggleMute, isMuted]);

  const handleGoToDialer = useCallback(() => {
    router.push("/dashboard/dialer");
  }, [router]);

  // Navigation handlers for power dialer
  const handlePrevious = useCallback(() => {
    if (!currentLeadInfo?.campaignId) return;
    previousMutation.mutate({
      campaignId: currentLeadInfo.campaignId,
      listId: currentLeadInfo.listId,
    }, {
      onError: (error) => {
        console.error("Failed to go to previous lead:", error);
        toast.error("Failed to go to previous lead");
      },
    });
  }, [currentLeadInfo, previousMutation]);

  const handleNext = useCallback(() => {
    if (!currentLeadInfo?.campaignId) return;
    skipMutation.mutate({
      campaignId: currentLeadInfo.campaignId,
      listId: currentLeadInfo.listId,
    }, {
      onError: (error) => {
        console.error("Failed to skip to next lead:", error);
        toast.error("Failed to skip to next lead");
      },
    });
  }, [currentLeadInfo, skipMutation]);

  // Keyboard shortcuts: same as PowerDialerControls but active when widget is visible
  useEffect(() => {
    if (!isVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      ) {
        return;
      }

      const metaKey = e.metaKey || e.ctrlKey;

      // Cmd/Ctrl+L = Open LinkedIn profile in new tab
      if (metaKey && e.key === "l") {
        if (currentLeadInfo?.linkedInUrl) {
          e.preventDefault();
          window.open(currentLeadInfo.linkedInUrl, "_blank", "noopener,noreferrer");
        }
        return;
      }

      // Cmd/Ctrl+J = Open website in new tab
      if (metaKey && e.key === "j") {
        if (currentLeadInfo?.website) {
          e.preventDefault();
          const url = currentLeadInfo.website.startsWith("http")
            ? currentLeadInfo.website
            : `https://${currentLeadInfo.website}`;
          window.open(url, "_blank", "noopener,noreferrer");
        }
        return;
      }

      // Enter = End call (widget only shows during active calls)
      if (e.key === "Enter") {
        e.preventDefault();
        handleEndCall();
        return;
      }

      // Navigation only works when we have campaign context
      if (!hasCampaignContext) return;

      // + or = or Up/Right arrow = Next lead (fire-and-forget for instant response)
      if (e.key === "+" || e.key === "=" || e.key === "ArrowUp" || e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }

      // - or Down/Left arrow = Previous lead
      if (e.key === "-" || e.key === "ArrowDown" || e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevious();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isVisible, currentLeadInfo, hasCampaignContext, handleNext, handlePrevious, handleEndCall]);

  if (!isVisible) return null;

  const callStatusText = callState === "initiated" ? "Connecting" : callState === "ringing" ? "Ringing" : "In Progress";

  return (
    <div
      ref={widgetRef}
      className={`fixed z-40 ${
        isDragging
          ? "cursor-grabbing scale-[1.02] shadow-2xl ring-2 ring-primary/20"
          : "transition-all duration-200"
      }`}
      style={{
        left: position.x,
        top: position.y,
        touchAction: "none",
      }}
    >
      <div
        className={`bg-card border border-border rounded-xl shadow-2xl transition-all duration-200 ${
          isWidgetMinimized ? "w-52" : "w-72"
        }`}
      >
        {/* Header with drag handle */}
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-border cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-foreground">
                {isWidgetMinimized ? formatDuration(callDuration) : "Call Active"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsWidgetMinimized(!isWidgetMinimized);
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
              aria-label={isWidgetMinimized ? "Expand widget" : "Minimize widget"}
            >
              {isWidgetMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Content */}
        {isWidgetMinimized ? (
          // Minimized view - compact controls
          <div className="flex items-center justify-between px-3 py-2">
            <button
              onClick={handleToggleMute}
              className={`p-2 rounded-full transition-all ${
                isMuted
                  ? "bg-amber-500 text-white"
                  : "bg-muted/80 text-foreground hover:bg-muted"
              }`}
              aria-label={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <button
              onClick={handleEndCall}
              className="p-2 rounded-full bg-rose-500 text-white hover:bg-rose-400 transition-all"
              aria-label="End call"
            >
              <PhoneOff className="w-4 h-4" />
            </button>
          </div>
        ) : (
          // Expanded view
          <div className="p-4 space-y-4">
            {/* Call info */}
            <div className="text-center">
              <div className="text-3xl font-mono text-foreground tabular-nums">
                {formatDuration(callDuration)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{callStatusText}</div>

              {/* Lead info with navigation (power dialer mode) */}
              {currentLeadInfo && (
                <div className="mt-3 space-y-2">
                  {/* Lead name row with navigation arrows */}
                  <div className="flex items-center justify-center gap-2">
                    {hasCampaignContext && (
                      <button
                        onClick={handlePrevious}
                        disabled={previousMutation.isPending}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                        aria-label="Previous lead"
                      >
                        {previousMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronLeft className="w-4 h-4" />
                        )}
                      </button>
                    )}
                    <span className="text-sm font-medium text-foreground truncate max-w-[160px]">
                      {currentLeadInfo.name}
                    </span>
                    {hasCampaignContext && (
                      <button
                        onClick={handleNext}
                        disabled={skipMutation.isPending}
                        className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
                        aria-label="Next lead"
                      >
                        {skipMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Icons row: LinkedIn, Website, Timezone */}
                  <div className="flex items-center justify-center gap-3">
                    {currentLeadInfo.linkedInUrl && (
                      <a
                        href={currentLeadInfo.linkedInUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#0A66C2] hover:text-[#004182] transition-colors"
                        title="View LinkedIn profile (⌘L)"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                        </svg>
                      </a>
                    )}
                    {currentLeadInfo.website && (
                      <a
                        href={currentLeadInfo.website.startsWith('http') ? currentLeadInfo.website : `https://${currentLeadInfo.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Visit company website (⌘J)"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Globe className="w-4 h-4" />
                      </a>
                    )}
                    {currentLeadInfo.timezone && (
                      <ProspectLocalTime timezone={currentLeadInfo.timezone} />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleToggleMute}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all ${
                  isMuted
                    ? "bg-amber-500 ring-2 ring-amber-500/20 text-white"
                    : "bg-muted/80 border border-border/50 hover:bg-muted text-foreground"
                }`}
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              <button
                onClick={handleEndCall}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-rose-500 hover:bg-rose-400 text-white transition-all hover:shadow-lg hover:shadow-rose-500/30"
                aria-label="End call"
              >
                <PhoneOff className="w-6 h-6" />
              </button>
            </div>

            {/* Go to dialer link */}
            <button
              onClick={handleGoToDialer}
              className="w-full py-2 text-sm text-primary hover:text-primary/80 transition-colors text-center"
            >
              Go to Dialer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

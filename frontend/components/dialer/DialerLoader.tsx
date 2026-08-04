"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDialerContext } from "@/components/providers/DialerProvider";
import { Logo3DSpinner } from "@/components/ui/Logo3DSpinner";
import { RefreshCw } from "lucide-react";

const STEPS = [
  { key: "authenticating", label: "Authenticating" },
  { key: "connecting", label: "Connecting to phone system" },
  { key: "registering", label: "Registering device" },
  { key: "ready", label: "Ready" },
] as const;

const MIN_DISPLAY_MS = 2000;

export function DialerLoader({ onReady }: { onReady: () => void }) {
  const { isInitializing, initStep, error, isReady, initializeDevice } = useDialerContext();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const mountTime = useRef(0);

  useEffect(() => {
    mountTime.current = Date.now();
    const timer = setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady && minTimeElapsed) {
      onReady();
    }
  }, [isReady, minTimeElapsed, onReady]);

  const handleRetry = useCallback(() => {
    mountTime.current = Date.now();
    setMinTimeElapsed(false);
    setTimeout(() => setMinTimeElapsed(true), MIN_DISPLAY_MS);
    initializeDevice();
  }, [initializeDevice]);

  const activeStepIndex = STEPS.findIndex((s) => s.key === initStep);
  const showError = !isInitializing && error && !isReady;

  return (
    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
      {/* 3D Logo */}
      <div className="mb-8">
        <Logo3DSpinner size={160} />
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-foreground mb-1">OmniDial</h2>
      <p className="text-sm text-muted-foreground mb-8">Setting up your phone connection</p>

      {/* Progress steps */}
      {!showError && (
        <div className="space-y-3.5 w-64">
          {STEPS.map((step, i) => {
            const isActive = i === activeStepIndex;
            const isCompleted = activeStepIndex > i;
            const isPending = activeStepIndex < i;

            return (
              <div key={step.key} className="flex items-center gap-3">
                <div
                  className={`w-[22px] h-[22px] rounded-full flex items-center justify-center flex-shrink-0 border-[1.5px] transition-all duration-500 ${
                    isCompleted
                      ? "border-foreground bg-foreground"
                      : isActive
                      ? "border-muted-foreground"
                      : "border-border"
                  }`}
                >
                  {isCompleted && (
                    <svg className="w-[11px] h-[11px] text-background" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8.5L6.5 12L13 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {isActive && (
                    <div className="w-1.5 h-1.5 rounded-full bg-foreground animate-pulse" />
                  )}
                </div>

                <span
                  className={`text-[13px] transition-colors duration-500 ${
                    isCompleted
                      ? "text-muted-foreground"
                      : isActive
                      ? "text-foreground font-medium"
                      : isPending
                      ? "text-muted-foreground/30"
                      : "text-muted-foreground"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error state */}
      {showError && (
        <div className="flex flex-col items-center gap-4 w-72">
          <div className="w-full p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-center">
            <p className="text-sm font-medium text-destructive mb-1">Connection Failed</p>
            <p className="text-xs text-destructive/70">
              Unable to connect to the phone system. Check your connection and try again.
            </p>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      )}
    </div>
  );
}

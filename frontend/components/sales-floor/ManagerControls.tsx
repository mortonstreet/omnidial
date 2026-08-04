"use client";

import { useState } from "react";
import {
  Headphones,
  Volume2,
  Mic,
  PhoneOff,
  Loader2,
} from "lucide-react";
import {
  useEndListenSession,
  useChangeListenMode,
} from "@/hooks/api/useSalesFloor";

interface ManagerControlsProps {
  sessionId: string;
  currentMode: "listen" | "whisper" | "barge";
  repName: string;
  callDuration: number;
  onEnd?: () => void;
}

export function ManagerControls({
  sessionId,
  currentMode,
  repName,
  callDuration,
  onEnd,
}: ManagerControlsProps) {
  const [mode, setMode] = useState(currentMode);
  const endSession = useEndListenSession();
  const changeMode = useChangeListenMode();

  const handleModeChange = async (newMode: "listen" | "whisper" | "barge") => {
    if (newMode === mode) return;
    try {
      await changeMode.mutateAsync({ sessionId, mode: newMode });
      setMode(newMode);
    } catch (error) {
      console.error("Failed to change mode:", error);
    }
  };

  const handleEnd = async () => {
    try {
      await endSession.mutateAsync(sessionId);
      onEnd?.();
    } catch (error) {
      console.error("Failed to end session:", error);
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getModeDescription = () => {
    switch (mode) {
      case "listen":
        return "Silent monitoring - neither party can hear you";
      case "whisper":
        return "Coaching mode - only the rep can hear you";
      case "barge":
        return "Conference mode - everyone can hear you";
    }
  };

  const isLoading = endSession.isPending || changeMode.isPending;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-card border border-border rounded-lg shadow-lg p-4 z-50">
      <div className="flex items-center gap-6">
        {/* Call info */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
            <Headphones className="w-5 h-5 text-green-500" />
          </div>
          <div>
            <div className="font-medium">Monitoring {repName}</div>
            <div className="text-sm text-muted-foreground">
              {formatDuration(callDuration)} - {getModeDescription()}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-12 w-px bg-border" />

        {/* Mode buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleModeChange("listen")}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              mode === "listen"
                ? "bg-blue-500 text-white"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <Headphones className="w-4 h-4" />
            Listen
          </button>

          <button
            onClick={() => handleModeChange("whisper")}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              mode === "whisper"
                ? "bg-amber-500 text-white"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <Volume2 className="w-4 h-4" />
            Whisper
          </button>

          <button
            onClick={() => handleModeChange("barge")}
            disabled={isLoading}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              mode === "barge"
                ? "bg-green-500 text-white"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            <Mic className="w-4 h-4" />
            Barge
          </button>
        </div>

        {/* Divider */}
        <div className="h-12 w-px bg-border" />

        {/* End button */}
        <button
          onClick={handleEnd}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PhoneOff className="w-4 h-4" />
          )}
          End
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, User, MessageSquare, Loader2 } from "lucide-react";
import { useLiveTranscript } from "@/hooks/api/useLiveCoach";

interface LiveTranscriptPanelProps {
  callId: string;
  isLive?: boolean;
}

interface TranscriptSegment {
  id: string;
  speaker: "rep" | "prospect" | "unknown";
  text: string;
  startMs: number;
  endMs: number;
  confidence: number | null;
}

export function LiveTranscriptPanel({
  callId,
  isLive = true,
}: LiveTranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [lastMs, setLastMs] = useState(0);

  const { data, isLoading } = useLiveTranscript(callId, isLive ? lastMs : undefined, true);

  // Update lastMs for incremental fetching - use queueMicrotask to avoid sync setState in effect
  useEffect(() => {
    if (data?.totalDurationMs && data.totalDurationMs > lastMs) {
      queueMicrotask(() => setLastMs(data.totalDurationMs));
    }
  }, [data?.totalDurationMs, lastMs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data?.segments, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // If user scrolled up more than 100px from bottom, disable auto-scroll
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 100);
  };

  const formatTimestamp = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const segments: TranscriptSegment[] = data?.segments || [];

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4" />
          <h3 className="font-medium text-sm">Live Transcript</h3>
        </div>
        {isLive && data?.isTranscribing && (
          <span className="flex items-center gap-1.5 text-xs text-green-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Transcribing
          </span>
        )}
      </div>

      {/* Transcript content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {isLoading && segments.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Loading transcript...
          </div>
        ) : segments.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Mic className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Waiting for speech...</p>
          </div>
        ) : (
          segments.map((segment) => (
            <div
              key={segment.id}
              className={`flex gap-3 ${
                segment.speaker === "rep" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  segment.speaker === "rep"
                    ? "bg-blue-500/10 text-blue-500"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {segment.speaker === "rep" ? (
                  <Mic className="w-4 h-4" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>

              <div
                className={`flex-1 max-w-[80%] ${
                  segment.speaker === "rep" ? "text-right" : ""
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium">
                    {segment.speaker === "rep" ? "You" : segment.speaker === "prospect" ? "Lead" : "Speaker"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(segment.startMs)}
                  </span>
                  {segment.confidence !== null && segment.confidence < 0.8 && (
                    <span className="text-xs text-amber-500">(low confidence)</span>
                  )}
                </div>
                <div
                  className={`inline-block px-3 py-2 rounded-lg text-sm ${
                    segment.speaker === "rep"
                      ? "bg-blue-500/10 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {segment.text}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Auto-scroll indicator */}
      {!autoScroll && segments.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            if (scrollRef.current) {
              scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
          }}
          className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 text-xs bg-card border border-border rounded-full shadow-lg hover:bg-muted transition-colors"
        >
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          Resume auto-scroll
        </button>
      )}
    </div>
  );
}

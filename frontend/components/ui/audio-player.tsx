"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, MoreVertical, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { env, ENDPOINTS } from "@/lib/config";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  /** Call ID for fetching the recording via proxy endpoint */
  callId: string;
  /** Lead name for download filename */
  leadName?: string;
  /** Call date for download filename */
  callDate?: string | Date;
  /** Optional className for the container */
  className?: string;
  /** Compact mode - shows minimal player that expands on interaction */
  compact?: boolean;
  /** Called when playback state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
}

const PLAYBACK_SPEEDS = [
  { value: "0.5", label: "0.5x" },
  { value: "0.75", label: "0.75x" },
  { value: "1", label: "1x" },
  { value: "1.25", label: "1.25x" },
  { value: "1.5", label: "1.5x" },
  { value: "2", label: "2x" },
];

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function generateDownloadFilename(leadName?: string, callDate?: string | Date): string {
  const name = leadName?.trim() || "Unknown";
  const sanitizedName = name.replace(/[^a-zA-Z0-9\s-]/g, "").replace(/\s+/g, "-");

  let dateStr = "call";
  if (callDate) {
    const date = typeof callDate === "string" ? new Date(callDate) : callDate;
    if (!isNaN(date.getTime())) {
      dateStr = date.toISOString().split("T")[0];
    }
  }

  return `${sanitizedName}-call-${dateStr}.mp3`;
}

export function AudioPlayer({
  callId,
  leadName,
  callDate,
  className,
  compact = false,
  onPlayStateChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const seekTimeRef = useRef(0);
  const blobUrlRef = useRef<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState("1");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [isHovering, setIsHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const recordingUrl = `${env.API_URL}${ENDPOINTS.CALLS.RECORDING(callId)}`;

  // Initialize audio element
  const initAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.crossOrigin = "use-credentials";
      audio.preload = "metadata";
      audioRef.current = audio;

      audio.addEventListener("loadedmetadata", () => {
        setDuration(audio.duration);
        setIsLoading(false);
      });

      audio.addEventListener("timeupdate", () => {
        if (!isDraggingRef.current) {
          setCurrentTime(audio.currentTime);
        }
      });

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setCurrentTime(0);
        onPlayStateChange?.(false);
      });

      audio.addEventListener("error", () => {
        setError("Failed to load recording");
        setIsLoading(false);
        setIsPlaying(false);
      });

      audio.addEventListener("waiting", () => setIsLoading(true));
      audio.addEventListener("canplay", () => setIsLoading(false));
    }
    return audioRef.current;
  }, [onPlayStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

  // Update playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = parseFloat(playbackSpeed);
    }
  }, [playbackSpeed]);

  const togglePlayback = async () => {
    const audio = initAudio();

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      onPlayStateChange?.(false);
    } else {
      setError(null);

      if (!audio.src) {
        setIsLoading(true);
        try {
          const response = await fetch(recordingUrl, { credentials: 'include' });
          if (!response.ok) throw new Error('Failed to load recording');
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          blobUrlRef.current = url;
          audio.src = url;
        } catch (err) {
          console.error('Failed to load recording:', err);
          setError('Failed to load recording');
          setIsLoading(false);
          return;
        }
      }

      try {
        await audio.play();
        setIsPlaying(true);
        setIsExpanded(true);
        onPlayStateChange?.(true);
      } catch (err) {
        console.error("Failed to play recording:", err);
        setError("Failed to play recording");
        setIsLoading(false);
      }
    }
  };

  const handleSeek = useCallback((clientX: number) => {
    if (!progressRef.current || duration === 0) return;

    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const newTime = percent * duration;

    seekTimeRef.current = newTime;
    setCurrentTime(newTime);
    return newTime;
  }, [duration]);

  const startDrag = useCallback((startClientX: number, isTouch: boolean) => {
    const audio = initAudio();
    if (!audio.src || duration === 0) return;
    isDraggingRef.current = true;
    setIsDragging(true);

    // Seek to initial position immediately
    const newTime = handleSeek(startClientX);
    if (newTime !== undefined && audio) {
      audio.currentTime = newTime;
    }

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current) return;
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      handleSeek(clientX);
    };

    const onEnd = () => {
      if (audioRef.current && isDraggingRef.current) {
        audioRef.current.currentTime = seekTimeRef.current;
      }
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };

    // Attach listeners immediately — not through useEffect — so mouseup
    // is always caught even if React hasn't re-rendered yet.
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    if (isTouch) {
      window.addEventListener("touchmove", onMove, { passive: false });
      window.addEventListener("touchend", onEnd);
    }
  }, [handleSeek, initAudio, duration]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || isDragging) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(percent * duration);
    setHoverPosition(percent * 100);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(recordingUrl, {
        credentials: "include",
      });

      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = generateDownloadFilename(leadName, callDate);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
      setError("Download failed");
    }
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const showHandle = isHovering || isDragging;

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive", className)}>
        <span>{error}</span>
      </div>
    );
  }

  // Compact mode - just show play button until expanded
  if (compact && !isExpanded && !isPlaying) {
    return (
      <button
        onClick={togglePlayback}
        disabled={isLoading}
        className={cn(
          "group relative p-2.5 rounded-full transition-all duration-200",
          "bg-muted/60 hover:bg-foreground text-foreground hover:text-background",
          "disabled:opacity-50",
          className
        )}
        title="Play recording"
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          <Play className="w-4 h-4 transition-transform group-hover:scale-110" fill="currentColor" />
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50",
        "min-w-[280px]",
        className
      )}
    >
      {/* Play/Pause Button */}
      <button
        onClick={togglePlayback}
        disabled={isLoading}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-full transition-all duration-150 flex-shrink-0",
          isPlaying
            ? "bg-foreground text-background hover:bg-foreground/90"
            : "bg-foreground/10 hover:bg-foreground/20 text-foreground",
          "disabled:opacity-50"
        )}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-3.5 h-3.5" fill="currentColor" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
        )}
      </button>

      {/* Time & Progress */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        {/* Current Time */}
        <span className="text-[11px] text-muted-foreground font-mono tabular-nums flex-shrink-0 w-8 text-right">
          {formatTime(currentTime)}
        </span>

        {/* Progress Bar Container */}
        <div
          ref={progressRef}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => {
            setIsHovering(false);
            setHoverTime(null);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            startDrag(e.clientX, false);
          }}
          onTouchStart={(e) => {
            e.stopPropagation();
            startDrag(e.touches[0].clientX, true);
          }}
          onMouseMove={handleMouseMove}
          className={cn(
            "relative flex-1 h-6 cursor-pointer select-none group touch-none",
            "flex items-center"
          )}
        >
          {/* Hover time tooltip */}
          {hoverTime !== null && !isDragging && (
            <div
              className="absolute -top-7 px-1.5 py-0.5 rounded text-[10px] font-mono bg-foreground text-background pointer-events-none z-10 whitespace-nowrap"
              style={{ left: `${hoverPosition}%`, transform: 'translateX(-50%)' }}
            >
              {formatTime(hoverTime)}
            </div>
          )}

          {/* Track background */}
          <div
            className={cn(
              "absolute inset-x-0 h-1 rounded-full bg-foreground/15 transition-all duration-150",
              (isHovering || isDragging) && "h-1.5"
            )}
          >
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-foreground transition-colors"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Scrubber handle */}
          <div
            className={cn(
              "absolute w-3 h-3 rounded-full bg-foreground shadow-sm",
              "transform -translate-x-1/2 transition-all duration-100",
              showHandle ? "scale-100 opacity-100" : "scale-0 opacity-0",
              isDragging && "scale-125 shadow-md"
            )}
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* Total Duration */}
        <span className="text-[11px] text-muted-foreground font-mono tabular-nums flex-shrink-0 w-8">
          {formatTime(duration)}
        </span>
      </div>

      {/* Speed indicator (shown when not 1x) */}
      {playbackSpeed !== "1" && (
        <span className="text-[10px] text-muted-foreground font-medium px-1.5 py-0.5 rounded bg-foreground/5">
          {playbackSpeed}x
        </span>
      )}

      {/* More Options Menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="p-1 rounded hover:bg-foreground/10 transition flex-shrink-0"
            title="More options"
          >
            <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuLabel className="text-xs">Speed</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={playbackSpeed} onValueChange={setPlaybackSpeed}>
            {PLAYBACK_SPEEDS.map((speed) => (
              <DropdownMenuRadioItem key={speed.value} value={speed.value} className="text-xs">
                {speed.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDownload} className="text-xs">
            <Download className="w-3.5 h-3.5 mr-2" />
            Download
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

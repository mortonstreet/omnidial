"use client";

import { useState, useEffect } from "react";
import { Clock, Loader2 } from "lucide-react";

interface ProspectLocalTimeProps {
  timezone: string;
  isResolving?: boolean;
}

export function ProspectLocalTime({ timezone, isResolving }: ProspectLocalTimeProps) {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const formatTime = () => {
      try {
        const now = new Date();
        const formatted = now.toLocaleTimeString("en-US", {
          timeZone: timezone,
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        });
        setTime(formatted);
      } catch {
        setTime("");
      }
    };

    formatTime();
    const interval = setInterval(formatTime, 1000);
    return () => clearInterval(interval);
  }, [timezone]);

  if (isResolving) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" />
      </span>
    );
  }

  if (!time) return null;

  // Extract short timezone label
  let tzLabel = "";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart) tzLabel = tzPart.value;
  } catch {
    // Fall back to timezone name
    tzLabel = timezone.split("/").pop()?.replace(/_/g, " ") || "";
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
      title={`Prospect's local time (${timezone})`}
    >
      <Clock className="w-3 h-3" />
      {time}
      {tzLabel && <span className="opacity-60">{tzLabel}</span>}
    </span>
  );
}

"use client";

import { Trophy, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SalesFloorLeaderboardEntry } from "@shared/types/src/requests/salesFloor";
import type { LeaderboardPeriod } from "@/hooks/api/useSalesFloor";

interface LiveLeaderboardProps {
  leaderboard: SalesFloorLeaderboardEntry[];
  isLoading: boolean;
  metricType: "calls" | "connections" | "talk_time" | "conversions";
  onMetricChange: (type: "calls" | "connections" | "talk_time" | "conversions") => void;
  period: LeaderboardPeriod;
  onPeriodChange: (period: LeaderboardPeriod) => void;
  onRepClick?: (userId: string, userName: string, userImage?: string | null) => void;
}

const periodLabels: Record<LeaderboardPeriod, string> = {
  today: "Today",
  week: "Last 7 Days",
  month: "Last 30 Days",
  "90d": "Last 90 Days",
  all: "All Time",
};

export function LiveLeaderboard({
  leaderboard,
  isLoading,
  metricType,
  onMetricChange,
  period,
  onPeriodChange,
  onRepClick,
}: LiveLeaderboardProps) {
  const getEntryValue = (entry: SalesFloorLeaderboardEntry): number => {
    switch (metricType) {
      case "calls":
        return entry.callCount;
      case "connections":
        return entry.connectCount;
      case "talk_time":
        return entry.talkTimeSeconds;
      case "conversions":
        return entry.meetingCount;
      default:
        return entry.callCount;
    }
  };

  const formatValue = (value: number) => {
    if (metricType === "talk_time") {
      const minutes = Math.floor(value / 60);
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
    return value.toString();
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1)
      return (
        <div className="w-7 h-7 rounded-full bg-amber-500 flex items-center justify-center">
          <Trophy className="w-3.5 h-3.5 text-white" />
        </div>
      );
    if (rank === 2)
      return (
        <div className="w-7 h-7 rounded-full bg-gray-400 flex items-center justify-center">
          <span className="text-xs font-bold text-white">2</span>
        </div>
      );
    if (rank === 3)
      return (
        <div className="w-7 h-7 rounded-full bg-amber-700 flex items-center justify-center">
          <span className="text-xs font-bold text-white">3</span>
        </div>
      );
    return (
      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
        <span className="text-xs font-medium">{rank}</span>
      </div>
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg flex flex-col h-full">
      {/* Header with period selector */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          <h3 className="font-medium">Leaderboard</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {periodLabels[period]}
            <ChevronDown className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(periodLabels) as LeaderboardPeriod[]).map((p) => (
              <DropdownMenuItem
                key={p}
                onClick={() => onPeriodChange(p)}
                className={period === p ? "bg-muted" : ""}
              >
                {periodLabels[p]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Period context header */}
      <div className="px-4 py-2 bg-muted/50 border-b border-border">
        <p className="text-xs text-muted-foreground">
          Top performers - {periodLabels[period]}
        </p>
      </div>

      {/* Metric selector */}
      <div className="flex border-b border-border">
        {(["calls", "connections", "talk_time", "conversions"] as const).map((type) => (
          <button
            key={type}
            onClick={() => onMetricChange(type)}
            className={`flex-1 px-3 py-2 text-xs font-medium capitalize transition-colors ${
              metricType === type
                ? "bg-muted text-foreground border-b-2 border-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {type.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Leaderboard entries - scrollable */}
      <div className="flex-1 overflow-y-auto max-h-[500px] divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <div className="w-7 h-7 rounded-full bg-muted animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </div>
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            </div>
          ))
        ) : leaderboard.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No data for {periodLabels[period].toLowerCase()}
          </div>
        ) : (
          leaderboard.map((entry) => (
            <div
              key={entry.userId}
              onClick={() => onRepClick?.(entry.userId, entry.userName, entry.userImage)}
              className={`flex items-center gap-3 p-3 transition-colors ${
                onRepClick
                  ? "cursor-pointer hover:bg-muted/50"
                  : "hover:bg-muted/30"
              }`}
            >
              {getRankBadge(entry.rank)}

              <div className="flex items-center gap-2 flex-1 min-w-0">
                {entry.userImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={entry.userImage}
                    alt={entry.userName}
                    className="w-7 h-7 rounded-full"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <span className="text-xs">
                      {entry.userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <span className="text-sm font-medium truncate">
                  {entry.userName}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{formatValue(getEntryValue(entry))}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

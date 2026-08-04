"use client";

import { Sun, Moon } from "lucide-react";
import type { RepTimeOfDayBreakdown } from "@shared/types/src/requests/repProfile";

interface TimeOfDayChartProps {
  timeOfDay: RepTimeOfDayBreakdown;
  bestTimeOfDay: "am" | "pm" | null;
}

export function TimeOfDayChart({ timeOfDay, bestTimeOfDay }: TimeOfDayChartProps) {
  const { am, pm } = timeOfDay;
  const totalCalls = am.calls + pm.calls;

  // Calculate percentages for the split bar
  const amPercent = totalCalls > 0 ? (am.calls / totalCalls) * 100 : 50;
  const pmPercent = totalCalls > 0 ? (pm.calls / totalCalls) * 100 : 50;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  return (
    <div className="space-y-4">
      {/* Split Bar Visualization */}
      <div className="relative h-12 rounded-lg overflow-hidden flex">
        {/* AM Section */}
        <div
          className="bg-amber-500/80 flex items-center justify-center transition-all duration-500"
          style={{ width: `${amPercent}%`, minWidth: amPercent > 0 ? "40px" : "0" }}
        >
          {amPercent >= 20 && (
            <div className="flex items-center gap-1 text-white text-sm font-medium">
              <Sun className="w-4 h-4" />
              <span>{am.calls}</span>
            </div>
          )}
        </div>

        {/* PM Section */}
        <div
          className="bg-indigo-500/80 flex items-center justify-center transition-all duration-500"
          style={{ width: `${pmPercent}%`, minWidth: pmPercent > 0 ? "40px" : "0" }}
        >
          {pmPercent >= 20 && (
            <div className="flex items-center gap-1 text-white text-sm font-medium">
              <Moon className="w-4 h-4" />
              <span>{pm.calls}</span>
            </div>
          )}
        </div>

        {/* Center divider line */}
        {totalCalls > 0 && (
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-background/30" />
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-muted-foreground">Morning (AM)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span className="text-muted-foreground">Afternoon (PM)</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* AM Stats */}
        <div
          className={`p-4 rounded-lg border ${
            bestTimeOfDay === "am"
              ? "border-amber-500 bg-amber-500/5"
              : "border-border"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Sun className="w-5 h-5 text-amber-500" />
            <span className="font-medium">Morning</span>
            {bestTimeOfDay === "am" && (
              <span className="ml-auto text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full">
                Best
              </span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Calls</span>
              <span className="font-medium">{am.calls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connects</span>
              <span className="font-medium text-green-500">{am.connects}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connect Rate</span>
              <span className="font-medium">{am.connectionRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Talk Time</span>
              <span className="font-medium">{formatDuration(am.totalTalkTimeSeconds)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Appointments</span>
              <span className="font-medium">{am.appointments}</span>
            </div>
          </div>
        </div>

        {/* PM Stats */}
        <div
          className={`p-4 rounded-lg border ${
            bestTimeOfDay === "pm"
              ? "border-indigo-500 bg-indigo-500/5"
              : "border-border"
          }`}
        >
          <div className="flex items-center gap-2 mb-3">
            <Moon className="w-5 h-5 text-indigo-500" />
            <span className="font-medium">Afternoon</span>
            {bestTimeOfDay === "pm" && (
              <span className="ml-auto text-xs bg-indigo-500/20 text-indigo-500 px-2 py-0.5 rounded-full">
                Best
              </span>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Calls</span>
              <span className="font-medium">{pm.calls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connects</span>
              <span className="font-medium text-green-500">{pm.connects}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Connect Rate</span>
              <span className="font-medium">{pm.connectionRate}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Talk Time</span>
              <span className="font-medium">{formatDuration(pm.totalTalkTimeSeconds)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Appointments</span>
              <span className="font-medium">{pm.appointments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

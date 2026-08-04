"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { HourlyActivity } from "@shared/types/src/requests/repProfile";

interface HourlyHeatmapProps {
  hourlyActivity: HourlyActivity[];
  peakHour: { hour: number; calls: number; connects: number } | null;
}

export function HourlyHeatmap({ hourlyActivity, peakHour }: HourlyHeatmapProps) {
  // Find max calls for intensity calculation
  const maxCalls = Math.max(...hourlyActivity.map((h) => h.calls), 1);

  // Get intensity class based on call count
  const getIntensityClass = (calls: number) => {
    if (calls === 0) return "bg-muted";
    const intensity = calls / maxCalls;
    if (intensity > 0.75) return "bg-green-500";
    if (intensity > 0.5) return "bg-green-400";
    if (intensity > 0.25) return "bg-green-300";
    return "bg-green-200";
  };

  // Format hour for display (12-hour format)
  const formatHour = (hour: number) => {
    if (hour === 0) return "12a";
    if (hour === 12) return "12p";
    if (hour < 12) return `${hour}a`;
    return `${hour - 12}p`;
  };

  // Format duration
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    return `${Math.round(seconds / 60)}m`;
  };

  // Group hours by time period for better visualization
  const morningHours = hourlyActivity.slice(6, 12); // 6am - 11am
  const afternoonHours = hourlyActivity.slice(12, 18); // 12pm - 5pm
  const eveningHours = hourlyActivity.slice(18, 22); // 6pm - 9pm
  const offHours = [
    ...hourlyActivity.slice(0, 6), // 12am - 5am
    ...hourlyActivity.slice(22), // 10pm - 11pm
  ];

  return (
    <div className="space-y-4">
      {/* Full 24-hour heatmap grid */}
      <TooltipProvider>
        <div className="space-y-2">
          {/* Morning (6am - 11am) */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Morning</div>
            <div className="flex gap-1">
              {morningHours.map((activity) => (
                <Tooltip key={activity.hour}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded flex items-center justify-center text-xs font-medium cursor-default transition-all ${getIntensityClass(
                        activity.calls
                      )} ${
                        peakHour?.hour === activity.hour
                          ? "ring-2 ring-yellow-500 ring-offset-2 ring-offset-background"
                          : ""
                      } ${activity.calls > 0 ? "text-white" : "text-muted-foreground"}`}
                    >
                      {activity.calls > 0 ? activity.calls : "-"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{formatHour(activity.hour)}</div>
                      <div className="text-muted-foreground space-y-0.5 mt-1">
                        <div>Calls: {activity.calls}</div>
                        <div>Connects: {activity.connects}</div>
                        {activity.calls > 0 && (
                          <div>Avg: {formatDuration(activity.avgDurationSeconds)}</div>
                        )}
                      </div>
                      {peakHour?.hour === activity.hour && (
                        <div className="text-yellow-500 mt-1 font-medium">Peak Hour</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Afternoon (12pm - 5pm) */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Afternoon</div>
            <div className="flex gap-1">
              {afternoonHours.map((activity) => (
                <Tooltip key={activity.hour}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded flex items-center justify-center text-xs font-medium cursor-default transition-all ${getIntensityClass(
                        activity.calls
                      )} ${
                        peakHour?.hour === activity.hour
                          ? "ring-2 ring-yellow-500 ring-offset-2 ring-offset-background"
                          : ""
                      } ${activity.calls > 0 ? "text-white" : "text-muted-foreground"}`}
                    >
                      {activity.calls > 0 ? activity.calls : "-"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{formatHour(activity.hour)}</div>
                      <div className="text-muted-foreground space-y-0.5 mt-1">
                        <div>Calls: {activity.calls}</div>
                        <div>Connects: {activity.connects}</div>
                        {activity.calls > 0 && (
                          <div>Avg: {formatDuration(activity.avgDurationSeconds)}</div>
                        )}
                      </div>
                      {peakHour?.hour === activity.hour && (
                        <div className="text-yellow-500 mt-1 font-medium">Peak Hour</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Evening (6pm - 9pm) */}
          <div>
            <div className="text-xs text-muted-foreground mb-1">Evening</div>
            <div className="flex gap-1">
              {eveningHours.map((activity) => (
                <Tooltip key={activity.hour}>
                  <TooltipTrigger asChild>
                    <div
                      className={`w-10 h-10 rounded flex items-center justify-center text-xs font-medium cursor-default transition-all ${getIntensityClass(
                        activity.calls
                      )} ${
                        peakHour?.hour === activity.hour
                          ? "ring-2 ring-yellow-500 ring-offset-2 ring-offset-background"
                          : ""
                      } ${activity.calls > 0 ? "text-white" : "text-muted-foreground"}`}
                    >
                      {activity.calls > 0 ? activity.calls : "-"}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <div className="font-medium">{formatHour(activity.hour)}</div>
                      <div className="text-muted-foreground space-y-0.5 mt-1">
                        <div>Calls: {activity.calls}</div>
                        <div>Connects: {activity.connects}</div>
                        {activity.calls > 0 && (
                          <div>Avg: {formatDuration(activity.avgDurationSeconds)}</div>
                        )}
                      </div>
                      {peakHour?.hour === activity.hour && (
                        <div className="text-yellow-500 mt-1 font-medium">Peak Hour</div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Off hours (collapsed) */}
          {offHours.some((h) => h.calls > 0) && (
            <div>
              <div className="text-xs text-muted-foreground mb-1">Off Hours</div>
              <div className="flex gap-1 flex-wrap">
                {offHours
                  .filter((h) => h.calls > 0)
                  .map((activity) => (
                    <Tooltip key={activity.hour}>
                      <TooltipTrigger asChild>
                        <div
                          className={`w-10 h-10 rounded flex items-center justify-center text-xs font-medium cursor-default transition-all ${getIntensityClass(
                            activity.calls
                          )} ${activity.calls > 0 ? "text-white" : "text-muted-foreground"}`}
                        >
                          {activity.calls > 0 ? activity.calls : "-"}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <div className="font-medium">{formatHour(activity.hour)}</div>
                          <div className="text-muted-foreground space-y-0.5 mt-1">
                            <div>Calls: {activity.calls}</div>
                            <div>Connects: {activity.connects}</div>
                            {activity.calls > 0 && (
                              <div>Avg: {formatDuration(activity.avgDurationSeconds)}</div>
                            )}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>

      {/* Legend */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded bg-muted" />
            <div className="w-4 h-4 rounded bg-green-200" />
            <div className="w-4 h-4 rounded bg-green-300" />
            <div className="w-4 h-4 rounded bg-green-400" />
            <div className="w-4 h-4 rounded bg-green-500" />
          </div>
          <span>More</span>
        </div>
        {peakHour && (
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-muted ring-2 ring-yellow-500 ring-offset-1 ring-offset-background" />
            <span>Peak Hour ({formatHour(peakHour.hour)})</span>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Phone, PhoneCall, Clock, Calendar, TrendingUp } from "lucide-react";
import { useRepProfileStats } from "@/hooks/api/useRepProfile";
import { TimeOfDayChart } from "./TimeOfDayChart";
import { HourlyHeatmap } from "./HourlyHeatmap";
import type { AnalyticsPeriod } from "@shared/types/src/requests/repProfile";

interface RepProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  userId: string;
  userName: string;
  userImage?: string | null;
}

export function RepProfileModal({
  open,
  onOpenChange,
  organizationId,
  userId,
  userName,
  userImage,
}: RepProfileModalProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("week");

  const { data, isLoading, isFetching } = useRepProfileStats({
    organizationId,
    userId,
    period,
    enabled: open,
  });

  const stats = data?.data;

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  };

  const periodLabels: Record<AnalyticsPeriod, string> = {
    today: "Today",
    week: "Last 7 Days",
    month: "Last 30 Days",
    "90d": "Last 90 Days",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt={userName}
                  className="w-12 h-12 rounded-full"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-lg font-medium">
                    {userName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <DialogTitle>{stats?.userName || userName}</DialogTitle>
                <p className="text-sm text-muted-foreground">Rep Performance Profile</p>
              </div>
            </div>
            <Select
              value={period}
              onValueChange={(value) => setPeriod(value as AnalyticsPeriod)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <Skeleton className="h-48" />
            <Skeleton className="h-40" />
          </div>
        ) : !stats ? (
          <div className="py-8 text-center text-muted-foreground">
            <Phone className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No call data available for {periodLabels[period].toLowerCase()}</p>
          </div>
        ) : (
          <div className={`space-y-6 py-4 ${isFetching ? "opacity-60" : ""}`}>
            {/* KPI Cards */}
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Phone className="w-4 h-4" />
                  <span className="text-xs">Total Calls</span>
                </div>
                <div className="text-2xl font-bold">{stats.kpis.totalCalls}</div>
              </div>

              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-500 mb-1">
                  <PhoneCall className="w-4 h-4" />
                  <span className="text-xs">Connects</span>
                </div>
                <div className="text-2xl font-bold text-green-500">
                  {stats.kpis.totalConnects}
                </div>
                <div className="text-xs text-muted-foreground">
                  {stats.kpis.connectionRate}% rate
                </div>
              </div>

              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="w-4 h-4" />
                  <span className="text-xs">Talk Time</span>
                </div>
                <div className="text-2xl font-bold">
                  {formatDuration(stats.kpis.totalTalkTimeSeconds)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Avg {formatDuration(stats.kpis.avgCallDurationSeconds)}
                </div>
              </div>

              <div className="bg-card border rounded-lg p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs">Appointments</span>
                </div>
                <div className="text-2xl font-bold">{stats.kpis.appointments}</div>
              </div>
            </div>

            {/* Time of Day Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-medium">Time of Day Performance</h3>
              </div>
              <TimeOfDayChart
                timeOfDay={stats.timeOfDay}
                bestTimeOfDay={stats.bestTimeOfDay}
              />
            </div>

            {/* Hourly Heatmap Section */}
            <div className="space-y-3">
              <h3 className="font-medium">Hourly Activity</h3>
              <HourlyHeatmap
                hourlyActivity={stats.hourlyActivity}
                peakHour={stats.peakHour}
              />
            </div>

            {/* Campaign Breakdown (if multiple campaigns) */}
            {stats.campaignStats && stats.campaignStats.length > 1 && (
              <div className="space-y-3">
                <h3 className="font-medium">Campaign Breakdown</h3>
                <div className="space-y-2">
                  {stats.campaignStats.map((campaign) => (
                    <div
                      key={campaign.campaignId}
                      className="bg-muted/50 rounded-lg p-3"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">
                          {campaign.campaignName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {campaign.am.calls + campaign.pm.calls} calls
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-amber-500">AM</span>
                          <span>
                            {campaign.am.calls} calls, {campaign.am.connectionRate}% connect
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-indigo-500">PM</span>
                          <span>
                            {campaign.pm.calls} calls, {campaign.pm.connectionRate}% connect
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

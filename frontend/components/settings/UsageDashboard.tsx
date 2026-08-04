"use client";

import { useUsageDashboard, useUsageHistory } from "@/hooks/api/useBilling";
import Card from "@/components/ui/card";
import type { GetUsageDashboardResponse, GetUsageHistoryResponse, UsageCycleData } from "@shared/types/src/requests/billing";
import { BarChart3, TrendingUp, AlertTriangle } from "lucide-react";

function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function UsageDashboard() {
  const { data: dashboardRes, isLoading } = useUsageDashboard();
  const { data: historyRes } = useUsageHistory();

  const dashboard = (dashboardRes as { data?: GetUsageDashboardResponse })?.data;
  const history = (historyRes as { data?: GetUsageHistoryResponse })?.data;

  if (isLoading) {
    return (
      <Card title="Usage">
        <div className="text-sm text-muted-foreground">Loading usage data...</div>
      </Card>
    );
  }

  if (!dashboard?.cycle) {
    return null; // No billing cycle = no usage tracking yet
  }

  const { cycle, percentUsed, daysRemaining, projectedMinutes, projectedOverage } = dashboard;
  const barWidth = Math.min(100, percentUsed);
  const isOverage = percentUsed > 100;

  return (
    <div className="space-y-6">
      <Card title="Voice Minutes Usage">
        <div className="space-y-4">
          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {formatMinutes(cycle.usedMinutes)} of{" "}
                {formatMinutes(cycle.includedMinutes)} used
              </span>
              <span
                className={
                  isOverage
                    ? "font-medium text-red-500"
                    : percentUsed >= 80
                      ? "font-medium text-amber-500"
                      : "text-muted-foreground"
                }
              >
                {percentUsed}%
              </span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOverage
                    ? "bg-red-500"
                    : percentUsed >= 80
                      ? "bg-amber-500"
                      : "bg-primary"
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <BarChart3 className="w-3.5 h-3.5" />
                Days remaining
              </div>
              <p className="text-lg font-semibold text-foreground">
                {daysRemaining}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                Projected
              </div>
              <p className={`text-lg font-semibold ${projectedOverage ? "text-amber-500" : "text-foreground"}`}>
                {formatMinutes(projectedMinutes)}
              </p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 border border-border">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Overage
              </div>
              <p className={`text-lg font-semibold ${cycle.overageMinutes > 0 ? "text-red-500" : "text-foreground"}`}>
                {cycle.overageMinutes > 0
                  ? `${formatMinutes(cycle.overageMinutes)} (${formatCents(cycle.overageAmountCents)})`
                  : "None"}
              </p>
            </div>
          </div>

          {/* Overage cap warning */}
          {dashboard.overageCapHit && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                Overage spending cap ({formatCents(dashboard.overageCapCents)}) reached.
                New calls may be blocked until the cap is acknowledged or raised.
              </span>
            </div>
          )}

          {/* Projection warning */}
          {projectedOverage && !isOverage && (
            <p className="text-xs text-amber-600">
              At your current pace, you&apos;re projected to use{" "}
              {formatMinutes(projectedMinutes)} minutes this cycle, exceeding
              your {formatMinutes(cycle.includedMinutes)} included minutes.
            </p>
          )}
        </div>
      </Card>

      {/* Usage History (collapsed) */}
      {history?.cycles && history.cycles.length > 1 && (
        <Card title="Past Cycles">
          <div className="space-y-2">
            {history.cycles
              .filter((c: UsageCycleData) => !c.isCurrent)
              .slice(0, 5)
              .map((c: UsageCycleData) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between py-2 px-3 rounded bg-muted/30 text-sm"
                >
                  <span className="text-muted-foreground">
                    {new Date(c.periodStart).toLocaleDateString()} -{" "}
                    {new Date(c.periodEnd).toLocaleDateString()}
                  </span>
                  <span className="text-foreground font-medium">
                    {formatMinutes(c.usedMinutes)} / {formatMinutes(c.includedMinutes)}
                    {c.overageMinutes > 0 && (
                      <span className="text-red-500 ml-2">
                        +{formatMinutes(c.overageMinutes)} overage
                      </span>
                    )}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}

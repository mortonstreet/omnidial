'use client';

import { Phone, PhoneOutgoing, PhoneIncoming, PhoneCall, Clock, Timer } from 'lucide-react';
import type { CallMetrics } from '@shared/types/src';

interface MetricCardsProps {
  metrics: CallMetrics;
  isLoading?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  isLoading?: boolean;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <div className="p-2 rounded-md bg-muted">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm font-normal">{label}</span>
      </div>
      {isLoading ? (
        <div className="h-8 bg-muted rounded animate-pulse w-16" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-medium text-foreground">{value}</span>
          {subValue && (
            <span className="text-sm text-muted-foreground">{subValue}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function MetricCards({ metrics, isLoading }: MetricCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <MetricCard
        icon={Phone}
        label="Total Calls"
        value={metrics.totalCalls}
        isLoading={isLoading}
      />
      <MetricCard
        icon={PhoneOutgoing}
        label="Outbound"
        value={metrics.outboundCalls}
        isLoading={isLoading}
      />
      <MetricCard
        icon={PhoneIncoming}
        label="Inbound"
        value={metrics.inboundCalls}
        isLoading={isLoading}
      />
      <MetricCard
        icon={PhoneCall}
        label="Connected"
        value={metrics.connectedCalls}
        subValue={`${metrics.connectionRate}% rate`}
        isLoading={isLoading}
      />
      <MetricCard
        icon={Clock}
        label="Talk Time"
        value={formatDuration(metrics.totalTalkTimeSeconds)}
        isLoading={isLoading}
      />
      <MetricCard
        icon={Timer}
        label="Avg Duration"
        value={formatDuration(metrics.avgCallDurationSeconds)}
        isLoading={isLoading}
      />
    </div>
  );
}

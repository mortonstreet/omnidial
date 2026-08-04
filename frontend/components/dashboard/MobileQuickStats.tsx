'use client';

import { Phone, PhoneIncoming, PhoneOutgoing, Clock } from 'lucide-react';

interface MobileQuickStatsProps {
  metrics: {
    totalCalls: number;
    outboundCalls: number;
    inboundCalls: number;
    connectedCalls: number;
    connectionRate: number;
    totalTalkTimeSeconds: number;
    avgCallDurationSeconds: number;
  };
  isLoading?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

export function MobileQuickStats({ metrics, isLoading }: MobileQuickStatsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
            <div className="h-4 bg-muted rounded w-20 mb-2" />
            <div className="h-8 bg-muted rounded w-16" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Total Calls',
      value: metrics.totalCalls,
      icon: Phone,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Outbound',
      value: metrics.outboundCalls,
      icon: PhoneOutgoing,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      label: 'Inbound',
      value: metrics.inboundCalls,
      icon: PhoneIncoming,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
    {
      label: 'Talk Time',
      value: formatDuration(metrics.totalTalkTimeSeconds),
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      isTime: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-card border border-border rounded-xl p-4 flex flex-col min-h-[100px]"
        >
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-1.5 rounded-lg ${stat.bgColor}`}>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {stat.label}
            </span>
          </div>
          <span className="text-2xl font-bold text-foreground mt-auto">
            {stat.isTime ? stat.value : stat.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

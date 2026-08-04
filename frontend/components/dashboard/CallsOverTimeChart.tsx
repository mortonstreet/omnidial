'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ArrowUpRight } from 'lucide-react';
import type { CallsOverTime } from '@shared/types/src';

interface CallsOverTimeChartProps {
  data: CallsOverTime[];
  isLoading?: boolean;
  onViewCalls?: () => void;
}

export function CallsOverTimeChart({ data, isLoading, onViewCalls }: CallsOverTimeChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 h-[340px] flex flex-col">
        <h3 className="text-sm font-medium text-foreground mb-1">Calls Over Time</h3>
        <div className="flex-1 bg-muted/50 rounded-lg animate-pulse mt-3" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 h-[340px] flex flex-col">
        <h3 className="text-sm font-medium text-foreground mb-1">Calls Over Time</h3>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No call data for this period
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    date: format(parseISO(item.date), 'MMM d'),
  }));

  // Calculate total for display (outbound + inbound only)
  const totalCalls = data.reduce((sum, item) => sum + item.outbound + item.inbound, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-5 h-[340px] flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Calls Over Time</h3>
          <p className="text-2xl font-semibold text-foreground mt-1">{totalCalls.toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span className="text-muted-foreground">Outbound</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#22c55e]" />
            <span className="text-muted-foreground">Inbound</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="outboundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="inboundGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#737373' }}
              tickLine={false}
              axisLine={false}
              dy={10}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#737373' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={35}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#111111',
                border: '1px solid #262626',
                borderRadius: '8px',
                padding: '8px 12px',
              }}
              labelStyle={{ color: '#fafafa', marginBottom: '4px', fontWeight: 500 }}
              itemStyle={{ color: '#a3a3a3', fontSize: '12px' }}
              cursor={{ stroke: '#404040', strokeDasharray: '4 4' }}
            />
            <Area
              type="monotone"
              dataKey="outbound"
              name="Outbound"
              stroke="#3b82f6"
              fill="url(#outboundGradient)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="inbound"
              name="Inbound"
              stroke="#22c55e"
              fill="url(#inboundGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Footer CTA */}
      <div className="flex justify-end pt-2 border-t border-border mt-2">
        <button
          onClick={onViewCalls}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View calls
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

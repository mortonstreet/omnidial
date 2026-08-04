'use client';

import { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { GetErrorLogStatsResponse } from '@shared/types/src';

interface ErrorTrendChartProps {
  data: GetErrorLogStatsResponse | undefined;
  isLoading?: boolean;
}

export function ErrorTrendChart({ data, isLoading }: ErrorTrendChartProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Historical Trend</h3>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        {!isCollapsed && (
          <div className="h-[200px] bg-muted/50 rounded-lg animate-pulse" />
        )}
      </div>
    );
  }

  if (!data || data.buckets.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Historical Trend</h3>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
        {!isCollapsed && (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
            No error data for this period
          </div>
        )}
      </div>
    );
  }

  const chartData = data.buckets.map((item) => ({
    ...item,
    date: format(parseISO(item.timestamp), 'MMM d'),
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Historical Trend</h3>
          <div className="flex items-center gap-4 mt-2">
            <div className="text-center">
              <p className="text-2xl font-semibold text-foreground">{data.totals.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-yellow-500">{data.totals.warning}</p>
              <p className="text-xs text-muted-foreground">Warnings</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-500">{data.totals.error}</p>
              <p className="text-xs text-muted-foreground">Errors</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-red-700">{data.totals.critical}</p>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-500" />
              <span className="text-muted-foreground">Warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-muted-foreground">Error</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-700" />
              <span className="text-muted-foreground">Critical</span>
            </div>
          </div>
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Chart */}
      {!isCollapsed && (
        <div className="h-[200px] mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="warningGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#eab308" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#eab308" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="criticalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#b91c1c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#b91c1c" stopOpacity={0} />
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
                dataKey="warning"
                name="Warning"
                stroke="#eab308"
                fill="url(#warningGradient)"
                strokeWidth={2}
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="error"
                name="Error"
                stroke="#ef4444"
                fill="url(#errorGradient)"
                strokeWidth={2}
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="critical"
                name="Critical"
                stroke="#b91c1c"
                fill="url(#criticalGradient)"
                strokeWidth={2}
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

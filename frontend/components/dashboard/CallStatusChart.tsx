'use client';

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Info, ArrowUpRight } from 'lucide-react';
import type { DispositionBreakdown } from '@shared/types/src';

interface CallStatusChartProps {
  data: DispositionBreakdown[];
  isLoading?: boolean;
  onViewStatus?: (status: DispositionBreakdown) => void;
}

// Enterprise color palette - more muted and professional
const CHART_COLORS = [
  '#4F46E5', // Indigo
  '#059669', // Emerald
  '#D97706', // Amber
  '#DC2626', // Red
  '#7C3AED', // Violet
  '#0891B2', // Cyan
  '#BE185D', // Pink
  '#6B7280', // Gray
];

export function CallStatusChart({ data, isLoading, onViewStatus }: CallStatusChartProps) {
  if (isLoading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 h-[340px] flex flex-col">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Call Status</h3>
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 bg-muted/50 rounded-lg animate-pulse mt-3" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 h-[340px] flex flex-col">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground">Call Status</h3>
          <Info className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No call data for this period
        </div>
      </div>
    );
  }

  // Calculate total for center display and percentages
  const totalCalls = data.reduce((sum, item) => sum + item.count, 0);

  const chartData = data.map((item, index) => ({
    name: item.label,
    value: item.count,
    color: CHART_COLORS[index % CHART_COLORS.length],
    count: item.count,
    percentage: totalCalls > 0 ? Math.round((item.count / totalCalls) * 100) : 0,
  }));

  return (
    <div className="bg-card border border-border rounded-xl p-5 h-[340px] flex flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Call Status</h3>
          <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
        </div>
        <span className="text-xs text-muted-foreground">{totalCalls} total calls</span>
      </div>

      {/* Chart and Legend Container */}
      <div className="flex-1 flex items-center">
        {/* Donut Chart */}
        <div className="relative w-[180px] h-[180px] flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="transparent"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#111111',
                  border: '1px solid #262626',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
                itemStyle={{ color: '#fafafa', fontSize: '12px' }}
                formatter={(value, name, props) => {
                  const percentage = props.payload?.percentage || 0;
                  return [`${value} calls (${percentage}%)`, name];
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center stat */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-semibold text-foreground">{totalCalls}</span>
            <span className="text-xs text-muted-foreground">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 pl-6 space-y-2.5">
          {chartData.slice(0, 6).map((item, index) => {
            const originalStatus = data[index];
            return (
              <button
                key={index}
                onClick={() => onViewStatus?.(originalStatus)}
                disabled={!onViewStatus}
                className="w-full flex items-center justify-between text-sm hover:bg-muted/50 -mx-2 px-2 py-1 rounded transition-colors disabled:hover:bg-transparent"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm flex-shrink-0 shadow-sm"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-foreground/80 truncate max-w-[120px]">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-foreground font-medium tabular-nums">
                    {item.count}
                  </span>
                  <span className="text-muted-foreground text-xs tabular-nums w-8 text-right">
                    {item.percentage}%
                  </span>
                </div>
              </button>
            );
          })}
          {chartData.length > 6 && (
            <div className="text-xs text-muted-foreground pt-1">
              +{chartData.length - 6} more
            </div>
          )}
        </div>
      </div>

      {/* View calls button */}
      {onViewStatus && data.length > 0 && (
        <div className="mt-auto pt-3 border-t border-border">
          <button
            onClick={() => onViewStatus(data[0])}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors ml-auto"
          >
            View calls
            <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

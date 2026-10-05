'use client'

import {
  Briefcase,
  Trophy,
  DollarSign,
  CalendarClock,
  Gauge,
} from 'lucide-react'
import { formatCurrency, formatDays, formatPercent } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

function SummaryCard({
  icon: Icon,
  label,
  value,
  subValue,
  isLoading,
}: {
  icon: React.ElementType
  label: string
  value: string
  subValue?: string
  isLoading?: boolean
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
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-2xl font-medium text-foreground">{value}</span>
          {subValue && (
            <span className="text-sm text-muted-foreground">{subValue}</span>
          )}
        </div>
      )}
    </div>
  )
}

export function DealSummaryRow({
  summary,
  isLoading,
}: {
  summary?: DealMetricsResponse['summary']
  isLoading?: boolean
}) {
  const s = summary
  const closed = (s?.wonDeals ?? 0) + (s?.lostDeals ?? 0)
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <SummaryCard
        icon={Briefcase}
        label="Open Pipeline"
        value={formatCurrency(s?.openPipelineValue ?? 0)}
        subValue={`${s?.openDeals ?? 0} deals`}
        isLoading={isLoading}
      />
      <SummaryCard
        icon={Trophy}
        label="Win Rate"
        value={closed ? formatPercent(s?.winRate ?? 0) : '—'}
        subValue={closed ? `${s?.wonDeals}W / ${s?.lostDeals}L` : 'no closes yet'}
        isLoading={isLoading}
      />
      <SummaryCard
        icon={DollarSign}
        label="Avg Won Deal"
        value={s?.wonDeals ? formatCurrency(s.avgWonDealSize) : '—'}
        subValue={s?.wonDeals ? `${formatCurrency(s.wonValue)} won` : undefined}
        isLoading={isLoading}
      />
      <SummaryCard
        icon={CalendarClock}
        label="Sales Cycle"
        value={s?.avgSalesCycleDays ? formatDays(s.avgSalesCycleDays) : '—'}
        subValue={
          s?.avgSalesCycleDays
            ? s.salesCycleBasis === 'first_touch'
              ? 'first touch → win'
              : 'stage entry → win'
            : undefined
        }
        isLoading={isLoading}
      />
      <SummaryCard
        icon={Gauge}
        label="Sales Velocity"
        value={s?.salesVelocityPerDay ? formatCurrency(s.salesVelocityPerDay) : '—'}
        subValue={s?.salesVelocityPerDay ? '/ day' : undefined}
        isLoading={isLoading}
      />
    </div>
  )
}

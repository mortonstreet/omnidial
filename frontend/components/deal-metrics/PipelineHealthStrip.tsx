'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useDealMetrics } from '@/hooks/api/useDealMetrics'
import { formatCurrency, formatDays, formatPercent } from './format'

/** Compact deal-health row for the main dashboard; full view lives on the CRM tab. */
export function PipelineHealthStrip({
  startDate,
  endDate,
  clientId,
}: {
  startDate: string
  endDate: string
  clientId?: string
}) {
  const { data, isLoading } = useDealMetrics({ startDate, endDate, clientId })
  const m = data?.data

  // Every value shows its sample, or "—" with what would fill it in.
  const closed = m ? m.summary.wonDeals + m.summary.lostDeals : 0
  const calling = m?.activity.calling
  const items: Array<{ label: string; value: string; hint?: string }> = [
    {
      label: 'Win rate',
      value: closed ? formatPercent(m!.summary.winRate) : '—',
      hint: closed ? `${m!.summary.wonDeals} won of ${closed}` : 'no closes yet',
    },
    {
      label: 'Sales cycle',
      value: m?.summary.avgSalesCycleDays ? formatDays(m.summary.avgSalesCycleDays) : '—',
      hint: m?.summary.avgSalesCycleDays
        ? m.summary.salesCycleBasis === 'first_touch'
          ? 'first touch → win'
          : 'stage entry → win'
        : 'needs a won deal',
    },
    {
      label: 'Conversation rate',
      value: calling?.conversationRate != null ? formatPercent(calling.conversationRate) : '—',
      hint: calling ? `${calling.conversations} of ${calling.dials} dials` : undefined,
    },
    {
      label: 'Next step secured',
      value: m && m.nextSteps.touchpoints ? formatPercent(m.nextSteps.securedRate) : '—',
      hint: m && m.nextSteps.touchpoints ? `${m.nextSteps.touchpoints} touchpoints scored` : 'score calls in Settings',
    },
    {
      label: 'Avg won deal',
      value: m && m.summary.wonDeals && m.summary.avgWonDealSize > 0 ? formatCurrency(m.summary.avgWonDealSize) : '—',
      hint: m && m.summary.wonDeals && !m.summary.avgWonDealSize ? 'add deal values' : undefined,
    },
  ]

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-sm font-medium text-foreground">Pipeline health</h3>
        <Link
          href="/dashboard/crm?tab=metrics"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View deal metrics
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <div className="text-xs text-muted-foreground truncate">
              {item.label}
            </div>
            {isLoading ? (
              <div className="h-6 mt-1 bg-muted rounded animate-pulse w-14" />
            ) : (
              <div className="text-lg font-medium text-foreground">
                {item.value}
              </div>
            )}
            {item.hint && !isLoading && (
              <div className="text-xs text-muted-foreground truncate">{item.hint}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useDealMetrics } from '@/hooks/api/useDealMetrics'
import { formatCurrency, formatPercent, formatScore } from './format'

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

  const items = [
    { label: 'Win rate', value: m ? formatPercent(m.summary.winRate) : '—' },
    {
      label: 'Avg won deal',
      value: m ? formatCurrency(m.summary.avgWonDealSize) : '—',
    },
    {
      label: 'Sales velocity',
      value: m ? `${formatCurrency(m.summary.salesVelocityPerDay)}/day` : '—',
    },
    {
      label: 'Next step secured',
      value:
        m && m.nextSteps.touchpoints
          ? formatPercent(m.nextSteps.securedRate)
          : '—',
    },
    {
      label: 'Avg champion',
      value:
        m && m.champions.dealsScored
          ? formatScore(m.champions.avgChampionScore)
          : '—',
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
          </div>
        ))}
      </div>
    </div>
  )
}

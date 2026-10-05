'use client'

import { Scale } from 'lucide-react'
import { EmptyMetric, MetricSection, Stat } from './MetricSection'
import { formatCurrency, formatSignedPercent } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

export function DealSizeSection({
  dealSize,
  isLoading,
}: {
  dealSize?: DealMetricsResponse['dealSize']
  isLoading?: boolean
}) {
  const d = dealSize
  const drift = d?.avgValueDriftPct ?? 0

  return (
    <MetricSection
      icon={Scale}
      title="Deal Size"
      description="Are deals closing above or below the first quote?"
      isLoading={isLoading}
    >
      {d && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* "—" when no deal in the group has a value, never a fake $0. */}
            <Stat label="Avg won" value={d.avgWon ? formatCurrency(d.avgWon) : '—'} />
            <Stat label="Median won" value={d.medianWon ? formatCurrency(d.medianWon) : '—'} />
            <Stat label="Avg lost" value={d.avgLost ? formatCurrency(d.avgLost) : '—'} />
            <Stat label="Avg open" value={d.avgOpen ? formatCurrency(d.avgOpen) : '—'} />
          </div>

          {d.comparableWonDeals === 0 ? (
            <EmptyMetric>
              Set deal values to compare closes against first quotes.
            </EmptyMetric>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat
                label="Quote → close drift"
                value={formatSignedPercent(drift)}
                tone={drift < -2 ? 'bad' : drift > 2 ? 'good' : 'default'}
                hint={`vs ${formatCurrency(d.avgInitialQuote)} avg first quote`}
              />
              <Stat
                label="Closed below quote"
                value={d.closedBelowQuote}
                tone={d.closedBelowQuote > 0 ? 'warn' : 'default'}
                hint={`of ${d.comparableWonDeals} won`}
              />
              <Stat
                label="Closed above quote"
                value={d.closedAboveQuote}
                tone={d.closedAboveQuote > 0 ? 'good' : 'default'}
              />
              <Stat
                label="Money left on the table"
                value={formatCurrency(d.discountGiven)}
                tone={d.discountGiven > 0 ? 'bad' : 'default'}
                hint="discounts off first quote"
              />
            </div>
          )}

          {d.lostPipelineValue > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(d.lostPipelineValue)} of pipeline lost this
              period.
            </p>
          )}
        </div>
      )}
    </MetricSection>
  )
}

'use client'

import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyMetric, MetricSection } from './MetricSection'
import { formatPercent } from './format'
import type { StageConversionItem } from '@shared/types/src/requests/dealMetrics'

/** Ignore stages with too few entries to call them the weakest. */
const MIN_ENTRIES_FOR_WEAKEST = 3

export function ConversionSection({
  conversion,
  isLoading,
}: {
  conversion?: StageConversionItem[]
  isLoading?: boolean
}) {
  const stages = (conversion ?? []).filter((s) => s.entered > 0)
  const candidates = stages.filter((s) => s.entered >= MIN_ENTRIES_FOR_WEAKEST)
  const weakest = candidates.length
    ? candidates.reduce((worst, s) => (s.conversionRate < worst.conversionRate ? s : worst))
    : undefined

  return (
    <MetricSection
      icon={Filter}
      title="Stage Conversion"
      description="Share of deals entering each stage that moved forward. The weakest stage is in red."
      isLoading={isLoading}
    >
      {stages.length === 0 ? (
        <EmptyMetric>Fills in as deals move between stages.</EmptyMetric>
      ) : (
        <ul className="space-y-2.5">
          {stages.map((stage) => {
            const isWeakest = weakest?.stageId === stage.stageId
            return (
              <li
                key={stage.stageId}
                className="grid grid-cols-[minmax(0,9rem)_1fr_auto_auto] items-center gap-3 text-sm"
                title={`${stage.entered} entered · ${stage.advanced} advanced · ${stage.lost} lost · ${stage.stalled} still there`}
              >
                <span className="truncate text-foreground">{stage.label}</span>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${stage.conversionRate * 100}%`, backgroundColor: stage.color }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {stage.advanced}/{stage.entered}
                </span>
                <span
                  className={cn(
                    'w-10 text-right font-medium tabular-nums',
                    isWeakest ? 'text-red-600 dark:text-red-400' : 'text-foreground',
                  )}
                >
                  {formatPercent(stage.conversionRate)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </MetricSection>
  )
}

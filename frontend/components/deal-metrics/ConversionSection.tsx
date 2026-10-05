'use client'

import { Filter, Skull } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyMetric, MetricSection } from './MetricSection'
import { formatPercent } from './format'
import type { StageConversionItem } from '@shared/types/src/requests/dealMetrics'

/** Ignore stages with too few entries to call them the leak. */
const MIN_ENTRIES_FOR_LEAK = 3

export function ConversionSection({
  conversion,
  isLoading,
}: {
  conversion?: StageConversionItem[]
  isLoading?: boolean
}) {
  const stages = conversion ?? []
  const maxEntered = Math.max(1, ...stages.map((s) => s.entered))
  const candidates = stages.filter((s) => s.entered >= MIN_ENTRIES_FOR_LEAK)
  const leak = candidates.length
    ? candidates.reduce((worst, s) =>
        s.conversionRate < worst.conversionRate ? s : worst,
      )
    : undefined

  return (
    <MetricSection
      icon={Filter}
      title="Stage Conversion"
      description="Of deals entering each stage: advanced, lost, or still stuck"
      isLoading={isLoading}
    >
      {stages.every((s) => s.entered === 0) ? (
        <EmptyMetric>
          Conversion is measured from stage moves. Drag deals forward (or to a
          Won/Lost stage) and this fills in.
        </EmptyMetric>
      ) : (
        <div className="space-y-3">
          {stages.map((stage) => {
            const isLeak = leak?.stageId === stage.stageId
            const pct = (n: number) =>
              stage.entered ? (n / stage.entered) * 100 : 0
            return (
              <div key={stage.stageId}>
                <div className="flex items-center justify-between gap-2 text-sm mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{stage.label}</span>
                    {isLeak && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                        <Skull className="w-3 h-3" />
                        Where deals die
                      </span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'font-medium shrink-0',
                      isLeak
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-foreground',
                    )}
                  >
                    {formatPercent(stage.conversionRate)}
                  </span>
                </div>
                <div
                  className="h-3 rounded-full bg-muted overflow-hidden flex"
                  style={{
                    width: `${Math.max(8, (stage.entered / maxEntered) * 100)}%`,
                  }}
                  title={`${stage.advanced} advanced · ${stage.lost} lost · ${stage.stalled} stalled`}
                >
                  <div
                    style={{
                      width: `${pct(stage.advanced)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                  <div
                    className="bg-red-500/70"
                    style={{ width: `${pct(stage.lost)}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {stage.entered} entered · {stage.advanced} advanced ·{' '}
                  {stage.lost} lost · {stage.stalled} stalled
                </div>
              </div>
            )
          })}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Advanced
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500/70" /> Lost
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-muted border border-border" />{' '}
              Stalled
            </span>
          </div>
        </div>
      )}
    </MetricSection>
  )
}

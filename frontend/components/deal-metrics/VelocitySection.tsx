'use client'

import { Timer, TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyMetric, MetricSection } from './MetricSection'
import { formatDays } from './format'
import type {
  StageTrend,
  StageVelocity,
} from '@shared/types/src/requests/dealMetrics'

const TREND: Record<
  StageTrend,
  { label: string; icon: React.ElementType; className: string }
> = {
  speeding_up: {
    label: 'Speeding up',
    icon: TrendingDown,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
  slowing_down: {
    label: 'Slowing down',
    icon: TrendingUp,
    className: 'bg-red-500/10 text-red-600 dark:text-red-400',
  },
  steady: {
    label: 'Steady',
    icon: Minus,
    className: 'bg-muted text-muted-foreground',
  },
  no_data: {
    label: 'No baseline',
    icon: Minus,
    className: 'bg-muted text-muted-foreground/70',
  },
}

function TrendBadge({ trend }: { trend: StageTrend }) {
  const t = TREND[trend]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        t.className,
      )}
    >
      <t.icon className="w-3 h-3" />
      {t.label}
    </span>
  )
}

export function VelocitySection({
  velocity,
  isLoading,
}: {
  velocity?: StageVelocity[]
  isLoading?: boolean
}) {
  const stages = velocity ?? []
  const hasData = stages.some((s) => s.samples > 0 || s.currentDeals > 0)

  return (
    <MetricSection
      icon={Timer}
      title="Pipeline Velocity"
      description="Time deals spend in each stage, vs the previous period"
      isLoading={isLoading}
    >
      {!hasData ? (
        <EmptyMetric>
          Move deals between stages to start measuring velocity — stage history
          starts from this release.
        </EmptyMetric>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th className="font-normal py-1.5 px-1">Stage</th>
                <th className="font-normal py-1.5 px-1 text-right">Avg</th>
                <th className="font-normal py-1.5 px-1 text-right">Median</th>
                <th className="font-normal py-1.5 px-1 text-right">Exits</th>
                <th className="font-normal py-1.5 px-1 text-right">
                  Sitting now
                </th>
                <th className="font-normal py-1.5 px-1 text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stages.map((stage) => (
                <tr key={stage.stageId}>
                  <td className="py-2 px-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="truncate">{stage.label}</span>
                    </div>
                  </td>
                  <td className="py-2 px-1 text-right">
                    {stage.samples > 0 ? formatDays(stage.avgDays) : '—'}
                    {stage.samples > 0 && stage.previousAvgDays > 0 && (
                      <div className="text-xs text-muted-foreground">
                        was {formatDays(stage.previousAvgDays)}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {stage.samples > 0 ? formatDays(stage.medianDays) : '—'}
                  </td>
                  <td className="py-2 px-1 text-right text-muted-foreground">
                    {stage.samples}
                  </td>
                  <td className="py-2 px-1 text-right">
                    {stage.currentDeals}
                    {stage.currentDeals > 0 && stage.avgDaysInStageNow > 0 && (
                      <div className="text-xs text-muted-foreground">
                        avg {formatDays(stage.avgDaysInStageNow)}
                      </div>
                    )}
                  </td>
                  <td className="py-2 px-1 text-right">
                    <TrendBadge trend={stage.trend} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MetricSection>
  )
}

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
  // Stay/trend columns only mean something once deals have moved stages.
  const hasMoves = stages.some((s) => s.samples > 0)

  return (
    <MetricSection
      icon={Timer}
      title="Pipeline Velocity"
      description="Time deals spend in each stage, vs the previous period"
      isLoading={isLoading}
    >
      {!hasData ? (
        <EmptyMetric>Fills in as deals move between stages.</EmptyMetric>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th className="font-normal py-1.5 px-1">Stage</th>
                <th className="font-normal py-1.5 px-1 text-right">Deals</th>
                <th className="font-normal py-1.5 px-1 text-right" title="Average time the deals there now have been in the stage">
                  In stage
                </th>
                {hasMoves && (
                  <th className="font-normal py-1.5 px-1 text-right" title="Average time deals spent in the stage before moving on">
                    Avg stay
                  </th>
                )}
                {hasMoves && <th className="font-normal py-1.5 px-1 text-right">Trend</th>}
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
                  <td className="py-2 px-1 text-right tabular-nums">{stage.currentDeals}</td>
                  <td className="py-2 px-1 text-right tabular-nums text-muted-foreground">
                    {stage.currentDeals > 0 && stage.avgDaysInStageNow > 0
                      ? formatDays(stage.avgDaysInStageNow)
                      : '—'}
                  </td>
                  {hasMoves && (
                    <td
                      className="py-2 px-1 text-right tabular-nums"
                      title={stage.samples ? `${stage.samples} exits · median ${formatDays(stage.medianDays)}` : undefined}
                    >
                      {stage.samples > 0 ? formatDays(stage.avgDays) : '—'}
                    </td>
                  )}
                  {hasMoves && (
                    <td className="py-2 px-1 text-right">
                      {stage.trend !== 'no_data' && <TrendBadge trend={stage.trend} />}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </MetricSection>
  )
}

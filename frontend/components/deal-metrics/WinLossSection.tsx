'use client'

import { Swords, AlertTriangle } from 'lucide-react'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { DealList, EmptyMetric, MetricSection, Stat } from './MetricSection'
import { formatDays, formatDuration, formatPercent } from './format'
import {
  DEAL_LOSS_REASONS,
  DEAL_WIN_REASONS,
  type DealMetricsResponse,
  type ReasonCount,
} from '@shared/types/src/requests/dealMetrics'

const reasonLabel = (reason: string | null) =>
  reason
    ? ([...DEAL_LOSS_REASONS, ...DEAL_WIN_REASONS].find(
        (r) => r.value === reason,
      )?.label ?? reason)
    : null

function ReasonChart({ data, color }: { data: ReasonCount[]; color: string }) {
  return (
    <div style={{ height: Math.max(80, data.length * 30) }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={130}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [`${value} deals`, 'Count']}
          />
          <Bar
            dataKey="count"
            fill={color}
            radius={[0, 4, 4, 0]}
            barSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function WinLossSection({
  winLoss,
  isLoading,
}: {
  winLoss?: DealMetricsResponse['winLoss']
  isLoading?: boolean
}) {
  const w = winLoss

  return (
    <MetricSection
      icon={Swords}
      title="Win / Loss Patterns"
      description="Why deals close or die — every close needs a reason"
      isLoading={isLoading}
    >
      {w &&
        (w.won + w.lost === 0 ? (
          <EmptyMetric>
            No deals closed in this period. Move a deal to a Won or Lost stage
            (or mark it from the lead page) and record why.
          </EmptyMetric>
        ) : (
          <div className="space-y-4">
            {w.missingReason > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {w.missingReason} closed deal
                  {w.missingReason !== 1 ? 's' : ''} missing a reason — reflect
                  and record why while it is fresh.
                </span>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <Stat label="Won" value={w.won} tone="good" />
              <Stat
                label="Lost"
                value={w.lost}
                tone={w.lost > 0 ? 'bad' : 'default'}
              />
              <Stat label="Win rate" value={formatPercent(w.winRate)} />
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-3">
              <Stat
                label="Cycle: won vs lost"
                value={`${formatDays(w.avgCycleWonDays)} / ${formatDays(w.avgCycleLostDays)}`}
              />
              <Stat
                label="Talk time: won vs lost"
                value={`${formatDuration(w.avgTalkTimeWonSeconds)} / ${formatDuration(w.avgTalkTimeLostSeconds)}`}
                hint="avg per deal"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Loss reasons
                </div>
                {w.lossReasons.length ? (
                  <ReasonChart data={w.lossReasons} color="#DC2626" />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No loss reasons recorded.
                  </p>
                )}
              </div>
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Win reasons
                </div>
                {w.winReasons.length ? (
                  <ReasonChart data={w.winReasons} color="#059669" />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No win reasons recorded.
                  </p>
                )}
              </div>
            </div>

            <DealList
              title="Recent closes"
              deals={w.recent}
              emptyText="No recent closes."
              detail={(deal) => (
                <>
                  <div
                    className={cn(
                      'font-medium',
                      deal.outcome === 'won'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    {deal.outcome === 'won' ? 'Won' : 'Lost'}
                  </div>
                  <div className="truncate">
                    {reasonLabel(deal.reason) ?? 'No reason'}
                  </div>
                </>
              )}
            />
          </div>
        ))}
    </MetricSection>
  )
}

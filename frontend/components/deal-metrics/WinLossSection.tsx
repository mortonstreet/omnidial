'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Swords, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DealOutcomeDialog } from '@/components/crm/DealOutcomeDialog'
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { EmptyMetric, MetricSection, Stat } from './MetricSection'
import { formatCurrency, formatDays, formatDuration, formatPercent, leadHref } from './format'
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
  const [reasonFor, setReasonFor] = useState<RecentClose | null>(null)

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
            No deals closed in this period.
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

            <RecentCloses deals={w.recent} onAddReason={setReasonFor} />
          </div>
        ))}
      {reasonFor && (
        <DealOutcomeDialog
          open
          onOpenChange={(open) => !open && setReasonFor(null)}
          leadId={reasonFor.leadId}
          leadName={reasonFor.name}
          outcome={reasonFor.outcome}
        />
      )}
    </MetricSection>
  )
}

type RecentClose = DealMetricsResponse['winLoss']['recent'][number]

/** Recent closes with inline fixes: record a missing reason or deal value. */
function RecentCloses({
  deals,
  onAddReason,
}: {
  deals: RecentClose[]
  onAddReason: (deal: RecentClose) => void
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Recent closes{deals.length > 0 && <span className="ml-1 tabular-nums">({deals.length})</span>}
      </div>
      {deals.length === 0 ? (
        <p className="text-xs text-muted-foreground">No recent closes.</p>
      ) : (
        <ul className="divide-y divide-border max-h-72 overflow-y-auto overscroll-contain pr-1">
          {deals.map((deal) => (
            <li key={deal.leadId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <Link href={leadHref(deal.leadId)} className="text-sm text-foreground hover:underline truncate block">
                  {deal.name}
                </Link>
                <div className="text-xs text-muted-foreground truncate">
                  {deal.dealValue !== null ? (
                    formatCurrency(deal.dealValue)
                  ) : (
                    <Link href={leadHref(deal.leadId)} className="text-amber-600 dark:text-amber-400 hover:underline">
                      Add deal value
                    </Link>
                  )}
                  {deal.closedAt && ` · ${new Date(deal.closedAt).toLocaleDateString()}`}
                </div>
              </div>
              <div className="text-xs text-right shrink-0">
                <div
                  className={cn(
                    'font-medium',
                    deal.outcome === 'won' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                  )}
                >
                  {deal.outcome === 'won' ? 'Won' : 'Lost'}
                </div>
                {deal.reason ? (
                  <div className="text-muted-foreground">{reasonLabel(deal.reason)}</div>
                ) : (
                  <Button size="sm" variant="outline" className="h-6 px-2 mt-1 text-xs" onClick={() => onAddReason(deal)}>
                    Add reason
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

'use client'

import { Route } from 'lucide-react'
import { DealList, EmptyMetric, MetricSection, Stat } from './MetricSection'
import { formatDays } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

const hours = (h: number | null) =>
  h === null ? '—' : h < 48 ? `${Math.round(h)}h` : formatDays(h / 24)
const num = (n: number | null, suffix = '') => (n === null ? '—' : `${n}${suffix}`)

/**
 * The sales process from real timestamps: every call, email message and
 * meeting. Cycle, touches, reply times and silence come from receipts.
 */
export function SalesProcessSection({
  process,
  isLoading,
}: {
  process?: DealMetricsResponse['salesProcess']
  isLoading?: boolean
}) {
  const p = process
  const periodTouches = p ? p.touchesInPeriod.call + p.touchesInPeriod.email + p.touchesInPeriod.meeting : 0
  const hasData = !!p && (periodTouches > 0 || p.wonWithTouches > 0 || p.quietDeals.length > 0)

  return (
    <MetricSection
      icon={Route}
      title="Sales Process"
      description="From every call, email message and meeting: real first-touch-to-close, touches, reply times and gaps"
      isLoading={isLoading}
      className="xl:col-span-2"
    >
      {!p || !hasData ? (
        <EmptyMetric>Fills in from calls, Gmail threads and Grain meetings.</EmptyMetric>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat
                label="First touch → won"
                value={p.avgFirstTouchToCloseDays === null ? '—' : formatDays(p.avgFirstTouchToCloseDays)}
                hint={p.medianFirstTouchToCloseDays !== null ? `median ${formatDays(p.medianFirstTouchToCloseDays)}` : undefined}
              />
              <Stat
                label="Touches to win"
                value={num(p.avgTouchesToWin)}
                hint={
                  p.avgTouchesToWin !== null
                    ? `${num(p.touchesToWinByKind.call)} calls · ${num(p.touchesToWinByKind.email)} emails · ${num(p.touchesToWinByKind.meeting)} mtgs`
                    : undefined
                }
              />
              <Stat label="Buyer replies in" value={hours(p.medianBuyerReplyHours)} hint="median" />
              <Stat label="We reply in" value={hours(p.medianRepReplyHours)} hint="median" />
              <Stat
                label="Typical gap"
                value={p.typicalGapDays === null ? '—' : formatDays(p.typicalGapDays)}
                hint="between touches"
              />
              <Stat
                label="To first meeting"
                value={p.medianDaysToFirstMeeting === null ? '—' : formatDays(p.medianDaysToFirstMeeting)}
                hint="from first touch"
              />
              <Stat label="Talk time to win" value={num(p.avgTalkMinutesToWin, 'm')} />
              <Stat
                label="Touches this period"
                value={periodTouches}
                hint={`${p.touchesInPeriod.call} calls · ${p.touchesInPeriod.email} emails · ${p.touchesInPeriod.meeting} mtgs`}
              />
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto pr-1">
          <DealList
            title={`Gone quiet${p.quietDeals.length ? ` (${p.quietDeals.length})` : ''}`}
            deals={p.quietDeals}
            emptyText={
              p.typicalGapDays === null
                ? 'Needs touch history to know your rhythm.'
                : `No open deal silent longer than ${formatDays(p.typicalGapDays * 2)}.`
            }
            detail={(d) => (
              <span title={`Last touch ${new Date(d.lastTouchAt).toLocaleDateString()}`}>
                {formatDays(d.daysSilent)} silent
              </span>
            )}
          />
          </div>
        </div>
      )}
    </MetricSection>
  )
}

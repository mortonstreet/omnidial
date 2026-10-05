'use client'

import { CalendarCheck, Phone, Mail, Video } from 'lucide-react'
import { DealList, EmptyMetric, MetricSection, Stat } from './MetricSection'
import { formatPercent, formatRelative, formatScore } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

const CHANNELS = [
  { key: 'call', label: 'Calls', icon: Phone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'meeting', label: 'Meetings', icon: Video },
] as const

export function NextStepsSection({
  nextSteps,
  isLoading,
}: {
  nextSteps?: DealMetricsResponse['nextSteps']
  isLoading?: boolean
}) {
  const n = nextSteps

  return (
    <MetricSection
      icon={CalendarCheck}
      title="Next Step Quality"
      description="Did each touchpoint lock in a specific, dated next step?"
      isLoading={isLoading}
    >
      {n && (
        <div className="space-y-4">
          {n.touchpoints === 0 ? (
            <EmptyMetric>
              No scored touchpoints yet.
            </EmptyMetric>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <Stat
                  label="Secured on touchpoint"
                  value={formatPercent(n.securedRate)}
                  tone={
                    n.securedRate >= 0.5
                      ? 'good'
                      : n.securedRate < 0.25
                        ? 'bad'
                        : 'warn'
                  }
                  hint={`${n.secured} of ${n.touchpoints}`}
                />
                <Stat
                  label="Avg next-step score"
                  value={formatScore(n.avgScore)}
                />
                <Stat
                  label="Any next step"
                  value={n.withNextStep}
                  hint={`of ${n.touchpoints}`}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map(({ key, label, icon: Icon }) => {
                  const c = n.byChannel[key]
                  return (
                    <div key={key} className="rounded-lg bg-muted/50 p-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                        <Icon className="w-3.5 h-3.5" />
                        {label}
                      </div>
                      <div className="text-sm font-medium text-foreground">
                        {c.touchpoints
                          ? formatPercent(c.secured / c.touchpoints)
                          : '—'}
                        <span className="text-xs font-normal text-muted-foreground">
                          {' '}
                          secured
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.touchpoints} scored · {c.withNextStep} w/ step
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <DealList
            title="Open deals without a secured next step"
            deals={n.openDealsWithoutSecuredNextStep}
            emptyText="Every open deal has a future touchpoint booked."
            detail={(deal) => (
              <>
                <div className="truncate">
                  {deal.lastNextStep ?? 'No next step'}
                </div>
                <div>last touch {formatRelative(deal.lastTouchAt)}</div>
              </>
            )}
          />
        </div>
      )}
    </MetricSection>
  )
}

'use client'

import { Megaphone } from 'lucide-react'
import { DealList, EmptyMetric, MetricSection, Stat } from './MetricSection'
import { formatPercent, formatScore } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

export function ChampionsSection({
  champions,
  isLoading,
}: {
  champions?: DealMetricsResponse['champions']
  isLoading?: boolean
}) {
  const c = champions

  return (
    <MetricSection
      icon={Megaphone}
      title="Champion Engagement"
      description="Is someone on the buyer side advocating for you? (latest touchpoint per open deal)"
      isLoading={isLoading}
    >
      {c &&
        (c.dealsScored === 0 ? (
          <EmptyMetric>
            Champion scores come from AI review of calls, email threads and
            meetings with open deals. Score touchpoints to see who is
            advocating.
          </EmptyMetric>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Stat
                label="Deals with a champion"
                value={formatPercent(c.withChampion / c.dealsScored)}
                hint={`${c.withChampion} of ${c.dealsScored} scored`}
                tone={c.withChampion / c.dealsScored >= 0.5 ? 'good' : 'warn'}
              />
              <Stat
                label="Avg champion"
                value={formatScore(c.avgChampionScore)}
              />
              <Stat
                label="Avg engagement"
                value={formatScore(c.avgEngagementScore)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <DealList
                title="Strong champions"
                deals={c.strong}
                emptyText="No deal has a strong champion yet."
                detail={(deal) => (
                  <>
                    <div className="truncate">
                      {deal.championName ?? 'Unnamed'}
                    </div>
                    <div>{deal.championScore}/10</div>
                  </>
                )}
              />
              <DealList
                title="At risk — no advocate"
                deals={c.atRisk}
                emptyText="No open deal is missing an advocate."
                detail={(deal) => (
                  <>
                    <div>champion {deal.championScore ?? '—'}/10</div>
                    <div>engagement {deal.engagementScore ?? '—'}/10</div>
                  </>
                )}
              />
            </div>
          </div>
        ))}
    </MetricSection>
  )
}

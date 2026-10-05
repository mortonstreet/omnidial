'use client'

import { Clock, Star } from 'lucide-react'
import { MetricSection, Stat } from './MetricSection'
import { formatDuration, formatScore } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

export function ActivitySection({
  activity,
  isLoading,
}: {
  activity?: DealMetricsResponse['activity']
  isLoading?: boolean
}) {
  const a = activity

  return (
    <MetricSection
      icon={Clock}
      title="Activity & Call Quality"
      description="Time in conversation, and how well those conversations went"
      isLoading={isLoading}
    >
      {a && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-500/50 ring-1 ring-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">
                Total talk time
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 px-2 py-0.5 text-xs font-medium">
                <Star className="w-3 h-3 fill-current" />
                Success metric
              </span>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl font-semibold text-foreground">
                {formatDuration(a.totalTalkTimeSeconds)}
              </span>
              <span className="text-sm text-muted-foreground">
                {a.connectedCalls} connected calls
                {a.talkTimePerWonDealSeconds > 0 &&
                  ` · ${formatDuration(a.talkTimePerWonDealSeconds)} per won deal`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Coaching score"
              value={a.coachedCalls ? formatScore(a.avgCoachingScore) : '—'}
              hint={`${a.coachedCalls} calls coached`}
            />
            <Stat
              label="AI call quality"
              value={a.callsScored ? formatScore(a.avgCallQuality) : '—'}
              hint={`${a.callsScored} calls scored`}
            />
            <Stat
              label="Meeting quality"
              value={a.meetingsScored ? formatScore(a.avgMeetingQuality) : '—'}
              hint={
                a.meetingsScored
                  ? `${a.meetingsScored} Grain meetings`
                  : 'connect Grain'
              }
            />
            <Stat
              label="Email threads scored"
              value={a.emailThreadsScored}
              hint={a.emailThreadsScored ? 'from Gmail' : 'connect Gmail'}
            />
          </div>
        </div>
      )}
    </MetricSection>
  )
}

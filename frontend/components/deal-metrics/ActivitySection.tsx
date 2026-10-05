'use client'

import { Clock, Star } from 'lucide-react'
import { MetricSection, Stat } from './MetricSection'
import { formatDuration, formatPercent, formatScore } from './format'
import type { DealMetricsResponse } from '@shared/types/src/requests/dealMetrics'

/** One step of the calling funnel, sized against the step before it. */
function FunnelStep({
  label,
  value,
  rate,
  width,
  tone,
}: {
  label: string
  value: number
  rate?: string | null
  width: number
  tone: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          <span className="font-medium text-foreground">{value.toLocaleString()}</span>
          {rate && <span className="text-xs text-muted-foreground ml-1.5">{rate}</span>}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.max(width, value ? 2 : 0)}%` }} />
      </div>
    </div>
  )
}

export function ActivitySection({
  activity,
  isLoading,
}: {
  activity?: DealMetricsResponse['activity']
  isLoading?: boolean
}) {
  const a = activity
  const c = a?.calling

  return (
    <MetricSection
      icon={Clock}
      title="Calling"
      description="Dials, real conversations (voicemail greetings excluded) and the steps forward they produce"
      isLoading={isLoading}
    >
      {a && c && (
        <div className="space-y-5">
          <div className="rounded-lg border border-amber-500/50 ring-1 ring-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs text-muted-foreground">Total talk time</span>
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
                {formatDuration(c.conversationSeconds)} in real conversations
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <FunnelStep label="Dials" value={c.dials} width={100} tone="bg-foreground/30" />
            <FunnelStep
              label="Conversations"
              value={c.conversations}
              rate={c.conversationRate !== null ? formatPercent(c.conversationRate) : null}
              width={c.dials ? (c.conversations / c.dials) * 100 : 0}
              tone="bg-blue-500"
            />
            <FunnelStep
              label="Steps forward"
              value={c.positiveOutcomes}
              rate={c.positiveRate !== null ? `${formatPercent(c.positiveRate)} of conversations` : null}
              width={c.dials ? (c.positiveOutcomes / c.dials) * 100 : 0}
              tone="bg-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat
              label="Avg conversation"
              value={c.avgConversationSeconds !== null ? formatDuration(c.avgConversationSeconds) : '—'}
              hint={c.medianConversationSeconds !== null ? `median ${formatDuration(c.medianConversationSeconds)}` : undefined}
            />
            <Stat
              label="Dials per conversation"
              value={c.dialsPerConversation ?? '—'}
            />
            <Stat
              label="Voicemails"
              value={c.voicemails.toLocaleString()}
              hint={c.badNumbers ? `${c.badNumbers} bad numbers` : undefined}
            />
            <Stat
              label="Call quality"
              value={a.callsScored ? formatScore(a.avgCallQuality) : a.coachedCalls ? formatScore(a.avgCoachingScore) : '—'}
              hint={a.callsScored ? `${a.callsScored} calls AI-scored` : a.coachedCalls ? `${a.coachedCalls} calls coached` : undefined}
            />
          </div>
          {c.voicemailCutoffSeconds !== null && (
            <p className="text-xs text-muted-foreground">
              Undispositioned calls longer than your typical voicemail ({c.voicemailCutoffSeconds}s) count as conversations.
              {c.unclear > 0 && ` ${c.unclear.toLocaleString()} shorter ones are left out.`}
            </p>
          )}
        </div>
      )}
    </MetricSection>
  )
}

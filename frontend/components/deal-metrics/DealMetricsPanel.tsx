'use client'

import { useMemo, useState } from 'react'
import {
  endOfDay,
  startOfDay,
  startOfQuarter,
  subDays,
  subMonths,
} from 'date-fns'
import { useDealMetrics } from '@/hooks/api/useDealMetrics'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DealSummaryRow } from './DealSummaryRow'
import { VelocitySection } from './VelocitySection'
import { ConversionSection } from './ConversionSection'
import { DealSizeSection } from './DealSizeSection'
import { NextStepsSection } from './NextStepsSection'
import { ChampionsSection } from './ChampionsSection'
import { WinLossSection } from './WinLossSection'
import { ActivitySection } from './ActivitySection'
import { SignalSourcesStrip } from './SignalSourcesStrip'
import { HubSpotSyncPanel } from './HubSpotSyncPanel'

type RangeKey = '30d' | '90d' | 'qtd' | '12m'

const RANGE_LABELS: Record<RangeKey, string> = {
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  qtd: 'Quarter to date',
  '12m': 'Last 12 months',
}

const rangeStart = (key: RangeKey, now: Date) => {
  switch (key) {
    case '30d':
      return subDays(now, 30)
    case 'qtd':
      return startOfQuarter(now)
    case '12m':
      return subMonths(now, 12)
    default:
      return subDays(now, 90)
  }
}

export function DealMetricsPanel({ clientId }: { clientId?: string }) {
  const [range, setRange] = useState<RangeKey>('90d')

  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    return {
      startDate: startOfDay(rangeStart(range, now)).toISOString(),
      endDate: endOfDay(now).toISOString(),
    }
  }, [range])

  const { data, isLoading, isError, error } = useDealMetrics({
    startDate,
    endDate,
    clientId,
  })
  const metrics = data?.data

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          How fast deals move, where they die, and what is driving wins and
          losses.
        </p>
        <Select
          value={range}
          onValueChange={(value) => setRange(value as RangeKey)}
        >
          <SelectTrigger className="w-[170px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
              <SelectItem key={key} value={key}>
                {RANGE_LABELS[key]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
          Could not load deal metrics
          {error instanceof Error ? `: ${error.message}` : ''}
        </div>
      )}

      <SignalSourcesStrip sources={metrics?.sources} />
      <HubSpotSyncPanel connected={!!metrics?.sources.hubspot.connected} />
      <DealSummaryRow summary={metrics?.summary} isLoading={isLoading} />

      <div className="grid gap-4 xl:grid-cols-2">
        <VelocitySection velocity={metrics?.velocity} isLoading={isLoading} />
        <ConversionSection
          conversion={metrics?.conversion}
          isLoading={isLoading}
        />
        <NextStepsSection
          nextSteps={metrics?.nextSteps}
          isLoading={isLoading}
        />
        <ChampionsSection
          champions={metrics?.champions}
          isLoading={isLoading}
        />
        <WinLossSection winLoss={metrics?.winLoss} isLoading={isLoading} />
        <div className="grid gap-4 content-start">
          <ActivitySection activity={metrics?.activity} isLoading={isLoading} />
          <DealSizeSection dealSize={metrics?.dealSize} isLoading={isLoading} />
        </div>
      </div>
    </div>
  )
}

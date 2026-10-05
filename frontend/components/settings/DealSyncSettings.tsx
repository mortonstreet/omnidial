'use client'

import { useIntegrations } from '@/hooks/api/useIntegrations'
import { HubSpotSyncPanel } from '@/components/deal-metrics/HubSpotSyncPanel'
import { ScoreTouchpointsButton } from '@/components/deal-metrics/ScoreTouchpointsButton'

/** Settings home for deal scoring and the HubSpot two-way sync. */
export function DealSyncSettings() {
  const { data } = useIntegrations()
  const hubspotConnected =
    data?.data?.some((i) => i.provider === 'hubspot' && i.isConnected) ?? false

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-foreground">Deal scoring</h3>
          <p className="text-xs text-muted-foreground">
            AI scores calls, emails and meetings for next steps and champions.
          </p>
        </div>
        <ScoreTouchpointsButton />
      </div>
      <HubSpotSyncPanel connected={hubspotConnected} />
    </div>
  )
}

'use client'

import Link from 'next/link'
import { Phone, Mail, Video, RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { useSyncDealSignals } from '@/hooks/api/useDealMetrics'
import { formatRelative } from './format'
import type {
  DealMetricsResponse,
  SignalSourceStatus,
} from '@shared/types/src/requests/dealMetrics'

type SourceResult = { status?: string; scored?: number; error?: string }

function SourceChip({
  icon,
  label,
  status,
  connectable,
}: {
  icon: React.ReactNode
  label: string
  status: SignalSourceStatus
  connectable?: boolean
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 min-w-0">
      {icon}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm text-foreground">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              status.connected ? 'bg-emerald-500' : 'bg-muted-foreground/40',
            )}
          />
          {label}
        </div>
        <div className="text-xs text-muted-foreground truncate">
          {status.connected ? (
            (status.detail ??
            (status.lastSyncAt
              ? `synced ${formatRelative(status.lastSyncAt)}`
              : 'connected'))
          ) : connectable ? (
            <Link
              href="/dashboard/settings/integrations"
              className="underline hover:text-foreground"
            >
              Connect
            </Link>
          ) : (
            'not connected'
          )}
        </div>
      </div>
    </div>
  )
}

export function SignalSourcesStrip({
  sources,
}: {
  sources?: DealMetricsResponse['sources']
}) {
  const sync = useSyncDealSignals()

  const handleSync = () => {
    sync.mutate(
      { source: 'all' },
      {
        onSuccess: (response) => {
          const results = Object.entries(response.data ?? {}) as [
            string,
            SourceResult,
          ][]
          const scored = results.reduce(
            (sum, [, r]) => sum + (r.scored ?? 0),
            0,
          )
          const failed = results.filter(([, r]) => r.status === 'error')
          if (failed.length) {
            toast.warning(
              `Scored ${scored} touchpoint${scored !== 1 ? 's' : ''}`,
              {
                description: failed
                  .map(([name, r]) => `${name}: ${r.error}`)
                  .join('\n'),
              },
            )
          } else {
            toast.success(
              scored
                ? `Scored ${scored} new touchpoint${scored !== 1 ? 's' : ''}`
                : 'Everything is already scored',
            )
          }
        },
        onError: (error) =>
          toast.error('Scoring failed', {
            description: error instanceof Error ? error.message : undefined,
          }),
      },
    )
  }

  const off: SignalSourceStatus = { connected: false, lastSyncAt: null }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 flex-1">
        <SourceChip
          icon={<Phone className="w-4 h-4 text-muted-foreground" />}
          label="Call transcripts"
          status={sources?.calls ?? { connected: true, lastSyncAt: null }}
        />
        <SourceChip
          icon={<Mail className="w-4 h-4 text-muted-foreground" />}
          label="Gmail"
          status={sources?.gmail ?? off}
          connectable
        />
        <SourceChip
          icon={<Video className="w-4 h-4 text-muted-foreground" />}
          label="Grain"
          status={sources?.grain ?? off}
          connectable
        />
        <SourceChip
          icon={<BrandLogo provider="hubspot" size={16} />}
          label="HubSpot"
          status={sources?.hubspot ?? off}
          connectable
        />
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={handleSync}
        disabled={sync.isPending}
      >
        {sync.isPending ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        {sync.isPending ? 'Scoring…' : 'Score new touchpoints'}
      </Button>
    </div>
  )
}

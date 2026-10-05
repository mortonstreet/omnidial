'use client'

import { RefreshCw, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSyncDealSignals } from '@/hooks/api/useDealMetrics'

type SourceResult = { status?: string; scored?: number; error?: string }

/** AI-score new calls, emails and meetings now instead of waiting for the next sync. */
export function ScoreTouchpointsButton() {
  const sync = useSyncDealSignals()

  const handleSync = () => {
    sync.mutate(
      { source: 'all' },
      {
        onSuccess: (response) => {
          const results = Object.entries(response.data ?? {}) as [string, SourceResult][]
          const scored = results.reduce((sum, [, r]) => sum + (r.scored ?? 0), 0)
          const failed = results.filter(([, r]) => r.status === 'error')
          if (failed.length) {
            toast.warning(`Scored ${scored} touchpoint${scored !== 1 ? 's' : ''}`, {
              description: failed.map(([name, r]) => `${name}: ${r.error}`).join('\n'),
            })
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

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={sync.isPending}>
      {sync.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
      {sync.isPending ? 'Scoring…' : 'Score new touchpoints'}
    </Button>
  )
}

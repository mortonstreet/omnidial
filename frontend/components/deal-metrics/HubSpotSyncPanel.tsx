'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { BrandLogo } from '@/components/ui/BrandLogo'
import { useHubSpotSyncStatus, useReconcileHubSpot } from '@/hooks/api/useDealMetrics'
import type { HubSpotReconcileReport } from '@shared/types/src/requests/dealMetrics'
import { MetricSection, Stat } from './MetricSection'
import { leadHref } from './format'

const count = (
  rows: Array<{ direction: string; status: string; count: number }> | undefined,
  direction: string,
  status: string,
) => rows?.filter((r) => r.direction === direction && r.status === status).reduce((n, r) => n + r.count, 0) ?? 0

const HubSpotIcon = () => <BrandLogo provider="hubspot" size={16} />

const show = (value: unknown) =>
  value === null || value === undefined || value === '' ? '—' : String(value)

/**
 * Is OmniDial actually 1:1 with HubSpot? Setup gaps (scopes, unmapped stages),
 * last-24h push/pull/failure counts, and an on-demand drift check.
 */
export function HubSpotSyncPanel({ connected }: { connected: boolean }) {
  const { data, isLoading, error } = useHubSpotSyncStatus(connected)
  const reconcile = useReconcileHubSpot()
  const [report, setReport] = useState<HubSpotReconcileReport | null>(null)

  if (!connected) return null
  const status = data?.data

  const run = async (fix: boolean) => {
    try {
      const { data: result } = await reconcile.mutateAsync(fix)
      setReport(result)
      if (fix) toast.success(`Fixed ${result.fixed} drifted deal(s), linked ${result.pushedUnlinked} new`)
      else if (result.drifted === 0) toast.success(`All ${result.checked} linked deals match HubSpot`)
      else toast.warning(`${result.drifted} of ${result.checked} deals differ from HubSpot`)
    } catch (err) {
      toast.error('Drift check failed', { description: err instanceof Error ? err.message : undefined })
    }
  }

  const unmapped = status?.stageMapping.filter((m) => !m.hubspotStage) ?? []
  const setupIssues = [
    ...(status?.tokenError ? [`HubSpot token error: ${status.tokenError}. Reconnect HubSpot.`] : []),
    ...(status?.missingRequiredScopes.length
      ? [`Missing required scopes: ${status.missingRequiredScopes.join(', ')}. Reconnect HubSpot.`]
      : []),
    ...(unmapped.length
      ? [`${unmapped.length} stage(s) not mapped to HubSpot: ${unmapped.map((m) => m.omnidialStage).join(', ')}`]
      : []),
    ...(status?.missingOptionalScopes ?? []).map((s) => `Optional scope ${s.scope} missing (needed to ${s.purpose})`),
    ...(status && !status.config.customPropertiesReady && !status.missingOptionalScopes.some((s) => s.scope === 'crm.schemas.deals.write')
      ? ['OmniDial score properties not created in HubSpot yet (run: hubspot setup-properties)']
      : []),
  ]
  const failedPushes = count(status?.last24h, 'push', 'failed') + count(status?.last24h, 'pull', 'failed')

  return (
    <MetricSection
      icon={HubSpotIcon}
      title="HubSpot sync"
      description="Two-way: newest edit wins per field. Every change is logged."
      isLoading={isLoading}
      action={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => run(false)} disabled={reconcile.isPending}>
            {reconcile.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
            Check drift
          </Button>
          {report && report.drifted + report.unlinkedPipelineLeads > 0 && (
            <Button size="sm" onClick={() => run(true)} disabled={reconcile.isPending}>
              Fix drift
            </Button>
          )}
        </div>
      }
    >
      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error instanceof Error ? error.message : 'Could not load HubSpot sync status'}
        </p>
      ) : status ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Linked deals" value={status.linkedLeads} hint={status.portalId ? `Portal ${status.portalId}` : undefined} />
            <Stat
              label="Not in HubSpot yet"
              value={status.unlinkedPipelineLeads}
              tone={status.unlinkedPipelineLeads > 0 ? 'warn' : 'default'}
            />
            <Stat
              label="Synced (24h)"
              value={
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-0.5"><ArrowUpRight className="w-3.5 h-3.5" />{count(status.last24h, 'push', 'applied')}</span>
                  <span className="flex items-center gap-0.5"><ArrowDownLeft className="w-3.5 h-3.5" />{count(status.last24h, 'pull', 'applied')}</span>
                </span>
              }
              hint="pushed / pulled"
            />
            <Stat label="Failures (24h)" value={failedPushes} tone={failedPushes > 0 ? 'bad' : 'good'} />
          </div>

          {setupIssues.length > 0 ? (
            <ul className="space-y-1.5">
              {setupIssues.map((issue) => (
                <li key={issue} className="flex gap-2 text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  {issue}
                </li>
              ))}
            </ul>
          ) : (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" /> Setup complete: scopes granted, every stage mapped.
            </p>
          )}

          {report && (
            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm text-foreground">
                {report.checked} checked · {report.inSync} in sync · {report.drifted} drifted
                {report.fixed ? ` · ${report.fixed} fixed` : ''}
                {report.orphanDeals.count ? ` · ${report.orphanDeals.count} HubSpot deal(s) with no OmniDial lead` : ''}
              </p>
              {report.drift.length > 0 && (
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground text-left">
                      <tr>
                        <th className="py-1 pr-2 font-normal">Field</th>
                        <th className="py-1 pr-2 font-normal">OmniDial</th>
                        <th className="py-1 pr-2 font-normal">HubSpot</th>
                        <th className="py-1 font-normal">Newest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.drift.slice(0, 50).map((d, i) => (
                        <tr key={`${d.leadId}-${d.field}-${i}`} className="border-t border-border">
                          <td className="py-1 pr-2">
                            <Link href={leadHref(d.leadId)} className="hover:underline">{d.field}</Link>
                          </td>
                          <td className="py-1 pr-2 truncate max-w-[10rem]">{show(d.omnidial)}</td>
                          <td className="py-1 pr-2 truncate max-w-[10rem]">{show(d.hubspot)}</td>
                          <td className="py-1 capitalize">{d.winner}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {report.errors.length > 0 && (
                <p className="text-xs text-red-600 dark:text-red-400">{report.errors.slice(0, 3).join(' · ')}</p>
              )}
            </div>
          )}

          {status.recentEvents.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Recent sync activity</summary>
              <ul className="mt-2 space-y-1">
                {status.recentEvents.map((e) => (
                  <li key={e.id} className="flex gap-2">
                    <span className={e.status === 'failed' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}>
                      {e.direction} {e.objectType} · {e.status}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                    </span>
                    {e.message && <span className="truncate">{e.message}</span>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      ) : null}
    </MetricSection>
  )
}

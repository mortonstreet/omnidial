'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency, leadHref } from './format'
import type { DealListItem } from '@shared/types/src/requests/dealMetrics'

/** Card shell shared by every deal-metrics section. */
export function MetricSection({
  icon: Icon,
  title,
  description,
  action,
  isLoading,
  className,
  children,
}: {
  icon: React.ElementType
  title: string
  description?: string
  action?: React.ReactNode
  isLoading?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'bg-card border border-border rounded-xl p-4 flex flex-col',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            {/* Explanations live in a hover tooltip to keep the grid scannable. */}
            <h3
              className="text-sm font-medium text-foreground"
              title={description}
            >
              {title}
            </h3>
          </div>
        </div>
        {action}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-6 bg-muted rounded animate-pulse w-1/3" />
          <div className="h-24 bg-muted/50 rounded-lg animate-pulse" />
        </div>
      ) : (
        children
      )}
    </section>
  )
}

/** Small labelled number used inside sections. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: 'default' | 'good' | 'bad' | 'warn'
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground truncate">{label}</div>
      <div
        className={cn(
          'text-lg font-medium',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-red-600 dark:text-red-400',
          tone === 'warn' && 'text-amber-600 dark:text-amber-400',
          tone === 'default' && 'text-foreground',
        )}
      >
        {value}
      </div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** Explains what feeds a metric when there is nothing to show yet. */
export function EmptyMetric({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/** Linked list of deals with a right-hand detail slot. */
export function DealList<T extends DealListItem>({
  title,
  deals,
  detail,
  emptyText,
}: {
  title: string
  deals: T[]
  detail: (deal: T) => React.ReactNode
  emptyText: string
}) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        {title}
      </div>
      {deals.length === 0 ? (
        <p className="text-xs text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="divide-y divide-border">
          {deals.map((deal) => (
            <li key={deal.leadId}>
              <Link
                href={leadHref(deal.leadId)}
                className="flex items-center justify-between gap-3 py-2 hover:bg-muted/50 rounded px-1 -mx-1"
              >
                <div className="min-w-0">
                  <div className="text-sm text-foreground truncate">
                    {deal.name}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[
                      deal.stageLabel,
                      deal.dealValue !== null
                        ? formatCurrency(deal.dealValue)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground text-right shrink-0 max-w-[50%]">
                  {detail(deal)}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

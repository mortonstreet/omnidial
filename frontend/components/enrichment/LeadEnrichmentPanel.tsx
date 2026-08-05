'use client'

import { Check, AlertCircle, Clock } from 'lucide-react'
import { EnrichButton } from '@/components/enrichment/EnrichButton'

interface LeadEnrichmentPanelProps {
  leadId: string
  enrichmentStatus?: 'none' | 'partial' | 'complete' | 'failed'
  enrichmentSources?: string[]
  lastEnrichedAt?: string
  email?: string | null
  phone?: string | null
  onEnrichComplete?: () => void
}

export function LeadEnrichmentPanel({
  leadId,
  enrichmentStatus = 'none',
  enrichmentSources = [],
  lastEnrichedAt,
  email,
  phone,
  onEnrichComplete,
}: LeadEnrichmentPanelProps) {
  const getStatusIcon = () => {
    switch (enrichmentStatus) {
      case 'complete':
        return <Check className="w-4 h-4 text-green-500" />
      case 'partial':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return null
    }
  }

  const getStatusText = () => {
    switch (enrichmentStatus) {
      case 'complete':
        return 'Fully enriched'
      case 'partial':
        return 'Partially enriched'
      case 'failed':
        return 'Enrichment failed'
      default:
        return 'Not enriched'
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-sm">Data Enrichment</h4>
          <div className="flex items-center gap-2 mt-1">
            {getStatusIcon()}
            <span className="text-xs text-muted-foreground">
              {getStatusText()}
            </span>
          </div>
        </div>

        <EnrichButton
          leadId={leadId}
          email={email}
          phone={phone}
          variant="outline"
          size="sm"
          onComplete={onEnrichComplete}
        />
      </div>

      {/* Source badges */}
      {enrichmentSources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {enrichmentSources.map((source) => (
            <span
              key={source}
              className="px-2 py-0.5 text-xs bg-muted rounded-full capitalize"
            >
              {source}
            </span>
          ))}
        </div>
      )}

      {/* Last enriched */}
      {lastEnrichedAt && (
        <p className="text-xs text-muted-foreground">
          Last enriched:{' '}
          {new Date(lastEnrichedAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'

interface BulkEnrichProgressProps {
  totalRows: number
  onComplete: () => void
}

export function BulkEnrichProgress({ totalRows, onComplete }: BulkEnrichProgressProps) {
  const [processed, setProcessed] = useState(0)
  const [status, setStatus] = useState<'enriching' | 'pushing' | 'done'>('enriching')

  useEffect(() => {
    // Simulate progress for now - will be replaced with real API polling
    const interval = setInterval(() => {
      setProcessed((prev) => {
        if (prev >= totalRows) {
          clearInterval(interval)
          setStatus('done')
          setTimeout(onComplete, 1000)
          return totalRows
        }
        return prev + 1
      })
    }, 200)
    return () => clearInterval(interval)
  }, [totalRows, onComplete])

  const progress = totalRows > 0 ? Math.round((processed / totalRows) * 100) : 0

  return (
    <div className="rounded-xl border p-8 text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">
          {status === 'enriching' ? 'Enriching Leads...' : status === 'pushing' ? 'Pushing to CRM...' : 'Complete!'}
        </h2>
        <p className="text-muted-foreground">
          {processed} of {totalRows} leads processed
        </p>
      </div>

      <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <p className="text-sm text-muted-foreground">{progress}% complete</p>
    </div>
  )
}

'use client'

import { useState } from 'react'
import { CsvUploader } from '@/components/enrich/CsvUploader'
import { ColumnMapper } from '@/components/enrich/ColumnMapper'
import { BulkEnrichProgress } from '@/components/enrich/BulkEnrichProgress'

type Step = 'upload' | 'map' | 'enrich' | 'done'

export default function UploadPage() {
  const [step, setStep] = useState<Step>('upload')
  const [csvData, setCsvData] = useState<{ headers: string[]; rows: string[][] }>({ headers: [], rows: [] })
  const [_mappings, setMappings] = useState<Record<string, string>>({})
  const [_enrichmentId, _setEnrichmentId] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Upload & Enrich</h1>
        <p className="text-muted-foreground">Upload a CSV file, map columns, and enrich leads in bulk</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {['Upload', 'Map Columns', 'Enrich', 'Done'].map((label, i) => {
          const stepIndex = ['upload', 'map', 'enrich', 'done'].indexOf(step)
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className="h-px w-8 bg-border" />}
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                i <= stepIndex ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'
              }`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>

      {step === 'upload' && (
        <CsvUploader
          onUpload={(headers, rows) => {
            setCsvData({ headers, rows })
            setStep('map')
          }}
        />
      )}

      {step === 'map' && (
        <ColumnMapper
          headers={csvData.headers}
          sampleRows={csvData.rows.slice(0, 3)}
          onConfirm={(mappings) => {
            setMappings(mappings)
            setStep('enrich')
          }}
          onBack={() => setStep('upload')}
        />
      )}

      {step === 'enrich' && (
        <BulkEnrichProgress
          totalRows={csvData.rows.length}
          onComplete={() => setStep('done')}
        />
      )}

      {step === 'done' && (
        <div className="text-center py-12 space-y-4">
          <div className="text-4xl">{'\u2705'}</div>
          <h2 className="text-xl font-semibold">Enrichment Complete</h2>
          <p className="text-muted-foreground">Your leads have been enriched and are ready to push to your CRM</p>
          <div className="flex justify-center gap-4">
            <button
              onClick={() => { setStep('upload'); setCsvData({ headers: [], rows: [] }) }}
              className="inline-flex items-center px-4 py-2 rounded-lg border hover:bg-accent transition-colors text-sm"
            >
              Upload Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

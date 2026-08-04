'use client'

import { useState } from 'react'

const LEAD_FIELDS = [
  { key: 'firstName', label: 'First Name' },
  { key: 'lastName', label: 'Last Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'company', label: 'Company' },
  { key: 'title', label: 'Title' },
  { key: 'linkedInUrl', label: 'LinkedIn URL' },
  { key: '', label: '-- Skip --' },
]

interface ColumnMapperProps {
  headers: string[]
  sampleRows: string[][]
  onConfirm: (mappings: Record<string, string>) => void
  onBack: () => void
}

export function ColumnMapper({ headers, sampleRows, onConfirm, onBack }: ColumnMapperProps) {
  const [mappings, setMappings] = useState<Record<string, string>>(() => {
    const auto: Record<string, string> = {}
    headers.forEach((h) => {
      const lower = h.toLowerCase().replace(/[_\s-]/g, '')
      if (lower.includes('first')) auto[h] = 'firstName'
      else if (lower.includes('last')) auto[h] = 'lastName'
      else if (lower.includes('email')) auto[h] = 'email'
      else if (lower.includes('phone') || lower.includes('mobile')) auto[h] = 'phone'
      else if (lower.includes('company') || lower.includes('org')) auto[h] = 'company'
      else if (lower.includes('title') || lower.includes('role') || lower.includes('position')) auto[h] = 'title'
      else if (lower.includes('linkedin')) auto[h] = 'linkedInUrl'
      else auto[h] = ''
    })
    return auto
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">CSV Column</th>
              <th className="text-left p-3 font-medium">Sample Data</th>
              <th className="text-left p-3 font-medium">Map To</th>
            </tr>
          </thead>
          <tbody>
            {headers.map((header, i) => (
              <tr key={header} className="border-t">
                <td className="p-3 font-medium">{header}</td>
                <td className="p-3 text-muted-foreground truncate max-w-[200px]">
                  {sampleRows[0]?.[i] || '-'}
                </td>
                <td className="p-3">
                  <select
                    className="w-full rounded-md border bg-background px-2 py-1 text-sm"
                    value={mappings[header] || ''}
                    onChange={(e) => setMappings({ ...mappings, [header]: e.target.value })}
                  >
                    {LEAD_FIELDS.map((field) => (
                      <option key={field.key} value={field.key}>{field.label}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between">
        <button onClick={onBack} className="px-4 py-2 rounded-lg border text-sm hover:bg-accent transition-colors">
          Back
        </button>
        <button
          onClick={() => onConfirm(mappings)}
          className="px-6 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
        >
          Start Enrichment
        </button>
      </div>
    </div>
  )
}

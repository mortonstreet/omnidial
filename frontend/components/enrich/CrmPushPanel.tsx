'use client'

import { useState } from 'react'

export function CrmPushPanel() {
  const [selectedCrm, setSelectedCrm] = useState<string | null>(null)

  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h3 className="font-semibold">Select Target CRM</h3>
        <div className="flex gap-3">
          {[
            { key: 'hubspot', name: 'HubSpot', color: '#FF7A59' },
            { key: 'salesforce', name: 'Salesforce', color: '#00A1E0' },
            { key: 'attio', name: 'Attio', color: '#6C5CE7' },
          ].map((crm) => (
            <button
              key={crm.key}
              onClick={() => setSelectedCrm(crm.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
                selectedCrm === crm.key
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'hover:bg-accent'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: crm.color }} />
              {crm.name}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
        <p>Select leads from the Leads page and come back here to push them to your CRM.</p>
        <p className="text-sm mt-2">Bulk push functionality coming soon.</p>
      </div>
    </div>
  )
}

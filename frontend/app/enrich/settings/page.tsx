'use client'

import { useState } from 'react'

type SettingsTab = 'vendors' | 'crms'

export default function EnrichSettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('vendors')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage enrichment vendors and CRM connections</p>
      </div>

      <div className="flex gap-2 border-b">
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'vendors' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('vendors')}
        >
          Enrichment Vendors
        </button>
        <button
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'crms' ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          onClick={() => setActiveTab('crms')}
        >
          CRM Connections
        </button>
      </div>

      {activeTab === 'vendors' && (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-muted-foreground text-sm">
            Configure your enrichment vendor API keys. These vendors will be used to find phone numbers and emails for your leads.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Vendor management uses the same settings as the main OmniDial app. Visit the app settings to manage vendors.
          </p>
        </div>
      )}

      {activeTab === 'crms' && (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-muted-foreground text-sm">
            Connect your CRM to push enriched leads directly. CRM connections are managed through the main OmniDial app.
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            Connected CRMs will appear in the Push page for bulk operations.
          </p>
        </div>
      )}
    </div>
  )
}

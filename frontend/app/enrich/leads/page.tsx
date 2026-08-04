'use client'

import { LeadCacheTable } from '@/components/enrich/LeadCacheTable'

export default function LeadsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Enriched Leads</h1>
        <p className="text-muted-foreground">Browse your enriched lead cache, filter, and push to CRM</p>
      </div>
      <LeadCacheTable />
    </div>
  )
}

'use client'

import { CrmPushPanel } from '@/components/enrich/CrmPushPanel'

export default function PushPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Push to CRM</h1>
        <p className="text-muted-foreground">Select leads and push them to your connected CRM</p>
      </div>
      <CrmPushPanel />
    </div>
  )
}

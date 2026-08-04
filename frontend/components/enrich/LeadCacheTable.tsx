'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

export function LeadCacheTable() {
  const [search, setSearch] = useState('')

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search enriched leads..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border bg-background text-sm"
          />
        </div>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Company</th>
              <th className="text-left p-3 font-medium">Email</th>
              <th className="text-left p-3 font-medium">Phone</th>
              <th className="text-left p-3 font-medium">CRMs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="p-12 text-center text-muted-foreground">
                <p className="font-medium">No enriched leads yet</p>
                <p className="text-sm mt-1">Upload a CSV or use the Chrome extension to enrich leads</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

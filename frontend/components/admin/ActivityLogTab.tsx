'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import Card from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminActivity } from '@/hooks/api/useAdminLogs';

function Pagination({
  page, totalPages, onPageChange, total, limit,
}: {
  page: number; totalPages: number; onPageChange: (page: number) => void; total: number; limit: number;
}) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">Showing {start} to {end} of {total}</p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        <span className="text-sm text-foreground px-2">Page {page} of {totalPages}</span>
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed">
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    call: 'bg-blue-100 text-blue-700',
    lead: 'bg-green-100 text-green-700',
    campaign: 'bg-purple-100 text-purple-700',
    disposition: 'bg-yellow-100 text-yellow-700',
    login: 'bg-gray-100 text-gray-700',
    voicemail: 'bg-orange-100 text-orange-700',
  };

  // Find a matching color by checking if the type includes a known key
  const matchKey = Object.keys(colors).find((k) => type.toLowerCase().includes(k));
  const colorClass = matchKey ? colors[matchKey] : 'bg-gray-100 text-gray-700';

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colorClass}`}>
      {type}
    </span>
  );
}

export function ActivityLogTab() {
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  const LIMIT = 20;

  const { data: activityData, isLoading } = useAdminActivity({
    page,
    limit: LIMIT,
    type: typeFilter || undefined,
  });

  const handleClearFilters = () => {
    setTypeFilter('');
    setPage(1);
  };

  const hasActiveFilters = typeFilter !== '';

  return (
    <Card title="Activity Feed">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
          className={`rounded-lg border px-3 py-1.5 text-sm bg-card text-foreground outline-none focus:border-[var(--color-primary)] ${
            typeFilter ? 'border-[var(--color-primary)]' : 'border-border'
          }`}
        >
          <option value="">All Types</option>
          <option value="call_started">Call Started</option>
          <option value="call_ended">Call Ended</option>
          <option value="call_completed">Call Completed</option>
          <option value="lead_created">Lead Created</option>
          <option value="lead_updated">Lead Updated</option>
          <option value="disposition_set">Disposition Set</option>
          <option value="voicemail_dropped">Voicemail Dropped</option>
        </select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading activity...</div>
      ) : activityData?.data && activityData.data.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Type</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Description</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Organization</th>
                </tr>
              </thead>
              <tbody>
                {activityData.data.map((activity) => (
                  <tr key={activity.id} className="border-b border-border/50 hover:bg-muted">
                    <td className="py-3 px-4 text-muted-foreground">
                      {format(parseISO(activity.createdAt), 'MMM d, h:mm a')}
                    </td>
                    <td className="py-3 px-4">
                      <TypeBadge type={activity.type} />
                    </td>
                    <td className="py-3 px-4 text-foreground max-w-md truncate">
                      {activity.description}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{activity.userName || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{activity.organizationName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {activityData.pagination && activityData.pagination.totalPages > 1 && (
            <Pagination
              page={activityData.pagination.page}
              totalPages={activityData.pagination.totalPages}
              total={activityData.pagination.total}
              limit={activityData.pagination.limit}
              onPageChange={setPage}
            />
          )}
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {hasActiveFilters ? 'No activity matches your filters' : 'No activity found'}
        </div>
      )}
    </Card>
  );
}

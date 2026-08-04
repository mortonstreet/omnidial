'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Card from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminCalls } from '@/hooks/api/useAdminLogs';
import { CallDetailModal } from './CallDetailModal';
import type { AdminCallItem } from '@shared/types/src';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-green-100 text-green-700',
    'in-progress': 'bg-blue-100 text-blue-700',
    ringing: 'bg-yellow-100 text-yellow-700',
    initiated: 'bg-gray-100 text-gray-700',
    failed: 'bg-red-100 text-red-700',
    'no-answer': 'bg-orange-100 text-orange-700',
    busy: 'bg-orange-100 text-orange-700',
  };

  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function DirectionBadge({ direction }: { direction: string }) {
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
      direction === 'inbound'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-purple-100 text-purple-700'
    }`}>
      {direction}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  limit,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total: number;
  limit: number;
}) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        <span className="text-sm text-foreground px-2">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>
    </div>
  );
}

export function CallsLogTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const LIMIT = 20;

  const { data: callsData, isLoading } = useAdminCalls({
    page,
    limit: LIMIT,
    status: statusFilter || undefined,
    direction: directionFilter || undefined,
    search: search || undefined,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setDirectionFilter('');
    setPage(1);
  };

  const hasActiveFilters = search !== '' || statusFilter !== '' || directionFilter !== '';

  const handleRowClick = (call: AdminCallItem) => {
    setSelectedCallId(call.id);
    setIsDetailOpen(true);
  };

  return (
    <div>
      <Card title="All Calls">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-sm bg-card text-foreground outline-none focus:border-[var(--color-primary)] ${
              statusFilter ? 'border-[var(--color-primary)]' : 'border-border'
            }`}
          >
            <option value="">All Statuses</option>
            <option value="initiated">Initiated</option>
            <option value="ringing">Ringing</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="no-answer">No Answer</option>
            <option value="busy">Busy</option>
          </select>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
            className={`rounded-lg border px-3 py-1.5 text-sm bg-card text-foreground outline-none focus:border-[var(--color-primary)] ${
              directionFilter ? 'border-[var(--color-primary)]' : 'border-border'
            }`}
          >
            <option value="">All Directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by phone number or Twilio SID..."
              className="w-full pl-10 pr-4 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading calls...</div>
        ) : callsData?.data && callsData.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Twilio SID</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Direction</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">From</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">To</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">User</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {callsData.data.map((call) => (
                    <tr
                      key={call.id}
                      onClick={() => handleRowClick(call)}
                      className="border-b border-border/50 hover:bg-muted cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-xs text-foreground">
                        {call.twilioCallSid ? call.twilioCallSid.substring(0, 20) + '...' : '-'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {call.startedAt ? format(parseISO(call.startedAt), 'MMM d, h:mm a') : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={call.status} />
                      </td>
                      <td className="py-3 px-4">
                        <DirectionBadge direction={call.direction} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{call.fromNumber}</td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{call.toNumber}</td>
                      <td className="py-3 px-4 text-muted-foreground">{call.organizationName || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{call.userName || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDuration(call.duration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {callsData.pagination && callsData.pagination.totalPages > 1 && (
              <Pagination
                page={callsData.pagination.page}
                totalPages={callsData.pagination.totalPages}
                total={callsData.pagination.total}
                limit={callsData.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {hasActiveFilters ? 'No calls match your filters' : 'No calls found'}
          </div>
        )}
      </Card>

      <CallDetailModal
        callId={selectedCallId}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedCallId(null); }}
      />
    </div>
  );
}

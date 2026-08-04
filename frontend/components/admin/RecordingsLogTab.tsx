'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, X, Play, Pause } from 'lucide-react';
import Card from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminRecordings } from '@/hooks/api/useAdminLogs';

function formatDuration(seconds: number | null): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

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

function InlineAudioPlayer({ url }: { url: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioEl) {
      const audio = new Audio(url);
      audio.addEventListener('ended', () => setIsPlaying(false));
      audio.play();
      setAudioEl(audio);
      setIsPlaying(true);
    } else if (isPlaying) {
      audioEl.pause();
      setIsPlaying(false);
    } else {
      audioEl.play();
      setIsPlaying(true);
    }
  };

  return (
    <button
      onClick={togglePlay}
      className="p-1.5 rounded-full bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:opacity-80 transition"
      title={isPlaying ? 'Pause' : 'Play'}
    >
      {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
    </button>
  );
}

export function RecordingsLogTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const LIMIT = 20;

  const { data: recordingsData, isLoading } = useAdminRecordings({
    page,
    limit: LIMIT,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = search !== '' || statusFilter !== '';

  return (
    <Card title="Recordings">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className={`rounded-lg border px-3 py-1.5 text-sm bg-card text-foreground outline-none focus:border-[var(--color-primary)] ${
            statusFilter ? 'border-[var(--color-primary)]' : 'border-border'
          }`}
        >
          <option value="">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
        </select>

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
        <div className="text-center py-8 text-muted-foreground">Loading recordings...</div>
      ) : recordingsData?.data && recordingsData.data.length > 0 ? (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">From</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">To</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Organization</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">User</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Duration</th>
                  <th className="text-left py-3 px-4 font-medium text-foreground">Play</th>
                </tr>
              </thead>
              <tbody>
                {recordingsData.data.map((rec) => (
                  <tr key={rec.id} className="border-b border-border/50 hover:bg-muted">
                    <td className="py-3 px-4 text-muted-foreground">
                      {rec.startedAt ? format(parseISO(rec.startedAt), 'MMM d, h:mm a') : '-'}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{rec.fromNumber}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{rec.toNumber}</td>
                    <td className="py-3 px-4 text-muted-foreground">{rec.organizationName || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{rec.userName || '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{formatDuration(rec.duration)}</td>
                    <td className="py-3 px-4">
                      {rec.recordingUrl && <InlineAudioPlayer url={rec.recordingUrl} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {recordingsData.pagination && recordingsData.pagination.totalPages > 1 && (
            <Pagination
              page={recordingsData.pagination.page}
              totalPages={recordingsData.pagination.totalPages}
              total={recordingsData.pagination.total}
              limit={recordingsData.pagination.limit}
              onPageChange={setPage}
            />
          )}
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {hasActiveFilters ? 'No recordings match your filters' : 'No recordings found'}
        </div>
      )}
    </Card>
  );
}

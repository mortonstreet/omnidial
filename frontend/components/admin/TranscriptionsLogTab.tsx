'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import Card from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { useAdminTranscriptions, useAdminTranscriptionDetail } from '@/hooks/api/useAdminLogs';
import type { AdminTranscriptionItem } from '@shared/types/src';

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

function TranscriptionDetailModal({
  transcriptionId,
  isOpen,
  onClose,
}: {
  transcriptionId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { data: detail, isLoading } = useAdminTranscriptionDetail(transcriptionId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transcript Detail"
      subtitle={detail ? `${detail.fromNumber} → ${detail.toNumber}` : undefined}
    >
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : !detail ? (
        <div className="text-center py-8 text-muted-foreground">Transcript not found</div>
      ) : (
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Organization: </span>
              <span className="text-foreground">{detail.organizationName || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">User: </span>
              <span className="text-foreground">{detail.userName || '-'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Duration: </span>
              <span className="text-foreground">{formatDuration(detail.durationSeconds)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Language: </span>
              <span className="text-foreground">{detail.language}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Date: </span>
              <span className="text-foreground">
                {detail.startedAt ? format(parseISO(detail.startedAt), 'MMM d, yyyy h:mm a') : '-'}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-foreground mb-2">Full Transcript</h4>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap max-h-96 overflow-y-auto">
              {detail.transcriptText}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TranscriptionsLogTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const LIMIT = 20;

  const { data: transcriptionsData, isLoading } = useAdminTranscriptions({
    page,
    limit: LIMIT,
    search: search || undefined,
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRowClick = (item: AdminTranscriptionItem) => {
    setSelectedId(item.id);
    setIsDetailOpen(true);
  };

  return (
    <div>
      <Card title="Transcriptions">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search transcript content..."
              className="w-full pl-10 pr-4 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>

          {search && (
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setPage(1); }} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading transcriptions...</div>
        ) : transcriptionsData?.data && transcriptionsData.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">From / To</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">User</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Duration</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Language</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {transcriptionsData.data.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => handleRowClick(item)}
                      className="border-b border-border/50 hover:bg-muted cursor-pointer"
                    >
                      <td className="py-3 px-4 text-muted-foreground">
                        {item.startedAt ? format(parseISO(item.startedAt), 'MMM d, h:mm a') : '-'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                        {item.fromNumber} → {item.toNumber}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{item.organizationName || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.userName || '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDuration(item.durationSeconds)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{item.language}</td>
                      <td className="py-3 px-4 text-muted-foreground max-w-xs truncate">
                        {item.transcriptPreview || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {transcriptionsData.pagination && transcriptionsData.pagination.totalPages > 1 && (
              <Pagination
                page={transcriptionsData.pagination.page}
                totalPages={transcriptionsData.pagination.totalPages}
                total={transcriptionsData.pagination.total}
                limit={transcriptionsData.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            {search ? 'No transcriptions match your search' : 'No transcriptions found'}
          </div>
        )}
      </Card>

      <TranscriptionDetailModal
        transcriptionId={selectedId}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedId(null); }}
      />
    </div>
  );
}

'use client';

import { useState, useMemo } from 'react';
import { format, parseISO, subDays } from 'date-fns';
import {
  AlertTriangle,
  AlertOctagon,
  Search,
  ChevronLeft,
  ChevronRight,
  Filter,
  X,
} from 'lucide-react';
import Card from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAdminErrorLogs, useAdminErrorLogStats } from '@/hooks/api/useErrorLogs';
import { ErrorTrendChart } from './ErrorTrendChart';
import { ErrorLogDetailModal } from './ErrorLogDetailModal';
import type { ErrorLogItem } from '@shared/types/src';

type ViewFilter = 'all' | 'errors' | 'warnings';

// Parse HTTP status code from error code (e.g., "API_500" -> 500)
function parseHttpStatus(code: string): number | null {
  const match = code.match(/API_(\d{3})/);
  return match ? parseInt(match[1], 10) : null;
}

function HttpStatusBadge({ code }: { code: string }) {
  const status = parseHttpStatus(code);
  if (!status) return null;

  const getStatusColor = (s: number) => {
    if (s >= 500) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (s >= 400) return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
  };

  return (
    <span className={`inline-flex px-1.5 py-0.5 text-xs font-mono font-medium rounded ${getStatusColor(status)}`}>
      {status}
    </span>
  );
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case 'critical':
      return <AlertOctagon className="h-4 w-4 text-red-700" />;
    case 'error':
      return <AlertOctagon className="h-4 w-4 text-red-500" />;
    case 'warning':
    default:
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    open: 'bg-red-100 text-red-700',
    acknowledged: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${colors[status as keyof typeof colors] || colors.open}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
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

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(page - 1);
        pages.push(page);
        pages.push(page + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4 text-foreground" />
        </button>
        {getPageNumbers().map((pageNum, idx) =>
          pageNum === '...' ? (
            <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
              ...
            </span>
          ) : (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum as number)}
              className={`px-3 py-1.5 text-sm rounded border ${
                page === pageNum
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
                  : 'border-border bg-card hover:bg-muted text-foreground'
              }`}
            >
              {pageNum}
            </button>
          )
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="p-1.5 rounded border border-border bg-card hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4 text-foreground" />
        </button>
      </div>
    </div>
  );
}

export function ErrorLogsTab() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedErrorId, setSelectedErrorId] = useState<string | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const LIMIT = 20;

  // Calculate date range for stats (last 14 days)
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 14);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  }, []);

  // Determine severity filter based on view
  const severityFilter = useMemo(() => {
    switch (viewFilter) {
      case 'errors':
        return 'error'; // This won't work well since we want error OR critical
      case 'warnings':
        return 'warning';
      default:
        return undefined;
    }
  }, [viewFilter]);

  const { data: errorLogs, isLoading } = useAdminErrorLogs({
    page,
    limit: LIMIT,
    severity: severityFilter,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  const { data: stats, isLoading: statsLoading } = useAdminErrorLogStats({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    groupBy: 'day',
  });

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleViewFilterChange = (filter: ViewFilter) => {
    setViewFilter(filter);
    setPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleClearFilters = () => {
    setViewFilter('all');
    setStatusFilter('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters = viewFilter !== 'all' || statusFilter !== '' || search !== '';

  const handleRowClick = (errorLog: ErrorLogItem) => {
    setSelectedErrorId(errorLog.id);
    setIsDetailModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsDetailModalOpen(false);
    setSelectedErrorId(null);
  };

  return (
    <div>
      {/* Historical Trend Chart */}
      <ErrorTrendChart data={stats} isLoading={statsLoading} />

      {/* Filters */}
      <Card title="Error Logs">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* View Filter (All/Errors/Warnings) */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => handleViewFilterChange('all')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewFilter === 'all'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              onClick={() => handleViewFilterChange('errors')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewFilter === 'errors'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Errors
            </button>
            <button
              onClick={() => handleViewFilterChange('warnings')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                viewFilter === 'warnings'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Warnings
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => handleStatusFilterChange(e.target.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm bg-card text-foreground outline-none focus:border-[var(--color-primary)] ${
                statusFilter ? 'border-[var(--color-primary)]' : 'border-border'
              }`}
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by code or message..."
              className="w-full pl-10 pr-4 py-1.5 text-sm text-foreground placeholder-muted-foreground bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
            />
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Filter Results Count */}
        {hasActiveFilters && !isLoading && (
          <div className="mb-4 text-sm text-muted-foreground">
            Showing {errorLogs?.pagination?.total ?? 0} of {stats?.totals?.total ?? 0} total errors
            {errorLogs?.pagination?.total === 0 && (stats?.totals?.total ?? 0) > 0 && (
              <span className="ml-2 text-yellow-600 dark:text-yellow-400">
                — No errors match current filters
              </span>
            )}
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading error logs...</div>
        ) : errorLogs?.data && errorLogs.data.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 font-medium text-foreground">Event</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">HTTP</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Product</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Organization</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Status</th>
                    <th className="text-left py-3 px-4 font-medium text-foreground">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {errorLogs.data.map((errorLog) => (
                    <tr
                      key={errorLog.id}
                      onClick={() => handleRowClick(errorLog)}
                      className="border-b border-border/50 hover:bg-muted cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-start gap-3">
                          <SeverityIcon severity={errorLog.severity} />
                          <div>
                            <p className="font-mono text-sm text-foreground">{errorLog.code}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1 max-w-md">
                              {errorLog.message}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <HttpStatusBadge code={errorLog.code} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">{errorLog.product}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-muted-foreground">
                          {errorLog.organizationName || '-'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <StatusBadge status={errorLog.status} />
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {format(parseISO(errorLog.occurredAt), 'MMM d, h:mm a')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {errorLogs.pagination && errorLogs.pagination.totalPages > 1 && (
              <Pagination
                page={errorLogs.pagination.page}
                totalPages={errorLogs.pagination.totalPages}
                total={errorLogs.pagination.total}
                limit={errorLogs.pagination.limit}
                onPageChange={setPage}
              />
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              {hasActiveFilters ? 'No error logs match your filters' : 'No error logs found'}
            </p>
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearFilters}
                className="mt-4"
              >
                <X className="h-4 w-4 mr-2" />
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </Card>

      {/* Detail Modal */}
      <ErrorLogDetailModal
        errorLogId={selectedErrorId}
        isOpen={isDetailModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}

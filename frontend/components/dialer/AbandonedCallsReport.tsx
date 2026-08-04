"use client";

import { useState } from "react";
import { PhoneOff, Calendar, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { useAbandonedCalls } from "@/hooks/api/useParallelDialer";
import type { AbandonedCallRecord } from "@shared/types/src/requests/parallelDialer";

interface AbandonedCallsReportProps {
  className?: string;
}

export function AbandonedCallsReport({ className }: AbandonedCallsReportProps) {
  const [page, setPage] = useState(1);
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const limit = 20;

  const { data, isLoading, error } = useAbandonedCalls(
    {
      startDate: dateRange.start,
      endDate: dateRange.end,
      page,
      limit,
    },
    true
  );

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const handleExport = () => {
    if (!data?.data) return;

    const csv = [
      ["Date", "Lead Name", "Phone Number", "Wait Time", "Rep"].join(","),
      ...data.data.map((call: AbandonedCallRecord) =>
        [
          formatDate(call.endedAt),
          call.leadName || "Unknown",
          call.leadPhone,
          formatDuration(call.abandonedAfterMs),
          call.repName || "Unknown",
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `abandoned-calls-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <PhoneOff className="w-5 h-5 text-red-500" />
          <h3 className="font-medium">Abandoned Calls Report</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExport}
            disabled={!data?.data?.length}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-muted border border-border rounded-md hover:border-foreground/20 disabled:opacity-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date filters */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">From:</span>
          <input
            type="date"
            value={dateRange.start || ""}
            onChange={(e) => setDateRange((prev) => ({ ...prev, start: e.target.value }))}
            className="px-2 py-1 text-sm bg-background border border-border rounded-md"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To:</span>
          <input
            type="date"
            value={dateRange.end || ""}
            onChange={(e) => setDateRange((prev) => ({ ...prev, end: e.target.value }))}
            className="px-2 py-1 text-sm bg-background border border-border rounded-md"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Date/Time
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Lead
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Phone
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Wait Time
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Rep
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading...
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-red-500">
                  Failed to load abandoned calls
                </td>
              </tr>
            ) : !data?.data?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No abandoned calls found
                </td>
              </tr>
            ) : (
              data.data.map((call: AbandonedCallRecord) => (
                <tr
                  key={call.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 text-sm">
                    {formatDate(call.endedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {call.leadName || (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {call.leadPhone}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {formatDuration(call.abandonedAfterMs)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {call.repName || (
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && data.total > limit && (
        <div className="flex items-center justify-between p-4 border-t border-border">
          <span className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to{" "}
            {Math.min(page * limit, data.total)} of {data.total} calls
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 border border-border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 border border-border rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

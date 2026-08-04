"use client";

import { useState } from "react";
import {
  Phone,
  RefreshCw,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  MapPin,
} from "lucide-react";
import {
  usePhonePool,
  useSyncPhonePool,
  useUpdatePoolNumber,
} from "@/hooks/api/useLocalPresence";

interface PhoneNumberPoolManagerProps {
  className?: string;
}

export function PhoneNumberPoolManager({ className }: PhoneNumberPoolManagerProps) {
  const [page, setPage] = useState(1);
  const [areaCodeFilter, setAreaCodeFilter] = useState("");
  // Default to active only. Sync deactivates numbers no longer present in the
  // Telnyx account rather than deleting them, so "all" surfaces every number
  // the org has ever held — mostly stale pre-Telnyx entries.
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(true);
  const limit = 20;

  const { data, isLoading, refetch } = usePhonePool(
    {
      areaCode: areaCodeFilter || undefined,
      isActive: activeFilter,
      page,
      limit,
    },
    true
  );

  const syncPool = useSyncPhonePool();
  const updateNumber = useUpdatePoolNumber();

  const handleSync = async () => {
    try {
      await syncPool.mutateAsync();
      refetch();
    } catch (error) {
      console.error("Failed to sync phone pool:", error);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateNumber.mutateAsync({ id, isActive: !isActive });
    } catch (error) {
      console.error("Failed to update number:", error);
    }
  };

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className={`bg-card border border-border rounded-lg ${className}`}>
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Phone className="w-5 h-5" />
          <h3 className="font-medium">Phone Number Pool</h3>
          {data && (
            <span className="text-sm text-muted-foreground">
              ({data.total} numbers)
            </span>
          )}
        </div>
        <button
          onClick={handleSync}
          disabled={syncPool.isPending}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-muted border border-border rounded-md hover:border-foreground/20 disabled:opacity-50 transition-colors"
        >
          {syncPool.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Sync from Telnyx
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/50">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={areaCodeFilter}
            onChange={(e) => setAreaCodeFilter(e.target.value)}
            placeholder="Filter by area code..."
            className="px-2 py-1 text-sm bg-background border border-border rounded-md w-40"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Status:</span>
          <select
            value={activeFilter === undefined ? "all" : activeFilter ? "active" : "inactive"}
            onChange={(e) => {
              if (e.target.value === "all") setActiveFilter(undefined);
              else setActiveFilter(e.target.value === "active");
            }}
            className="px-2 py-1 text-sm bg-background border border-border rounded-md"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Phone Number
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Area Code
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Location
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Friendly Name
              </th>
              <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                </td>
              </tr>
            ) : !data?.data?.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No phone numbers in pool. Click &quot;Sync from Telnyx&quot; to import.
                </td>
              </tr>
            ) : (
              data.data.map((number) => (
                <tr
                  key={number.id}
                  className="border-b border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-sm">
                    {number.phoneNumber}
                  </td>
                  <td className="px-4 py-3 text-sm">{number.areaCode}</td>
                  <td className="px-4 py-3 text-sm">
                    {number.region ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground" />
                        {number.region}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {number.friendlyName || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                        number.isActive
                          ? "bg-green-500/10 text-green-500"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {number.isActive ? (
                        <>
                          <Check className="w-3 h-3" />
                          Active
                        </>
                      ) : (
                        <>
                          <X className="w-3 h-3" />
                          Inactive
                        </>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleActive(number.id, number.isActive)}
                      disabled={updateNumber.isPending}
                      className={`text-sm ${
                        number.isActive
                          ? "text-red-500 hover:text-red-600"
                          : "text-green-500 hover:text-green-600"
                      }`}
                    >
                      {number.isActive ? "Deactivate" : "Activate"}
                    </button>
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
            {Math.min(page * limit, data.total)} of {data.total} numbers
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

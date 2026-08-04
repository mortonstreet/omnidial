"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEnrichEngineLists, useImportFromEnrichEngine } from "@/hooks/api/useIntegrations";
import { EnrichEngineList } from "@shared/types/src";
import { List, Loader2, RefreshCw, Users, Search, Database } from "lucide-react";
import { toast } from "sonner";

interface EnrichEngineListPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (listId: string, listName: string, leadsImported: number) => void;
}

export function EnrichEngineListPicker({
  isOpen,
  onClose,
  onSuccess,
}: EnrichEngineListPickerProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch, isRefetching } = useEnrichEngineLists({ search });
  const importMutation = useImportFromEnrichEngine();
  const [selectedList, setSelectedList] = useState<EnrichEngineList | null>(null);

  // Extract lists from the new response format
  const listsResponse = data?.data;
  const lists = listsResponse?.lists || [];
  const pagination = listsResponse?.pagination;

  const handleImport = async () => {
    if (!selectedList) return;

    try {
      const result = await importMutation.mutateAsync({
        listId: selectedList.id,
        listName: selectedList.name,
      });

      if (result.data) {
        onSuccess(result.data.listId, result.data.listName, result.data.leadsImported);
        setSelectedList(null);
        setSearch("");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to import list"
      );
    }
  };

  const handleClose = () => {
    setSelectedList(null);
    setSearch("");
    onClose();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import from EnrichEngine"
      subtitle="Select a list to import leads from"
    >
      <div className="space-y-4">
        {/* Search and Refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lists..."
              className="pl-9"
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Lists */}
        <div className="max-h-[400px] overflow-y-auto border border-border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : lists.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No lists found</p>
              <p className="text-sm">
                {search
                  ? "Try a different search term"
                  : "Create a list in EnrichEngine first"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedList(list)}
                  className={`w-full flex items-center gap-3 p-4 text-left hover:bg-muted/50 transition-colors ${
                    selectedList?.id === list.id
                      ? "bg-primary/10 border-l-2 border-primary"
                      : ""
                  }`}
                >
                  <List className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {list.name}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {list.leadCount.toLocaleString()} leads
                      </span>
                      <span className="capitalize text-xs bg-muted px-1.5 py-0.5 rounded">
                        {list.source}
                      </span>
                      <span>Updated {formatDate(list.updatedAt)}</span>
                    </div>
                    {list.description && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {list.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pagination info */}
        {pagination && pagination.total > 0 && (
          <p className="text-xs text-muted-foreground text-center">
            Showing {lists.length} of {pagination.total} lists
          </p>
        )}

        {/* Selected list preview */}
        {selectedList && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">Selected: {selectedList.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedList.leadCount.toLocaleString()} leads will be imported
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!selectedList || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              "Import List"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

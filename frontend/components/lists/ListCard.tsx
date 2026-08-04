"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileSpreadsheet,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreHorizontal,
  Pencil,
  FolderInput,
  Trash2,
  Search,
  Folder,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useFolders, useUpdateList, useDeleteList } from "@/hooks/api/useLists";
import { toast } from "sonner";

interface ListCardProps {
  list: {
    id: string;
    name: string;
    description?: string;
    folderId?: string;
    folderName?: string;
    leadCount: number;
    importStatus: "pending" | "processing" | "completed" | "failed";
    createdAt: string;
  };
}

export function ListCard({ list }: ListCardProps) {
  const router = useRouter();
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(
    list.folderId ?? null
  );
  const [folderSearch, setFolderSearch] = useState("");

  const { data: foldersData } = useFolders();
  const updateMutation = useUpdateList();
  const deleteMutation = useDeleteList();

  const folders = useMemo(() => foldersData?.data ?? [], [foldersData?.data]);

  // Filter folders based on search
  const filteredFolders = useMemo(() => {
    if (!folderSearch.trim()) return folders;
    const search = folderSearch.toLowerCase().trim();
    return folders.filter((folder) =>
      folder.name.toLowerCase().includes(search)
    );
  }, [folders, folderSearch]);

  // Get selected folder name for display
  const selectedFolderName = useMemo(() => {
    if (!selectedFolderId) return null;
    return folders.find((f) => f.id === selectedFolderId)?.name;
  }, [folders, selectedFolderId]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusIcon = () => {
    switch (list.importStatus) {
      case "pending":
        return <Clock className="w-3 h-3" />;
      case "processing":
        return <Loader2 className="w-3 h-3 animate-spin" />;
      case "completed":
        return <CheckCircle className="w-3 h-3" />;
      case "failed":
        return <AlertCircle className="w-3 h-3" />;
    }
  };

  const getStatusColor = () => {
    switch (list.importStatus) {
      case "pending":
        return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
      case "processing":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "completed":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      case "failed":
        return "bg-red-500/10 text-red-600 border-red-500/20";
    }
  };

  const handleMoveToFolder = async (folderId: string | null) => {
    try {
      await updateMutation.mutateAsync({
        id: list.id,
        folderId,
      });
      toast.success(
        folderId ? "List moved to folder" : "List removed from folder"
      );
      setIsMoveOpen(false);
      setFolderSearch("");
    } catch {
      toast.error("Failed to move list");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm("Are you sure you want to delete this list? This cannot be undone.")
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(list.id);
      toast.success("List deleted");
    } catch {
      toast.error("Failed to delete list");
    }
  };

  const openMoveDialog = () => {
    setSelectedFolderId(list.folderId ?? null);
    setFolderSearch("");
    setIsMoveOpen(true);
  };

  return (
    <>
      <div className="group bg-card border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all">
        <div className="flex items-start justify-between mb-3">
          <Link
            href={`/dashboard/lists/${list.id}`}
            className="flex items-center gap-3 flex-1"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                {list.name}
              </h3>
              {list.folderName && (
                <p className="text-xs text-muted-foreground">{list.folderName}</p>
              )}
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={cn("text-xs", getStatusColor())}>
              {getStatusIcon()}
              <span className="ml-1 capitalize">{list.importStatus}</span>
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    router.push(`/dashboard/lists/${list.id}`);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    openMoveDialog();
                  }}
                >
                  <FolderInput className="w-4 h-4 mr-2" />
                  Move to Folder
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete();
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Link href={`/dashboard/lists/${list.id}`}>
          {list.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {list.description}
            </p>
          )}

          <div className="flex items-center justify-between pt-3 border-t">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{list.leadCount.toLocaleString()} leads</span>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatDate(list.createdAt)}
            </span>
          </div>
        </Link>
      </div>

      {/* Move to Folder Dialog */}
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Move to Folder</DialogTitle>
            <DialogDescription>
              Search and select a folder for &quot;{list.name}&quot;
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Current folder display */}
            {selectedFolderName && (
              <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  <span>Current: {selectedFolderName}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => handleMoveToFolder(null)}
                  disabled={updateMutation.isPending}
                >
                  Remove from folder
                </Button>
              </div>
            )}

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search folders..."
                value={folderSearch}
                onChange={(e) => setFolderSearch(e.target.value)}
                className="pl-9 pr-9"
                autoFocus
              />
              {folderSearch && (
                <button
                  onClick={() => setFolderSearch("")}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Folder list */}
            <div className="border rounded-lg max-h-64 overflow-y-auto">
              {/* No folder option */}
              {!folderSearch && (
                <button
                  onClick={() => handleMoveToFolder(null)}
                  disabled={updateMutation.isPending || !selectedFolderId}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b",
                    !selectedFolderId && "bg-primary/5 text-primary",
                    (!selectedFolderId || updateMutation.isPending) &&
                      "opacity-50 cursor-not-allowed"
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <X className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">No folder</p>
                    <p className="text-xs text-muted-foreground">
                      Remove from any folder
                    </p>
                  </div>
                </button>
              )}

              {/* Folder options */}
              {filteredFolders.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {folderSearch
                    ? "No folders match your search"
                    : "No folders created yet"}
                </div>
              ) : (
                filteredFolders.map((folder) => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveToFolder(folder.id)}
                    disabled={
                      updateMutation.isPending || folder.id === selectedFolderId
                    }
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0",
                      folder.id === selectedFolderId && "bg-primary/5",
                      (folder.id === selectedFolderId ||
                        updateMutation.isPending) &&
                        "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${folder.color}20` }}
                    >
                      <Folder
                        className="w-4 h-4"
                        style={{ color: folder.color }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{folder.name}</p>
                      {folder.id === selectedFolderId && (
                        <p className="text-xs text-primary">Current folder</p>
                      )}
                    </div>
                    {folder.id === selectedFolderId && (
                      <CheckCircle className="w-4 h-4 text-primary flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Loading indicator */}
            {updateMutation.isPending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Moving list...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

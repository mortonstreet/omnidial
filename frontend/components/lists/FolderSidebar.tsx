"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Folder,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
  ListIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useFolders,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
} from "@/hooks/api/useLists";
import { toast } from "sonner";

interface FolderSidebarProps {
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string | null) => void;
}

// Grey color for all folders (Clay-style)
const FOLDER_GREY = "#6B7280";

export function FolderSidebar({
  selectedFolderId,
  onFolderSelect,
}: FolderSidebarProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");

  const { data: foldersData, isLoading } = useFolders();
  const createMutation = useCreateFolder();
  const updateMutation = useUpdateFolder();
  const deleteMutation = useDeleteFolder();

  const folders = foldersData?.data ?? [];

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: newFolderName.trim(),
        color: FOLDER_GREY,
      });
      toast.success("Folder created!");
      setIsCreateOpen(false);
      setNewFolderName("");
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleEditFolder = async () => {
    if (!editingFolder || !editingFolder.name.trim()) return;

    try {
      await updateMutation.mutateAsync({
        id: editingFolder.id,
        name: editingFolder.name.trim(),
      });
      toast.success("Folder updated!");
      setIsEditOpen(false);
      setEditingFolder(null);
    } catch {
      toast.error("Failed to update folder");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm("Are you sure? Lists in this folder will become unfiled.")) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Folder deleted");
      if (selectedFolderId === id) {
        onFolderSelect(null);
      }
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  return (
    <div className="w-64 border-r bg-card h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Folders
        </h2>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {/* All Lists option */}
        <button
          onClick={() => onFolderSelect(null)}
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
            selectedFolderId === null
              ? "bg-primary/10 text-primary"
              : "hover:bg-muted text-foreground"
          )}
        >
          <ListIcon className="w-4 h-4" />
          <span>All Lists</span>
        </button>

        {/* Folder list */}
        {isLoading ? (
          <div className="space-y-2 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="mt-2 space-y-1">
            {folders.map((folder) => (
              <div
                key={folder.id}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer",
                  selectedFolderId === folder.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted text-foreground"
                )}
                onClick={() => onFolderSelect(folder.id)}
              >
                <Folder
                  className="w-4 h-4 flex-shrink-0"
                  style={{ color: FOLDER_GREY }}
                />
                <span className="flex-1 truncate">{folder.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingFolder({
                          id: folder.id,
                          name: folder.name,
                        });
                        setIsEditOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Folder button */}
      <div className="p-4 border-t">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => setIsCreateOpen(true)}
        >
          <FolderPlus className="w-4 h-4 mr-2" />
          New Folder
        </Button>
      </div>

      {/* Create Folder Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Folder</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Folder Name</Label>
              <Input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g., Q1 Prospects"
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateFolder}
                disabled={createMutation.isPending}
              >
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Folder Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
          </DialogHeader>
          {editingFolder && (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Folder Name</Label>
                <Input
                  value={editingFolder.name}
                  onChange={(e) =>
                    setEditingFolder({ ...editingFolder, name: e.target.value })
                  }
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleEditFolder}
                  disabled={updateMutation.isPending}
                >
                  Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

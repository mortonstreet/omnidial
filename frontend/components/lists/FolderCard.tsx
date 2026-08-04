"use client";

import { useState } from "react";
import {
  Folder,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useUpdateFolder, useDeleteFolder } from "@/hooks/api/useLists";
import { toast } from "sonner";

interface FolderCardProps {
  folder: {
    id: string;
    name: string;
    color: string;
  };
  onClick: () => void;
}

// Grey color for all folders (Clay-style)
const FOLDER_GREY = "#6b7280";

export function FolderCard({ folder, onClick }: FolderCardProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const updateMutation = useUpdateFolder();
  const deleteMutation = useDeleteFolder();

  const handleEdit = async () => {
    if (!editName.trim()) {
      toast.error("Please enter a folder name");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: folder.id,
        name: editName.trim(),
      });
      toast.success("Folder updated");
      setIsEditOpen(false);
    } catch {
      toast.error("Failed to update folder");
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete this folder? Lists inside will be moved to the root level."
      )
    ) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(folder.id);
      toast.success("Folder deleted");
    } catch {
      toast.error("Failed to delete folder");
    }
  };

  const openEditDialog = () => {
    setEditName(folder.name);
    setIsEditOpen(true);
  };

  return (
    <>
      <div className="group bg-card border rounded-xl p-4 hover:border-primary/50 hover:shadow-md transition-all">
        <div className="flex items-center gap-3">
          <button
            onClick={onClick}
            className="flex items-center gap-3 flex-1 text-left"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${FOLDER_GREY}20` }}
            >
              <Folder className="w-5 h-5" style={{ color: FOLDER_GREY }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate group-hover:text-primary transition-colors">
                {folder.name}
              </h3>
              <p className="text-xs text-muted-foreground">Click to open</p>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openEditDialog}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={handleDelete}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Edit Folder Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Update the folder name
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="edit-folder-name">Folder Name</Label>
              <Input
                id="edit-folder-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="e.g., Q1 Campaigns"
                autoFocus
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleEdit}
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

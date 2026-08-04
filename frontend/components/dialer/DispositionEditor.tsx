"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Check, Loader2, GripVertical } from "lucide-react";
import {
  useDispositions,
  useCreateDisposition,
  useUpdateDisposition,
  useDeleteDisposition,
} from "@/hooks/api/useCalls";

interface Disposition {
  id: string;
  label: string;
  color: string | null;
  sortOrder: number;
  isDefault: boolean;
}

// Preset colors for easy selection
const PRESET_COLORS = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6b7280", // gray
];

interface EditingState {
  id?: string;
  label: string;
  color: string;
  isNew: boolean;
}

export function DispositionEditor() {
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: dispositionsData, isLoading } = useDispositions();
  const createMutation = useCreateDisposition();
  const updateMutation = useUpdateDisposition();
  const deleteMutation = useDeleteDisposition();

  const dispositions: Disposition[] = dispositionsData?.data || [];

  const handleStartCreate = () => {
    setEditing({
      label: "",
      color: PRESET_COLORS[0],
      isNew: true,
    });
  };

  const handleStartEdit = (disposition: Disposition) => {
    setEditing({
      id: disposition.id,
      label: disposition.label,
      color: disposition.color || PRESET_COLORS[0],
      isNew: false,
    });
  };

  const handleSave = async () => {
    if (!editing || !editing.label.trim()) return;

    try {
      if (editing.isNew) {
        await createMutation.mutateAsync({
          label: editing.label.trim(),
          color: editing.color,
          sortOrder: dispositions.length,
        });
      } else if (editing.id) {
        await updateMutation.mutateAsync({
          id: editing.id,
          label: editing.label.trim(),
          color: editing.color,
        });
      }
      setEditing(null);
    } catch (error) {
      console.error("Failed to save disposition:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Failed to delete disposition:", error);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Call Status Options</h3>
        <button
          onClick={handleStartCreate}
          disabled={!!editing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="space-y-2">
        {/* Existing dispositions */}
        {dispositions.map((disposition) => (
          <div key={disposition.id}>
            {editing?.id === disposition.id ? (
              // Edit mode
              <div className="p-3 bg-muted/50 border border-border rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editing.label}
                    onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                    placeholder="Status label"
                    className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    autoFocus
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Color:</span>
                  <div className="flex gap-1.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditing({ ...editing, color })}
                        className={`w-6 h-6 rounded-full transition ${
                          editing.color === color
                            ? "ring-2 ring-offset-2 ring-offset-background ring-primary"
                            : ""
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditing(null)}
                    className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || !editing.label.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
                  >
                    {isSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Save
                  </button>
                </div>
              </div>
            ) : deleteConfirm === disposition.id ? (
              // Delete confirmation
              <div className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <span className="text-sm">Delete &quot;{disposition.label}&quot;?</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDeleteConfirm(null)}
                    className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleDelete(disposition.id)}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                    Delete
                  </button>
                </div>
              </div>
            ) : (
              // Normal display
              <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:bg-muted/30 transition group">
                <GripVertical className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab" />
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: disposition.color || "#6b7280" }}
                />
                <span className="flex-1 text-sm font-medium">{disposition.label}</span>
                {disposition.isDefault && (
                  <span className="text-xs px-2 py-0.5 bg-muted text-muted-foreground rounded">
                    Default
                  </span>
                )}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleStartEdit(disposition)}
                    disabled={!!editing}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                    title="Edit"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(disposition.id)}
                    disabled={!!editing || disposition.isDefault}
                    className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded transition disabled:opacity-50 disabled:cursor-not-allowed"
                    title={disposition.isDefault ? "Cannot delete default" : "Delete"}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* New disposition form */}
        {editing?.isNew && (
          <div className="p-3 bg-muted/50 border border-dashed border-border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                placeholder="New status label"
                className="flex-1 px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Color:</span>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setEditing({ ...editing, color })}
                    className={`w-6 h-6 rounded-full transition ${
                      editing.color === color
                        ? "ring-2 ring-offset-2 ring-offset-background ring-primary"
                        : ""
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !editing.label.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                Create
              </button>
            </div>
          </div>
        )}

        {/* Empty state */}
        {dispositions.length === 0 && !editing && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No call status options configured. Add one to get started.
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import { FileText, Plus, Pencil, Trash2, Star, Loader2, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScriptEditor } from "@/components/ui/script-editor";
import {
  useScripts,
  useCreateScript,
  useUpdateScript,
  useDeleteScript,
  Script,
} from "@/hooks/api/useScripts";
import { toast } from "sonner";

interface ScriptManagerProps {
  campaignId: string;
}

type EditorMode = "idle" | "create" | "edit";

export function ScriptManager({ campaignId }: ScriptManagerProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>("idle");
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [deleteScript, setDeleteScript] = useState<Script | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [content, setContent] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const { data: scripts, isLoading } = useScripts(campaignId);
  const createMutation = useCreateScript();
  const updateMutation = useUpdateScript();
  const deleteMutation = useDeleteScript();

  const resetForm = () => {
    setName("");
    setContent("");
    setIsDefault(false);
  };

  const startCreate = () => {
    resetForm();
    setEditingScript(null);
    setEditorMode("create");
  };

  const startEdit = (script: Script) => {
    setName(script.name);
    setContent(script.content);
    setIsDefault(script.isDefault);
    setEditingScript(script);
    setEditorMode("edit");
  };

  const cancelEdit = () => {
    setEditorMode("idle");
    setEditingScript(null);
    resetForm();
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Script name is required");
      return;
    }

    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        content,
        campaignId,
        isDefault,
      });
      toast.success("Script created");
      setEditorMode("idle");
      resetForm();
    } catch {
      toast.error("Failed to create script");
    }
  };

  const handleUpdate = async () => {
    if (!editingScript || !name.trim()) {
      toast.error("Script name is required");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        id: editingScript.id,
        name: name.trim(),
        content,
        isDefault,
      });
      toast.success("Script updated");
      setEditorMode("idle");
      setEditingScript(null);
      resetForm();
    } catch {
      toast.error("Failed to update script");
    }
  };

  const handleDelete = async () => {
    if (!deleteScript) return;

    try {
      await deleteMutation.mutateAsync(deleteScript.id);
      toast.success("Script deleted");
      setDeleteScript(null);
    } catch {
      toast.error("Failed to delete script");
    }
  };

  const handleSetDefault = async (script: Script) => {
    try {
      await updateMutation.mutateAsync({
        id: script.id,
        isDefault: true,
      });
      toast.success("Default script updated");
    } catch {
      toast.error("Failed to update default script");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isEditing = editorMode !== "idle";
  const hasScripts = scripts && scripts.length > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Call Scripts</h3>
          <p className="text-sm text-muted-foreground">
            Create and manage scripts for your sales calls
          </p>
        </div>
        {!isEditing && (
          <Button onClick={startCreate}>
            <Plus className="w-4 h-4 mr-2" />
            New Script
          </Button>
        )}
      </div>

      {/* Inline Editor (Create/Edit Mode) */}
      {isEditing && (
        <div className="border border-border rounded-xl bg-card overflow-hidden">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-sm font-medium text-foreground">
              {editorMode === "create" ? "New Script" : "Edit Script"}
            </span>
            <button
              type="button"
              onClick={cancelEdit}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Script Name */}
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Script name (e.g., Initial Outreach)"
                className="w-full h-10 px-3 rounded-lg border border-input bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 text-sm"
                autoFocus
              />
            </div>

            {/* Script Content Editor */}
            <ScriptEditor
              value={content}
              onChange={setContent}
              placeholder="Start writing your script..."
              minHeight="280px"
            />

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className="text-sm text-muted-foreground">
                  Set as default script
                </span>
              </label>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={editorMode === "create" ? handleCreate : handleUpdate}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {(createMutation.isPending || updateMutation.isPending) ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {editorMode === "create" ? "Creating..." : "Saving..."}
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      {editorMode === "create" ? "Create Script" : "Save Changes"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scripts List */}
      {!isEditing && hasScripts && (
        <div className="space-y-3">
          {scripts.map((script) => (
            <div
              key={script.id}
              className="flex items-start gap-4 p-4 bg-card border border-border rounded-xl hover:border-foreground/20 transition-colors"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <FileText className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-foreground truncate">
                    {script.name}
                  </h4>
                  {script.isDefault && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                      <Star className="w-3 h-3" />
                      Default
                    </span>
                  )}
                </div>
                <div
                  className="mt-1 text-sm text-muted-foreground line-clamp-2 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(script.content.substring(0, 200) + (script.content.length > 200 ? "..." : "")),
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                {!script.isDefault && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(script)}
                    disabled={updateMutation.isPending}
                    title="Set as default"
                    className="h-8 w-8 p-0"
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => startEdit(script)}
                  className="h-8 w-8 p-0"
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteScript(script)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State (no duplicate button) */}
      {!isEditing && !hasScripts && (
        <div className="text-center py-12 border rounded-xl bg-card">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            No scripts yet
          </h3>
          <p className="text-muted-foreground">
            Create your first script to help guide your sales calls
          </p>
        </div>
      )}

      {/* Variable Hints */}
      {!isEditing && (
        <div className="p-4 bg-muted/50 rounded-xl">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Available Variables
          </h4>
          <p className="text-xs text-muted-foreground mb-2">
            Use these placeholders in your script. They will be replaced with lead data during calls.
          </p>
          <div className="flex flex-wrap gap-2">
            {["firstName", "lastName", "company", "title", "email", "phone", "website", "linkedInUrl"].map(
              (variable) => (
                <code
                  key={variable}
                  className="px-2 py-1 text-xs bg-muted rounded font-mono"
                >
                  {`{{${variable}}}`}
                </code>
              )
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteScript}
        onOpenChange={(open) => !open && setDeleteScript(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteScript?.name}&quot;? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

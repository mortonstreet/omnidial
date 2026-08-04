"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, Copy, Loader2, FileText, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useResearchTemplates,
  useCreateResearchTemplate,
  useUpdateResearchTemplate,
  useDeleteResearchTemplate,
} from "@/hooks/api/useResearch";
import { toast } from "sonner";
import type { ResearchTemplateResponse } from "@shared/types/src";

export function ResearchTemplateEditor() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ResearchTemplateResponse | null>(null);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<ResearchTemplateResponse | null>(null);

  const { data, isLoading, refetch } = useResearchTemplates();
  const deleteMutation = useDeleteResearchTemplate();

  const templates = data?.data ?? [];
  const systemTemplates = templates.filter((t) => t.isSystemTemplate);
  const customTemplates = templates.filter((t) => !t.isSystemTemplate);

  const handleDelete = (template: ResearchTemplateResponse) => {
    if (!confirm(`Are you sure you want to delete the "${template.name}" template?`)) {
      return;
    }

    deleteMutation.mutate(template.id, {
      onSuccess: () => {
        toast.success("Template deleted");
        refetch();
      },
      onError: () => toast.error("Failed to delete template"),
    });
  };

  const handleDuplicate = (template: ResearchTemplateResponse) => {
    setDuplicatingTemplate(template);
    setShowAddModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">Research Templates</h3>
          <p className="text-sm text-muted-foreground">
            Configure templates for automated web research
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Template
        </Button>
      </div>

      {/* Custom Templates */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-muted-foreground">Your Templates</h4>
        {customTemplates.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <p className="text-muted-foreground">No custom templates yet</p>
            <Button variant="outline" className="mt-4" onClick={() => setShowAddModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first template
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={() => setEditingTemplate(template)}
                onDelete={() => handleDelete(template)}
                onDuplicate={() => handleDuplicate(template)}
              />
            ))}
          </div>
        )}
      </div>

      {/* System Templates */}
      {systemTemplates.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">System Templates</h4>
          <div className="grid gap-3">
            {systemTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onDuplicate={() => handleDuplicate(template)}
                isSystem
              />
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      <TemplateEditorModal
        key={editingTemplate?.id ?? duplicatingTemplate?.id ?? (showAddModal ? 'new' : 'closed')}
        open={showAddModal || !!editingTemplate}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingTemplate(null);
            setDuplicatingTemplate(null);
          }
        }}
        template={editingTemplate}
        duplicateFrom={duplicatingTemplate}
        onSuccess={() => {
          setShowAddModal(false);
          setEditingTemplate(null);
          setDuplicatingTemplate(null);
          refetch();
        }}
      />
    </div>
  );
}

interface TemplateCardProps {
  template: ResearchTemplateResponse;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
  isSystem?: boolean;
}

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  isSystem,
}: TemplateCardProps) {
  return (
    <div className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-md ${isSystem ? "bg-muted" : "bg-primary/10"}`}>
            {isSystem ? (
              <Globe className="h-4 w-4 text-muted-foreground" />
            ) : (
              <FileText className="h-4 w-4 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-foreground">{template.name}</h4>
              {isSystem && (
                <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                  System
                </span>
              )}
              {!template.isActive && (
                <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">
                  Inactive
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                {template.description}
              </p>
            )}
            {template.targetUrls && template.targetUrls.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {template.targetUrls.slice(0, 3).map((url, i) => (
                  <span
                    key={i}
                    className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
                  >
                    {url.includes("{")
                      ? url
                      : url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                  </span>
                ))}
                {template.targetUrls.length > 3 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    +{template.targetUrls.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onDuplicate && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onDuplicate} title="Duplicate">
              <Copy className="h-4 w-4" />
            </Button>
          )}
          {onEdit && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit} title="Edit">
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={onDelete}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface TemplateEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ResearchTemplateResponse | null;
  duplicateFrom: ResearchTemplateResponse | null;
  onSuccess: () => void;
}

function TemplateEditorModal({
  open,
  onOpenChange,
  template,
  duplicateFrom,
  onSuccess,
}: TemplateEditorModalProps) {
  const source = template || duplicateFrom;

  // Initialize state from props - use a key on Dialog to reset form when source changes
  const getInitialName = () => {
    if (!source) return "";
    return duplicateFrom ? `${source.name} (Copy)` : source.name;
  };

  const [name, setName] = useState(getInitialName);
  const [description, setDescription] = useState(source?.description ?? "");
  const [prompt, setPrompt] = useState(source?.prompt ?? "");
  const [targetUrls, setTargetUrls] = useState(source?.targetUrls?.join("\n") ?? "");

  const createMutation = useCreateResearchTemplate();
  const updateMutation = useUpdateResearchTemplate();

  const isEditing = !!template;
  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim() || !prompt.trim()) {
      toast.error("Name and prompt are required");
      return;
    }

    const urls = targetUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    if (isEditing) {
      updateMutation.mutate(
        {
          id: template.id,
          name,
          description: description || undefined,
          prompt,
          targetUrls: urls,
        },
        {
          onSuccess: () => {
            toast.success("Template updated");
            onSuccess();
          },
          onError: () => toast.error("Failed to update template"),
        }
      );
    } else {
      createMutation.mutate(
        {
          name,
          description: description || undefined,
          prompt,
          targetUrls: urls,
        },
        {
          onSuccess: () => {
            toast.success("Template created");
            onSuccess();
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to create template");
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Template" : duplicateFrom ? "Duplicate Template" : "Create Template"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Template Name</label>
            <Input
              placeholder="Company Funding Research"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              placeholder="Research funding history and investors..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Research Prompt</label>
            <Textarea
              placeholder="Extract information about company funding, including funding rounds, total funding amount..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Instructions for the AI on what data to extract from the web pages
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Target URLs</label>
            <Textarea
              placeholder="https://www.crunchbase.com/organization/{company}
{company_website}/about"
              value={targetUrls}
              onChange={(e) => setTargetUrls(e.target.value)}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              One URL per line. Use placeholders like {"{company}"}, {"{company_website}"},{" "}
              {"{linkedin_url}"}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Create Template"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { Plus, Edit2, Trash2, GripVertical, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useResearchFields,
  useCreateResearchField,
  useUpdateResearchField,
} from "@/hooks/api/useResearch";
import { toast } from "sonner";
import type { CustomFieldSchemaResponse, CustomFieldType } from "@shared/types/src";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "phone", label: "Phone" },
  { value: "date", label: "Date" },
  { value: "select", label: "Select" },
  { value: "multiselect", label: "Multi-Select" },
];

export function CustomFieldSchemaManager() {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingField, setEditingField] = useState<CustomFieldSchemaResponse | null>(null);

  const { data, isLoading, refetch } = useResearchFields();
  const updateMutation = useUpdateResearchField();

  const fields = data?.data ?? [];

  const handleDelete = (field: CustomFieldSchemaResponse) => {
    if (!confirm(`Are you sure you want to delete the "${field.label}" field?`)) {
      return;
    }

    updateMutation.mutate(
      { id: field.id, isActive: false },
      {
        onSuccess: () => {
          toast.success("Field deleted");
          refetch();
        },
        onError: () => toast.error("Failed to delete field"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-foreground">Custom Fields</h3>
          <p className="text-sm text-muted-foreground">
            Define custom fields that can be populated by research
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Field
        </Button>
      </div>

      {fields.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <p className="text-muted-foreground">No custom fields defined yet</p>
          <Button variant="outline" className="mt-4" onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create your first field
          </Button>
        </div>
      ) : (
        <div className="border border-border rounded-lg divide-y divide-border">
          {fields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">{field.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                    {FIELD_TYPES.find((t) => t.value === field.fieldType)?.label || field.fieldType}
                  </span>
                  {field.isRequired && (
                    <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">
                      Required
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground mt-0.5">
                  <code className="text-xs bg-muted px-1 py-0.5 rounded">{field.name}</code>
                  {field.description && <span className="ml-2">{field.description}</span>}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditingField(field)}
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(field)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <FieldEditorModal
        open={showAddModal || !!editingField}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setEditingField(null);
          }
        }}
        field={editingField}
        onSuccess={() => {
          setShowAddModal(false);
          setEditingField(null);
          refetch();
        }}
      />
    </div>
  );
}

interface FieldEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldSchemaResponse | null;
  onSuccess: () => void;
}

function FieldEditorModal({ open, onOpenChange, field, onSuccess }: FieldEditorModalProps) {
  const [name, setName] = useState(field?.name ?? "");
  const [label, setLabel] = useState(field?.label ?? "");
  const [fieldType, setFieldType] = useState<CustomFieldType>(field?.fieldType ?? "text");
  const [description, setDescription] = useState(field?.description ?? "");
  const [isRequired, setIsRequired] = useState(field?.isRequired ?? false);
  const [defaultValue, setDefaultValue] = useState(field?.defaultValue ?? "");

  const createMutation = useCreateResearchField();
  const updateMutation = useUpdateResearchField();

  const isEditing = !!field;
  const isPending = createMutation.isPending || updateMutation.isPending;

  // Reset form when opening with different field
  useState(() => {
    if (field) {
      setName(field.name);
      setLabel(field.label);
      setFieldType(field.fieldType);
      setDescription(field.description ?? "");
      setIsRequired(field.isRequired);
      setDefaultValue(field.defaultValue ?? "");
    } else {
      setName("");
      setLabel("");
      setFieldType("text");
      setDescription("");
      setIsRequired(false);
      setDefaultValue("");
    }
  });

  const handleSubmit = () => {
    if (!name.trim() || !label.trim()) {
      toast.error("Name and label are required");
      return;
    }

    if (isEditing) {
      updateMutation.mutate(
        {
          id: field.id,
          label,
          description: description || undefined,
          isRequired,
          defaultValue: defaultValue || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Field updated");
            onSuccess();
          },
          onError: () => toast.error("Failed to update field"),
        }
      );
    } else {
      createMutation.mutate(
        {
          name: name.toLowerCase().replace(/\s+/g, "_"),
          label,
          fieldType,
          description: description || undefined,
          isRequired,
          defaultValue: defaultValue || undefined,
        },
        {
          onSuccess: () => {
            toast.success("Field created");
            onSuccess();
          },
          onError: (error) => {
            toast.error(error instanceof Error ? error.message : "Failed to create field");
          },
        }
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Field" : "Add Custom Field"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Field Name</label>
              <Input
                placeholder="funding_amount"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isEditing}
              />
              <p className="text-xs text-muted-foreground">Internal name (snake_case)</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Display Label</label>
              <Input
                placeholder="Funding Amount"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Field Type</label>
            <Select
              value={fieldType}
              onValueChange={(value) => setFieldType(value as CustomFieldType)}
              disabled={isEditing}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              placeholder="Optional description for this field"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Default Value</label>
            <Input
              placeholder="Optional default value"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
              className="rounded border-border"
            />
            <span className="text-sm text-foreground">Required field</span>
          </label>
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
              "Create Field"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

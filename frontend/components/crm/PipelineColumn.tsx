"use client";

import { useState } from "react";
import { PipelineStageWithStats } from "@/hooks/api/usePipeline";
import { LeadCard } from "./LeadCard";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  GripVertical,
  Check,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Extended lead type that includes optional client info
interface LeadClient {
  id: string;
  name: string;
  color: string | null;
}

interface PipelineLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  company: string | null;
  dealValue: string | null;
  pipelineStageId: string | null;
  client?: LeadClient | null;
}

interface PipelineColumnProps {
  stage: PipelineStageWithStats;
  leads: PipelineLead[];
  totalStages: number;
  onAddLead?: (stageId: string) => void;
  onLeadClick?: (lead: PipelineLead) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, stageId: string) => void;
  onUpdateStage?: (id: string, data: { label?: string; color?: string }) => void;
  onDeleteStage?: (id: string) => void;
  onStageDragStart?: (e: React.DragEvent, stageId: string) => void;
  onStageDragEnd?: () => void;
  onStageDragOver?: (e: React.DragEvent) => void;
  onStageDrop?: (e: React.DragEvent, targetStageId: string) => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  draggedLeadId?: string | null;
  onLeadDragStart?: (leadId: string) => void;
  onLeadDragEnd?: () => void;
  isLeadDropTarget?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const STAGE_COLORS = [
  "#6B7280", // Gray
  "#3B82F6", // Blue
  "#10B981", // Green
  "#F59E0B", // Yellow
  "#F97316", // Orange
  "#EF4444", // Red
  "#8B5CF6", // Purple
  "#EC4899", // Pink
];

export function PipelineColumn({
  stage,
  leads,
  totalStages,
  onAddLead,
  onLeadClick,
  onDragOver,
  onDrop,
  onUpdateStage,
  onDeleteStage,
  onStageDragStart,
  onStageDragEnd,
  onStageDragOver,
  onStageDrop,
  isDragging: _isDragging,
  isDropTarget,
  draggedLeadId,
  onLeadDragStart,
  onLeadDragEnd,
  isLeadDropTarget,
}: PipelineColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(stage.label);
  const [editColor, setEditColor] = useState(stage.color);

  const canDelete = totalStages > 3;

  const handleSaveEdit = () => {
    if (editLabel.trim() && onUpdateStage) {
      onUpdateStage(stage.id, { label: editLabel.trim(), color: editColor });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditLabel(stage.label);
    setEditColor(stage.color);
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (canDelete && onDeleteStage) {
      if (leads.length > 0) {
        if (!confirm(`This stage has ${leads.length} lead(s). Are you sure you want to delete it? Leads will be moved to "No Stage".`)) {
          return;
        }
      }
      onDeleteStage(stage.id);
    }
  };

  return (
    <div
      className={`flex flex-col w-72 flex-shrink-0 rounded-lg h-[calc(100vh-220px)] min-h-[400px] transition-all duration-200 ease-out ${
        isDropTarget
          ? "bg-primary/10 ring-2 ring-primary/50"
          : isLeadDropTarget
          ? "bg-primary/5 ring-2 ring-primary/30 scale-[1.01]"
          : "bg-muted/30"
      }`}
      onDragOver={(e) => {
        onDragOver?.(e);
        onStageDragOver?.(e);
      }}
      onDrop={(e) => {
        // Check if it's a stage drop or lead drop
        const droppedStageId = e.dataTransfer.getData("stageId");
        if (droppedStageId) {
          onStageDrop?.(e, stage.id);
        } else {
          onDrop?.(e, stage.id);
        }
      }}
    >
      {/* Header - Sticky */}
      <div className="p-3 border-b border-border flex-shrink-0">
        {isEditing ? (
          <div className="space-y-2">
            <FormInput
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              placeholder="Stage name"
              className="text-sm"
              autoFocus
            />
            <div className="flex items-center gap-1">
              {STAGE_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setEditColor(color)}
                  className={`w-5 h-5 rounded-full border-2 transition-all ${
                    editColor === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <div className="flex items-center gap-1 justify-end">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                <X className="w-3 h-3" />
              </Button>
              <Button size="sm" onClick={handleSaveEdit}>
                <Check className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 flex-1 cursor-grab active:cursor-grabbing"
              draggable
              onDragStart={(e) => onStageDragStart?.(e, stage.id)}
              onDragEnd={() => onStageDragEnd?.()}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground opacity-50 hover:opacity-100" />
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <h3 className="font-medium text-sm text-foreground truncate">{stage.label}</h3>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">
                {stage.leadCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {onAddLead && (
                <button
                  onClick={() => onAddLead(stage.id)}
                  className="p-1 hover:bg-muted rounded transition-colors"
                >
                  <Plus className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 hover:bg-muted rounded transition-colors">
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsEditing(true)}>
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit Stage
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleDelete}
                    disabled={!canDelete}
                    className={!canDelete ? "opacity-50 cursor-not-allowed" : "text-destructive focus:text-destructive"}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {canDelete ? "Delete Stage" : "Min 3 stages"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
      </div>

      {/* Cards - Scrollable */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto">
        {leads.map((lead) => {
          const isBeingDragged = draggedLeadId === lead.id;
          return (
            <div
              key={lead.id}
              draggable
              className={`transition-all duration-200 ease-out cursor-grab active:cursor-grabbing ${
                isBeingDragged
                  ? "opacity-50 scale-95"
                  : ""
              }`}
              style={{
                transform: isBeingDragged ? "rotate(2deg)" : undefined,
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData("leadId", lead.id);
                e.dataTransfer.setData("fromStageId", stage.id);
                onLeadDragStart?.(lead.id);
              }}
              onDragEnd={() => {
                onLeadDragEnd?.();
              }}
            >
              <LeadCard
                lead={lead}
                isDragging={isBeingDragged}
                onClick={() => onLeadClick?.(lead)}
              />
            </div>
          );
        })}
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            No leads
          </div>
        )}
      </div>

      {/* Footer - Sticky */}
      <div className="p-3 border-t border-border flex-shrink-0 bg-muted/30">
        <div className="flex items-center justify-center text-sm font-medium text-foreground">
          <span>{formatCurrency(stage.totalValue)}</span>
        </div>
      </div>
    </div>
  );
}

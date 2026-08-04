"use client";

import { useState } from "react";
import {
  Check,
  X,
  Edit2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useResearchApprovals,
  useApproveResearchApproval,
  useRejectResearchApproval,
  useModifyResearchApproval,
  useBulkApproveResearchApprovals,
  useBulkRejectResearchApprovals,
} from "@/hooks/api/useResearch";
import { toast } from "sonner";
import type { ResearchApprovalResponse } from "@shared/types/src";

interface ResearchApprovalPanelProps {
  leadId: string;
  taskId?: string;
  showBulkActions?: boolean;
}

export function ResearchApprovalPanel({
  leadId,
  taskId,
  showBulkActions = true,
}: ResearchApprovalPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expanded, setExpanded] = useState(true);

  const { data, isLoading, refetch } = useResearchApprovals({
    leadId,
    taskId,
    status: "pending",
  });

  const approveMutation = useApproveResearchApproval();
  const rejectMutation = useRejectResearchApproval();
  const modifyMutation = useModifyResearchApproval();
  const bulkApproveMutation = useBulkApproveResearchApprovals();
  const bulkRejectMutation = useBulkRejectResearchApprovals();

  const approvals = data?.data ?? [];
  const pendingCount = approvals.length;

  const handleApprove = (id: string) => {
    approveMutation.mutate(id, {
      onSuccess: () => {
        toast.success("Field approved and applied");
        refetch();
      },
      onError: () => toast.error("Failed to approve"),
    });
  };

  const handleReject = (id: string) => {
    rejectMutation.mutate(
      { id },
      {
        onSuccess: () => {
          toast.success("Field rejected");
          refetch();
        },
        onError: () => toast.error("Failed to reject"),
      }
    );
  };

  const handleModify = (id: string) => {
    modifyMutation.mutate(
      { id, modifiedValue: editValue },
      {
        onSuccess: () => {
          toast.success("Field modified and applied");
          setEditingId(null);
          setEditValue("");
          refetch();
        },
        onError: () => toast.error("Failed to modify"),
      }
    );
  };

  const handleBulkApprove = () => {
    const ids = selectedIds.length > 0 ? selectedIds : approvals.map((a) => a.id);
    bulkApproveMutation.mutate(ids, {
      onSuccess: (result) => {
        toast.success(`Approved ${result.totalProcessed} field(s)`);
        setSelectedIds([]);
        refetch();
      },
      onError: () => toast.error("Failed to bulk approve"),
    });
  };

  const handleBulkReject = () => {
    const ids = selectedIds.length > 0 ? selectedIds : approvals.map((a) => a.id);
    bulkRejectMutation.mutate(
      { ids },
      {
        onSuccess: (result) => {
          toast.success(`Rejected ${result.totalProcessed} field(s)`);
          setSelectedIds([]);
          refetch();
        },
        onError: () => toast.error("Failed to bulk reject"),
      }
    );
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === approvals.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(approvals.map((a) => a.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pendingCount === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">Research Results</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {pendingCount} pending
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <>
          {/* Bulk Actions */}
          {showBulkActions && pendingCount > 1 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedIds.length === approvals.length}
                  onChange={selectAll}
                  className="rounded border-border"
                />
                <span className="text-muted-foreground">
                  {selectedIds.length > 0
                    ? `${selectedIds.length} selected`
                    : "Select all"}
                </span>
              </label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkApprove}
                  disabled={bulkApproveMutation.isPending}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Approve {selectedIds.length > 0 ? "Selected" : "All"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkReject}
                  disabled={bulkRejectMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject {selectedIds.length > 0 ? "Selected" : "All"}
                </Button>
              </div>
            </div>
          )}

          {/* Approval Items */}
          <div className="divide-y divide-border">
            {approvals.map((approval) => (
              <ApprovalItem
                key={approval.id}
                approval={approval}
                isSelected={selectedIds.includes(approval.id)}
                onToggleSelect={() => toggleSelection(approval.id)}
                isEditing={editingId === approval.id}
                editValue={editValue}
                onEditValueChange={setEditValue}
                onStartEdit={() => {
                  setEditingId(approval.id);
                  setEditValue(approval.proposedValue);
                }}
                onCancelEdit={() => {
                  setEditingId(null);
                  setEditValue("");
                }}
                onApprove={() => handleApprove(approval.id)}
                onReject={() => handleReject(approval.id)}
                onModify={() => handleModify(approval.id)}
                isApproving={approveMutation.isPending}
                isRejecting={rejectMutation.isPending}
                isModifying={modifyMutation.isPending}
                showCheckbox={showBulkActions && pendingCount > 1}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface ApprovalItemProps {
  approval: ResearchApprovalResponse;
  isSelected: boolean;
  onToggleSelect: () => void;
  isEditing: boolean;
  editValue: string;
  onEditValueChange: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onModify: () => void;
  isApproving: boolean;
  isRejecting: boolean;
  isModifying: boolean;
  showCheckbox: boolean;
}

function ApprovalItem({
  approval,
  isSelected,
  onToggleSelect,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onCancelEdit,
  onApprove,
  onReject,
  onModify,
  isApproving,
  isRejecting,
  isModifying,
  showCheckbox,
}: ApprovalItemProps) {
  const fieldLabel = approval.fieldLabel || approval.fieldName;
  const hasCurrentValue = approval.currentValue && approval.currentValue !== "";
  const confidence = approval.confidence;

  return (
    <div className="p-4 hover:bg-muted/30 transition-colors">
      <div className="flex items-start gap-3">
        {showCheckbox && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mt-1 rounded border-border"
          />
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground">{fieldLabel}</span>
            {confidence !== null && confidence !== undefined && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded ${
                  confidence >= 0.8
                    ? "bg-green-100 text-green-700"
                    : confidence >= 0.5
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {Math.round(confidence * 100)}% confidence
              </span>
            )}
          </div>

          {/* Value comparison */}
          <div className="space-y-1">
            {hasCurrentValue && (
              <div className="text-sm">
                <span className="text-muted-foreground">Current: </span>
                <span className="text-foreground/70 line-through">{approval.currentValue}</span>
              </div>
            )}

            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  value={editValue}
                  onChange={(e) => onEditValueChange(e.target.value)}
                  className="flex-1"
                  autoFocus
                />
                <Button size="sm" onClick={onModify} disabled={isModifying}>
                  {isModifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-muted-foreground">Proposed: </span>
                <span className="text-foreground font-medium">{approval.proposedValue}</span>
              </div>
            )}
          </div>

          {/* Source */}
          {approval.source && (
            <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <span>Source:</span>
              <a
                href={approval.source}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-0.5"
              >
                {new URL(approval.source).hostname}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>

        {/* Actions */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={onStartEdit}
              title="Edit value"
            >
              <Edit2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
              onClick={onApprove}
              disabled={isApproving}
              title="Approve"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={onReject}
              disabled={isRejecting}
              title="Reject"
            >
              {isRejecting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

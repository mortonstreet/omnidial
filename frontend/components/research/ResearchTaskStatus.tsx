"use client";

import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResearchTask, useCancelResearchTask, useRetryResearchTask } from "@/hooks/api/useResearch";
import type { ResearchTaskStatus as TaskStatus } from "@shared/types/src";

interface ResearchTaskStatusProps {
  taskId: string;
  showActions?: boolean;
  compact?: boolean;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  {
    icon: typeof Loader2;
    label: string;
    color: string;
    bgColor: string;
    animate?: boolean;
  }
> = {
  pending: {
    icon: Clock,
    label: "Pending",
    color: "text-yellow-600",
    bgColor: "bg-yellow-100",
  },
  queued: {
    icon: Clock,
    label: "Queued",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
  },
  running: {
    icon: Loader2,
    label: "Running",
    color: "text-blue-600",
    bgColor: "bg-blue-100",
    animate: true,
  },
  completed: {
    icon: CheckCircle2,
    label: "Completed",
    color: "text-green-600",
    bgColor: "bg-green-100",
  },
  failed: {
    icon: XCircle,
    label: "Failed",
    color: "text-red-600",
    bgColor: "bg-red-100",
  },
  cancelled: {
    icon: AlertCircle,
    label: "Cancelled",
    color: "text-gray-600",
    bgColor: "bg-gray-100",
  },
};

export function ResearchTaskStatus({
  taskId,
  showActions = false,
  compact = false,
}: ResearchTaskStatusProps) {
  const { data: task, isLoading } = useResearchTask(taskId, true);
  const cancelMutation = useCancelResearchTask();
  const retryMutation = useRetryResearchTask();

  if (isLoading || !task) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </div>
    );
  }

  const status = task.status as TaskStatus;
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  if (compact) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
      >
        <Icon className={`h-3 w-3 ${config.animate ? "animate-spin" : ""}`} />
        {config.label}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-md ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.color} ${config.animate ? "animate-spin" : ""}`} />
          </div>
          <div>
            <h4 className="font-medium text-foreground">{config.label}</h4>
            {task.errorMessage && status === "failed" && (
              <p className="text-sm text-destructive mt-1">{task.errorMessage}</p>
            )}
            {status === "running" && (
              <p className="text-sm text-muted-foreground mt-1">
                {task.crawlCount > 0
                  ? `Crawled ${task.crawlCount} page${task.crawlCount !== 1 ? "s" : ""}`
                  : "Starting web crawl..."}
              </p>
            )}
            {status === "completed" && (
              <p className="text-sm text-muted-foreground mt-1">
                {task.crawlCount} page{task.crawlCount !== 1 ? "s" : ""} crawled
                {task.creditsUsed > 0 && ` (${task.creditsUsed} credits used)`}
              </p>
            )}
          </div>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            {(status === "pending" || status === "queued" || status === "running") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate(taskId)}
                disabled={cancelMutation.isPending}
              >
                Cancel
              </Button>
            )}
            {status === "failed" && task.retryCount < task.maxRetries && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryMutation.mutate(taskId)}
                disabled={retryMutation.isPending}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Progress bar for running tasks */}
      {status === "running" && (
        <div className="mt-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary animate-pulse w-1/2" />
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
        {task.startedAt && <span>Started: {new Date(task.startedAt).toLocaleString()}</span>}
        {task.completedAt && <span>Completed: {new Date(task.completedAt).toLocaleString()}</span>}
      </div>
    </div>
  );
}

// Simple badge version for lists
export function ResearchTaskStatusBadge({ status }: { status: TaskStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      <Icon className={`h-3 w-3 ${config.animate ? "animate-spin" : ""}`} />
      {config.label}
    </div>
  );
}

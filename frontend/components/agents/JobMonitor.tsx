"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import {
  useAgentJobs,
  useAgentJobProgress,
  useStartJob,
  usePauseJob,
  useResumeJob,
  useCancelJob,
  type OrchestrationJob,
} from "@/hooks/api/useAgents";
import { toast } from "sonner";

const statusConfig = {
  pending: { label: "Pending", color: "bg-gray-500/10 text-gray-500", icon: Clock },
  running: { label: "Running", color: "bg-blue-500/10 text-blue-500", icon: Loader2 },
  paused: { label: "Paused", color: "bg-yellow-500/10 text-yellow-500", icon: Pause },
  completed: { label: "Completed", color: "bg-green-500/10 text-green-500", icon: CheckCircle2 },
  failed: { label: "Failed", color: "bg-red-500/10 text-red-500", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-gray-500/10 text-gray-500", icon: Square },
};

interface JobMonitorProps {
  agentId: string;
}

export function JobMonitor({ agentId }: JobMonitorProps) {
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const { data, isLoading } = useAgentJobs(agentId);

  const startJob = useStartJob();
  const pauseJob = usePauseJob();
  const resumeJob = useResumeJob();
  const cancelJob = useCancelJob();

  const handleStart = async (jobId: string) => {
    try {
      await startJob.mutateAsync({ agentId, jobId });
      toast.success("Job started");
    } catch {
      toast.error("Failed to start job");
    }
  };

  const handlePause = async (jobId: string) => {
    try {
      await pauseJob.mutateAsync({ agentId, jobId });
      toast.success("Job paused");
    } catch {
      toast.error("Failed to pause job");
    }
  };

  const handleResume = async (jobId: string) => {
    try {
      await resumeJob.mutateAsync({ agentId, jobId });
      toast.success("Job resumed");
    } catch {
      toast.error("Failed to resume job");
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await cancelJob.mutateAsync({ agentId, jobId });
      toast.success("Job cancelled");
    } catch {
      toast.error("Failed to cancel job");
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Orchestration Jobs</CardTitle>
          <CardDescription>Monitor and control parallel agent jobs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const jobs = data?.jobs || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Orchestration Jobs</CardTitle>
        <CardDescription>
          {data?.total || 0} jobs for this agent
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No jobs created yet
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => (
              <JobItem
                key={job.id}
                job={job}
                agentId={agentId}
                expanded={expandedJobId === job.id}
                onToggleExpand={() =>
                  setExpandedJobId(expandedJobId === job.id ? null : job.id)
                }
                onStart={() => handleStart(job.id)}
                onPause={() => handlePause(job.id)}
                onResume={() => handleResume(job.id)}
                onCancel={() => handleCancel(job.id)}
                isLoading={
                  startJob.isPending ||
                  pauseJob.isPending ||
                  resumeJob.isPending ||
                  cancelJob.isPending
                }
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobItem({
  job,
  agentId,
  expanded,
  onToggleExpand,
  onStart,
  onPause,
  onResume,
  onCancel,
  isLoading,
}: {
  job: OrchestrationJob;
  agentId: string;
  expanded: boolean;
  onToggleExpand: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const config = statusConfig[job.status as keyof typeof statusConfig];
  const StatusIcon = config?.icon || Clock;
  const progressPercent =
    job.totalSteps > 0
      ? Math.round((job.completedSteps / job.totalSteps) * 100)
      : 0;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StatusIcon
              className={`h-5 w-5 ${
                job.status === "running" ? "animate-spin text-blue-500" : ""
              }`}
            />
            <div>
              <p className="font-medium">{job.name}</p>
              <p className="text-sm text-muted-foreground">
                {job.jobType} &bull; {job.targetType}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className={config?.color}>
              {config?.label || job.status}
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground">
              {job.completedSteps} / {job.totalSteps} steps
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      </div>

      {expanded && (
        <JobDetails
          job={job}
          agentId={agentId}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

function JobDetails({
  job,
  agentId,
  onStart,
  onPause,
  onResume,
  onCancel,
  isLoading,
}: {
  job: OrchestrationJob;
  agentId: string;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const { data: progress } = useAgentJobProgress(
    agentId,
    job.status === "running" ? job.id : undefined
  );

  const canStart = job.status === "pending";
  const canPause = job.status === "running";
  const canResume = job.status === "paused";
  const canCancel = ["pending", "running", "paused"].includes(job.status);

  return (
    <div className="border-t p-4 bg-muted/30 space-y-4">
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Completed</p>
          <p className="font-medium text-green-600">{job.completedSteps}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Failed</p>
          <p className="font-medium text-red-600">{job.failedSteps}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Remaining</p>
          <p className="font-medium">
            {job.totalSteps - job.completedSteps - job.failedSteps}
          </p>
        </div>
      </div>

      {progress?.estimatedTimeRemaining && (
        <div className="text-sm">
          <p className="text-muted-foreground">
            Estimated time remaining:{" "}
            <span className="font-medium">
              {formatDuration(progress.estimatedTimeRemaining)}
            </span>
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        {canStart && (
          <Button size="sm" onClick={onStart} disabled={isLoading}>
            <Play className="h-4 w-4 mr-1" />
            Start
          </Button>
        )}
        {canPause && (
          <Button size="sm" variant="outline" onClick={onPause} disabled={isLoading}>
            <Pause className="h-4 w-4 mr-1" />
            Pause
          </Button>
        )}
        {canResume && (
          <Button size="sm" onClick={onResume} disabled={isLoading}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Resume
          </Button>
        )}
        {canCancel && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            className="text-red-600"
          >
            <Square className="h-4 w-4 mr-1" />
            Cancel
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        {job.startedAt && (
          <p>Started: {new Date(job.startedAt).toLocaleString()}</p>
        )}
        {job.completedAt && (
          <p>Completed: {new Date(job.completedAt).toLocaleString()}</p>
        )}
        <p>Created: {new Date(job.createdAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

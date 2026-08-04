"use client";

import { useLeadActivity, ActivityItem } from "@/hooks/api/useLeads";
import { format } from "date-fns";
import {
  FileText,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  Check,
  Circle,
} from "lucide-react";
import { AudioPlayer } from "@/components/ui/audio-player";

interface ActivityTimelineProps {
  leadId: string;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function ActivityIcon({ item }: { item: ActivityItem }) {
  switch (item.type) {
    case "call":
      return item.metadata?.direction === "inbound" ? (
        <PhoneIncoming className="w-4 h-4 text-blue-500" />
      ) : (
        <PhoneOutgoing className="w-4 h-4 text-green-500" />
      );
    case "note":
      return <FileText className="w-4 h-4 text-purple-500" />;
    case "task":
      return item.metadata?.completed ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Circle className="w-4 h-4 text-orange-500" />
      );
    default:
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function ActivityItemCard({ item }: { item: ActivityItem }) {
  const typeLabels = {
    call: "Call",
    note: "Note",
    task: "Task",
  };

  return (
    <div className="flex gap-3 py-3">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center">
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <ActivityIcon item={item} />
        </div>
        <div className="flex-1 w-px bg-border mt-2" />
      </div>

      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {typeLabels[item.type]}
          </span>
          <span className="text-xs text-muted-foreground">
            {format(new Date(item.createdAt), "MMM d, yyyy 'at' h:mm a")}
          </span>
        </div>

        <p className="text-sm text-foreground mt-1 whitespace-pre-wrap">
          {item.content}
        </p>

        {/* Call metadata */}
        {item.type === "call" && item.metadata && (
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            {item.metadata.duration !== undefined && item.metadata.duration > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(item.metadata.duration)}
              </span>
            )}
            {item.metadata.status && (
              <span
                className={`px-2 py-0.5 rounded text-xs ${
                  item.metadata.status === "completed"
                    ? "bg-green-100 text-green-700"
                    : item.metadata.status === "failed" ||
                      item.metadata.status === "missed"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {item.metadata.status}
              </span>
            )}
            {item.metadata.recordingUrl && (
              <AudioPlayer
                callId={item.id}
                callDate={item.createdAt}
                compact
              />
            )}
          </div>
        )}

        {/* Task metadata */}
        {item.type === "task" && item.metadata && (
          <div className="mt-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${
                item.metadata.completed
                  ? "bg-green-100 text-green-700"
                  : "bg-orange-100 text-orange-700"
              }`}
            >
              {item.metadata.completed ? (
                <>
                  <Check className="w-3 h-3" />
                  Completed
                </>
              ) : (
                <>
                  <Circle className="w-3 h-3" />
                  Pending
                </>
              )}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActivityTimeline({ leadId }: ActivityTimelineProps) {
  const { data, isLoading } = useLeadActivity(leadId);
  const activities = data?.data || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-muted-foreground">No activity yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          Activity will appear here when you add notes, tasks, or make calls.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((item) => (
        <ActivityItemCard key={item.id} item={item} />
      ))}
    </div>
  );
}

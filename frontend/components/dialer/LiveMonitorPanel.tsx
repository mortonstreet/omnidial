"use client";

import { useActiveSessions } from "@/hooks/api/useDialerSessions";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headphones, Users, Radio, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LiveMonitorPanelProps {
  className?: string;
}

export function LiveMonitorPanel({ className }: LiveMonitorPanelProps) {
  const { data: sessionsData, isLoading, refetch, isFetching } = useActiveSessions();
  const sessions = sessionsData?.data || [];

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Live Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Headphones className="w-5 h-5" />
            Live Monitor
            {sessions.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {sessions.length} active
              </Badge>
            )}
          </CardTitle>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">No active dialer sessions</p>
            <p className="text-xs text-muted-foreground mt-1">
              Sessions will appear here when team members start power dialing
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border"
              >
                {/* Status indicator */}
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                    <Radio className="w-5 h-5 text-green-500" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                </div>

                {/* User info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {session.userName || session.userEmail || "Unknown User"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Started {formatDistanceToNow(new Date(session.startedAt), { addSuffix: true })}
                  </p>
                </div>

                {/* Status badge */}
                <Badge
                  variant="outline"
                  className="bg-green-500/10 text-green-600 border-green-500/20"
                >
                  {session.currentCallId ? "On Call" : "Dialing"}
                </Badge>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-4 text-center">
          Auto-refreshes every 10 seconds
        </p>
      </CardContent>
    </Card>
  );
}

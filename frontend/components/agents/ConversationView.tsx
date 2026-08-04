"use client";

import { useState } from "react";
import DOMPurify from "dompurify";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Mail,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  User,
  Clock,
} from "lucide-react";
import { useAgentConversations, type ConversationMessage } from "@/hooks/api/useAgents";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface ConversationViewProps {
  agentId: string;
  leadId?: string;
  className?: string;
}

export function ConversationView({ agentId, leadId, className }: ConversationViewProps) {
  const [filterType, setFilterType] = useState<"all" | "sms" | "email">("all");
  const { data, isLoading, refetch, isRefetching } = useAgentConversations(agentId, leadId);

  const messages = data?.messages ?? [];
  const filteredMessages = messages.filter((msg) => {
    if (filterType === "all") return true;
    return msg.messageType === filterType;
  });

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">Conversations</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-16 w-full" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg">Conversations</CardTitle>
        <div className="flex items-center gap-2">
          <Select
            value={filterType}
            onValueChange={(value: "all" | "sms" | "email") => setFilterType(value)}
          >
            <SelectTrigger className="w-[120px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="email">Email</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={cn("h-4 w-4", isRefetching && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filteredMessages.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No conversations yet</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
            {filteredMessages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MessageBubbleProps {
  message: ConversationMessage;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const isInbound = message.direction === "inbound";
  const isSms = message.messageType === "sms";

  const statusColors: Record<string, string> = {
    sent: "bg-green-500/10 text-green-600 border-green-500/20",
    delivered: "bg-green-500/10 text-green-600 border-green-500/20",
    sending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
    failed: "bg-red-500/10 text-red-600 border-red-500/20",
    received: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  };

  return (
    <div
      className={cn(
        "flex gap-3",
        isInbound ? "flex-row" : "flex-row-reverse"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center",
          isInbound ? "bg-blue-500/10" : "bg-primary/10"
        )}
      >
        {isInbound ? (
          <User className="h-5 w-5 text-blue-500" />
        ) : isSms ? (
          <MessageSquare className="h-5 w-5 text-primary" />
        ) : (
          <Mail className="h-5 w-5 text-primary" />
        )}
      </div>

      <div
        className={cn(
          "flex-1 max-w-[80%]",
          isInbound ? "items-start" : "items-end"
        )}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">
            {isInbound
              ? message.lead
                ? `${message.lead.firstName || ""} ${message.lead.lastName || ""}`.trim() ||
                  "Unknown Lead"
                : message.fromPhone || "Unknown"
              : "Agent"}
          </span>
          <Badge variant="outline" className="text-xs gap-1">
            {isInbound ? (
              <ArrowDownLeft className="h-3 w-3" />
            ) : (
              <ArrowUpRight className="h-3 w-3" />
            )}
            {isInbound ? "Inbound" : "Outbound"}
          </Badge>
          {isSms ? (
            <Badge variant="secondary" className="text-xs gap-1">
              <MessageSquare className="h-3 w-3" />
              SMS
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs gap-1">
              <Mail className="h-3 w-3" />
              Email
            </Badge>
          )}
        </div>

        <div
          className={cn(
            "rounded-lg p-3 text-sm",
            isInbound
              ? "bg-muted"
              : "bg-primary/5 border border-primary/10"
          )}
        >
          {isSms ? (
            <p className="whitespace-pre-wrap">{message.smsBody}</p>
          ) : (
            <>
              {message.emailSubject && (
                <p className="font-medium mb-2">{message.emailSubject}</p>
              )}
              <div
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(message.emailBodyHtml || "") }}
              />
            </>
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
          {!isInbound && (
            <Badge
              variant="outline"
              className={cn("text-xs", statusColors[message.status] || "")}
            >
              {message.status}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}

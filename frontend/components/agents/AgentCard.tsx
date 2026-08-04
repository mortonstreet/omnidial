"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Play, Pause, Mail, MessageSquare, Trash2, Settings } from "lucide-react";
import type { Agent } from "@/hooks/api/useAgents";

interface AgentCardProps {
  agent: Agent;
  onActivate: (id: string) => void;
  onDeactivate: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (agent: Agent) => void;
}

export function AgentCard({
  agent,
  onActivate,
  onDeactivate,
  onDelete,
  onEdit,
}: AgentCardProps) {
  const statusColors = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
    paused: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  };

  return (
    <Card className="group hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">{agent.name}</CardTitle>
            <CardDescription className="line-clamp-2">
              {agent.description || "No description"}
            </CardDescription>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(agent)}>
                <Settings className="mr-2 h-4 w-4" />
                Edit Agent
              </DropdownMenuItem>
              {agent.status === "active" ? (
                <DropdownMenuItem onClick={() => onDeactivate(agent.id)}>
                  <Pause className="mr-2 h-4 w-4" />
                  Deactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => onActivate(agent.id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Activate
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onDelete(agent.id)}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={statusColors[agent.status as keyof typeof statusColors]}
            >
              {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
            </Badge>
            {agent.emailEnabled && (
              <Badge variant="secondary" className="gap-1">
                <Mail className="h-3 w-3" />
                Email
              </Badge>
            )}
            {agent.smsEnabled && (
              <Badge variant="secondary" className="gap-1">
                <MessageSquare className="h-3 w-3" />
                SMS
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Daily Email Limit</p>
              <p className="font-medium">{agent.dailyEmailLimit}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Daily SMS Limit</p>
              <p className="font-medium">{agent.dailySmsLimit}</p>
            </div>
          </div>

          {agent.emailConfig && (
            <div className="text-sm">
              <p className="text-muted-foreground">Email</p>
              <p className="font-medium truncate">{agent.emailConfig.fromEmail}</p>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            Created {new Date(agent.createdAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

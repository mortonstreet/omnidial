"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Bot, Zap, Shield, AlertTriangle, Info, RefreshCw } from "lucide-react";
import { useAgent, useToggleAutonomousSms } from "@/hooks/api/useAgents";
import { cn } from "@/lib/utils";

interface AutonomySettingsProps {
  agentId: string;
  className?: string;
}

export function AutonomySettings({ agentId, className }: AutonomySettingsProps) {
  const { data: agent, isLoading } = useAgent(agentId);
  const toggleAutonomous = useToggleAutonomousSms();

  // Derive initial values from agent data
  const serverAutonomousEnabled = agent?.smsConfig?.autonomousEnabled ?? false;
  const serverMaxReplies = agent?.smsConfig?.maxRepliesPerLead ?? 5;

  const [localAutonomousEnabled, setLocalAutonomousEnabled] = useState<boolean | null>(null);
  const [localMaxReplies, setLocalMaxReplies] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Use local state if user has made changes, otherwise use server state
  const autonomousEnabled = localAutonomousEnabled ?? serverAutonomousEnabled;
  const maxReplies = localMaxReplies ?? serverMaxReplies;

  const handleToggle = (enabled: boolean) => {
    setLocalAutonomousEnabled(enabled);
    setHasChanges(true);
  };

  const handleMaxRepliesChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1 && num <= 50) {
      setLocalMaxReplies(num);
      setHasChanges(true);
    }
  };

  const handleSave = () => {
    toggleAutonomous.mutate(
      {
        agentId,
        enabled: autonomousEnabled,
        maxRepliesPerLead: maxReplies,
      },
      {
        onSuccess: () => {
          // Reset local state to sync with server
          setLocalAutonomousEnabled(null);
          setLocalMaxReplies(null);
          setHasChanges(false);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Autonomy Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!agent?.smsEnabled || !agent?.smsConfig) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Autonomy Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <AlertTriangle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>SMS must be enabled and configured for this agent</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Autonomy Settings
            </CardTitle>
            <CardDescription className="mt-1">
              Configure automatic SMS responses
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn(
              autonomousEnabled
                ? "bg-green-500/10 text-green-600 border-green-500/20"
                : "bg-gray-500/10 text-gray-600 border-gray-500/20"
            )}
          >
            {autonomousEnabled ? (
              <>
                <Zap className="h-3 w-3 mr-1" />
                Autonomous
              </>
            ) : (
              <>
                <Shield className="h-3 w-3 mr-1" />
                Manual Approval
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="autonomous-toggle" className="text-base font-medium">
              Autonomous Responses
            </Label>
            <p className="text-sm text-muted-foreground">
              {autonomousEnabled
                ? "Agent will automatically reply to inbound SMS"
                : "Responses require approval via Slack"}
            </p>
          </div>
          <Switch
            id="autonomous-toggle"
            checked={autonomousEnabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {autonomousEnabled && (
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Rate Limiting</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">
                      Prevents excessive messaging to a single lead. Once the limit is
                      reached, messages will require manual approval.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Label htmlFor="max-replies">Maximum replies per lead (per day)</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="max-replies"
                  type="number"
                  min={1}
                  max={50}
                  value={maxReplies}
                  onChange={(e) => handleMaxRepliesChange(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">replies</span>
              </div>
              <p className="text-xs text-muted-foreground">
                After this limit, additional responses will be sent to Slack for approval
              </p>
            </div>
          </div>
        )}

        {!autonomousEnabled && (
          <div className="p-4 border rounded-lg bg-blue-500/5 border-blue-500/20">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Manual Approval Mode
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  All AI-generated responses will be sent to your connected Slack
                  workspace for review before sending.
                </p>
              </div>
            </div>
          </div>
        )}

        {hasChanges && (
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                // Reset to server values by clearing local state
                setLocalAutonomousEnabled(null);
                setLocalMaxReplies(null);
                setHasChanges(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={toggleAutonomous.isPending}>
              {toggleAutonomous.isPending && (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

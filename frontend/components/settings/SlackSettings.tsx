"use client";

import { useState } from "react";
import Card from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useSlackStatus,
  useSlackChannels,
  useDisconnectSlack,
  useUpdateSlackNotificationRules,
  useAutoLinkSlackUsers,
  useTestSlackNotification,
} from "@/hooks/api/useSlack";
import type { SlackEventType } from "@shared/types/src";

// Display labels for event types
const EVENT_TYPE_LABELS: Record<SlackEventType, { label: string; description: string }> = {
  inbound_call: {
    label: "Inbound Calls",
    description: "Get notified when an inbound call is received",
  },
  call_completed: {
    label: "Call Completed",
    description: "Notify when calls are completed with summaries",
  },
  milestone_reached: {
    label: "Milestones",
    description: "Celebrate when reps hit call milestones (50, 100 calls, etc.)",
  },
  daily_summary: {
    label: "Daily Summary",
    description: "Daily performance summary for the team",
  },
  weekly_summary: {
    label: "Weekly Summary",
    description: "Weekly performance roundup",
  },
  lead_created: {
    label: "New Leads",
    description: "Notify when new leads are added",
  },
  deal_won: {
    label: "Deals Won",
    description: "Celebrate closed won deals",
  },
  deal_lost: {
    label: "Deals Lost",
    description: "Track deals that didn't close",
  },
  coaching_available: {
    label: "Coaching Ready",
    description: "Notify when coaching reports are available",
  },
  rep_activity: {
    label: "Rep Activity",
    description: "Track when reps start/stop dialing sessions",
  },
};

// Core event types to show by default
const CORE_EVENT_TYPES: SlackEventType[] = [
  "inbound_call",
  "call_completed",
  "milestone_reached",
  "daily_summary",
  "deal_won",
  "rep_activity",
];

export function SlackSettings() {
  const { data: status, isLoading, refetch } = useSlackStatus();
  const { data: channelsData, refetch: refetchChannels } = useSlackChannels();
  const disconnectMutation = useDisconnectSlack();
  const updateRulesMutation = useUpdateSlackNotificationRules();
  const autoLinkMutation = useAutoLinkSlackUsers();
  const testNotificationMutation = useTestSlackNotification();

  const [selectedChannelOverride, setSelectedChannelOverride] = useState<string | null>(null);
  const [enabledRulesOverride, setEnabledRulesOverride] = useState<Record<string, boolean> | null>(null);

  // Derive effective values from server data with local overrides
  const selectedChannel = selectedChannelOverride ?? status?.workspace?.defaultChannelId ?? "";
  const serverRules = status?.notificationRules?.reduce((acc, rule) => {
    acc[rule.eventType] = rule.enabled;
    return acc;
  }, {} as Record<string, boolean>) ?? {};
  const enabledRules = enabledRulesOverride ?? serverRules;

  const handleConnect = () => {
    if (status?.installUrl) {
      window.location.href = status.installUrl;
    }
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect Slack? This will stop all Slack notifications.")) {
      return;
    }

    disconnectMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Slack disconnected successfully");
        refetch();
      },
      onError: () => {
        toast.error("Failed to disconnect Slack");
      },
    });
  };

  const handleChannelChange = (channelId: string) => {
    setSelectedChannelOverride(channelId);
    // Save rules for this channel
    const rules = CORE_EVENT_TYPES.map((eventType) => ({
      eventType,
      enabled: enabledRules[eventType] ?? false,
    }));

    updateRulesMutation.mutate(
      { channelId, rules },
      {
        onSuccess: () => {
          toast.success("Channel updated");
          refetch();
        },
        onError: () => {
          toast.error("Failed to update channel");
        },
      }
    );
  };

  const handleRuleToggle = (eventType: SlackEventType, enabled: boolean) => {
    const newRules = { ...enabledRules, [eventType]: enabled };
    setEnabledRulesOverride(newRules);

    if (!selectedChannel) return;

    const rules = CORE_EVENT_TYPES.map((et) => ({
      eventType: et,
      enabled: newRules[et] ?? false,
    }));

    updateRulesMutation.mutate(
      { channelId: selectedChannel, rules },
      {
        onError: () => {
          // Revert on error
          setEnabledRulesOverride(null);
          toast.error("Failed to update notification rule");
        },
      }
    );
  };

  const handleAutoLink = () => {
    autoLinkMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.linkedCount > 0) {
          toast.success(`Linked ${result.linkedCount} users by email`);
        } else {
          toast.info("No new users to link");
        }
        refetch();
      },
      onError: () => {
        toast.error("Failed to auto-link users");
      },
    });
  };

  const handleTestNotification = () => {
    if (!selectedChannel) {
      toast.error("Please select a channel first");
      return;
    }

    testNotificationMutation.mutate(
      { channelId: selectedChannel },
      {
        onSuccess: () => {
          toast.success("Test notification sent!");
        },
        onError: () => {
          toast.error("Failed to send test notification");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card title="Loading...">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        </Card>
      </div>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <div className="space-y-6">
        <Card title="Slack Integration">
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-xl flex items-center justify-center">
              <SlackIcon className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Connect Slack</h3>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              Get real-time notifications for calls, milestones, and performance updates directly in your Slack workspace.
            </p>
            <Button onClick={handleConnect} size="lg">
              <SlackIcon className="w-5 h-5 mr-2" />
              Add to Slack
            </Button>
          </div>
        </Card>

        <Card title="Features">
          <div className="grid gap-4 sm:grid-cols-2">
            <FeatureItem
              title="Real-time Notifications"
              description="Inbound calls, completed calls, and rep activity alerts"
            />
            <FeatureItem
              title="Performance Milestones"
              description="Celebrate when reps hit 50, 100, or more calls"
            />
            <FeatureItem
              title="Slash Commands"
              description="Quick access to stats, leads, and leaderboards"
            />
            <FeatureItem
              title="Daily Summaries"
              description="Automated daily and weekly performance reports"
            />
          </div>
        </Card>
      </div>
    );
  }

  // Connected state
  const channels = channelsData?.channels || [];

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card title="Connection Status">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
              <SlackIcon className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{status.workspace?.teamName}</p>
                <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                  Connected
                </span>
              </div>
              {status.workspace?.teamDomain && (
                <p className="text-sm text-muted-foreground">
                  {status.workspace.teamDomain}.slack.com
                </p>
              )}
              {status.linkedUsers !== undefined && (
                <p className="text-xs text-muted-foreground mt-1">
                  {status.linkedUsers} users linked
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            Disconnect
          </Button>
        </div>
      </Card>

      {/* Notification Channel */}
      <Card title="Notification Channel">
        <p className="text-sm text-muted-foreground mb-4">
          Choose which Slack channel should receive notifications from OmniDial.
        </p>
        <div className="flex items-center gap-4">
          <Select value={selectedChannel} onValueChange={handleChannelChange}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a channel" />
            </SelectTrigger>
            <SelectContent>
              {channels.map((channel) => (
                <SelectItem key={channel.id} value={channel.id}>
                  {channel.isPrivate ? "🔒 " : "# "}
                  {channel.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchChannels()}
          >
            Refresh
          </Button>
        </div>
        {channels.length === 0 && (
          <p className="text-sm text-muted-foreground mt-2">
            No channels found. Make sure the OmniDial bot is invited to at least one channel.
          </p>
        )}
      </Card>

      {/* Notification Rules */}
      <Card title="Notification Types">
        <p className="text-sm text-muted-foreground mb-4">
          Choose which events should trigger Slack notifications.
        </p>
        <div className="space-y-3">
          {CORE_EVENT_TYPES.map((eventType) => {
            const config = EVENT_TYPE_LABELS[eventType];
            return (
              <div
                key={eventType}
                className="flex items-start gap-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition"
              >
                <Checkbox
                  id={`rule-${eventType}`}
                  checked={enabledRules[eventType] ?? false}
                  onCheckedChange={(checked) =>
                    handleRuleToggle(eventType, checked === true)
                  }
                  disabled={!selectedChannel}
                />
                <div className="flex-1">
                  <label
                    htmlFor={`rule-${eventType}`}
                    className="text-sm font-medium cursor-pointer"
                  >
                    {config.label}
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {config.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        {!selectedChannel && (
          <p className="text-sm text-amber-600 mt-4">
            Please select a channel above to configure notifications.
          </p>
        )}
      </Card>

      {/* Actions */}
      <Card title="Actions">
        <div className="flex flex-wrap gap-4">
          <Button
            variant="outline"
            onClick={handleTestNotification}
            disabled={!selectedChannel || testNotificationMutation.isPending}
          >
            {testNotificationMutation.isPending ? "Sending..." : "Send Test Notification"}
          </Button>
          <Button
            variant="outline"
            onClick={handleAutoLink}
            disabled={autoLinkMutation.isPending}
          >
            {autoLinkMutation.isPending ? "Linking..." : "Auto-Link Users by Email"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Auto-linking matches OmniDial users to Slack users by their email address.
        </p>
      </Card>

      {/* Slash Commands Reference */}
      <Card title="Slash Commands">
        <p className="text-sm text-muted-foreground mb-4">
          Use these commands in Slack to access OmniDial data.
        </p>
        <div className="space-y-2 font-mono text-sm">
          <CommandRow command="/omnidial stats" description="View dashboard analytics" />
          <CommandRow command="/omnidial lead [search]" description="Search for a lead" />
          <CommandRow command="/omnidial leaderboard" description="View rep leaderboard" />
          <CommandRow command="/omnidial calls" description="View recent calls" />
          <CommandRow command="/omnidial help" description="Show all commands" />
        </div>
      </Card>
    </div>
  );
}

function FeatureItem({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <div>
        <p className="font-medium text-sm">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function CommandRow({ command, description }: { command: string; description: string }) {
  return (
    <div className="flex items-center gap-4 py-2 border-b border-border last:border-0">
      <code className="bg-muted px-2 py-1 rounded text-xs min-w-[140px]">{command}</code>
      <span className="text-muted-foreground text-xs">{description}</span>
    </div>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M27.255 80.719c0 7.33-5.978 13.317-13.309 13.317C6.616 94.036.63 88.049.63 80.719c0-7.33 5.986-13.317 13.317-13.317h13.309v13.317zm6.709 0c0-7.33 5.986-13.317 13.317-13.317s13.317 5.986 13.317 13.317v33.335c0 7.33-5.986 13.317-13.317 13.317s-13.317-5.986-13.317-13.317V80.719z" fill="#E01E5A"/>
      <path d="M47.281 27.255c-7.33 0-13.317-5.978-13.317-13.309C33.964 6.616 39.951.63 47.281.63c7.33 0 13.317 5.986 13.317 13.317v13.309H47.281zm0 6.709c7.33 0 13.317 5.986 13.317 13.317s-5.986 13.317-13.317 13.317H13.946C6.616 60.598.63 54.611.63 47.281s5.986-13.317 13.317-13.317h33.335z" fill="#36C5F0"/>
      <path d="M100.745 47.281c0-7.33 5.978-13.317 13.309-13.317 7.33 0 13.317 5.986 13.317 13.317s-5.986 13.317-13.317 13.317h-13.309V47.281zm-6.709 0c0 7.33-5.986 13.317-13.317 13.317s-13.317-5.986-13.317-13.317V13.946C67.402 6.616 73.389.63 80.719.63c7.33 0 13.317 5.986 13.317 13.317v33.335z" fill="#2EB67D"/>
      <path d="M80.719 100.745c7.33 0 13.317 5.978 13.317 13.309 0 7.33-5.986 13.317-13.317 13.317s-13.317-5.986-13.317-13.317v-13.309h13.317zm0-6.709c-7.33 0-13.317-5.986-13.317-13.317s5.986-13.317 13.317-13.317h33.335c7.33 0 13.317 5.986 13.317 13.317s-5.986 13.317-13.317 13.317H80.719z" fill="#ECB22E"/>
    </svg>
  );
}

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
  useNotificationSettings,
  useUpdateNotificationSettings,
  useTestDailySummary,
  useTestRepReminder,
} from "@/hooks/api/useNotificationSettings";
import type { NotificationSettings as NotificationSettingsType } from "@shared/types/src";

// Common timezones for selection
const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central Europe (CET)" },
];

// Time options in 30-minute increments
const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hours = Math.floor(i / 2);
  const minutes = i % 2 === 0 ? "00" : "30";
  const time = `${hours.toString().padStart(2, "0")}:${minutes}`;
  const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const ampm = hours < 12 ? "AM" : "PM";
  return {
    value: time,
    label: `${displayHour}:${minutes} ${ampm}`,
  };
});

export function NotificationSettings() {
  const { data: settings, isLoading, error } = useNotificationSettings();
  const updateMutation = useUpdateNotificationSettings();
  const testDailySummaryMutation = useTestDailySummary();
  const testRepReminderMutation = useTestRepReminder();

  const [localSettings, setLocalSettings] =
    useState<NotificationSettingsType | null>(null);

  // Use settings from server as base, with local overrides during optimistic updates
  const effectiveSettings = localSettings ?? settings ?? null;

  const handleUpdate = (
    updates: Partial<{
      repSessionNotifications: Partial<
        NotificationSettingsType["repSessionNotifications"]
      >;
      dailyPerformanceSummary: Partial<
        NotificationSettingsType["dailyPerformanceSummary"]
      >;
      repReminders: Partial<NotificationSettingsType["repReminders"]>;
    }>
  ) => {
    if (!effectiveSettings) return;

    // Optimistically update local state
    const newSettings = {
      ...effectiveSettings,
      repSessionNotifications: {
        ...effectiveSettings.repSessionNotifications,
        ...updates.repSessionNotifications,
      },
      dailyPerformanceSummary: {
        ...effectiveSettings.dailyPerformanceSummary,
        ...updates.dailyPerformanceSummary,
      },
      repReminders: {
        ...effectiveSettings.repReminders,
        ...updates.repReminders,
      },
    };

    setLocalSettings(newSettings);

    // Send update to server
    updateMutation.mutate(updates, {
      onError: () => {
        // Revert on error
        setLocalSettings(settings || null);
        toast.error("Failed to update settings");
      },
    });
  };

  const handleTestDailySummary = () => {
    testDailySummaryMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      },
      onError: () => {
        toast.error("Failed to send test email");
      },
    });
  };

  const handleTestRepReminder = () => {
    testRepReminderMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.message);
        }
      },
      onError: () => {
        toast.error("Failed to send test email");
      },
    });
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

  if (error || !effectiveSettings) {
    return (
      <div className="space-y-6">
        <Card title="Notification Settings">
          <p className="text-muted-foreground">
            Failed to load notification settings. Please try again.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Rep Session Notifications */}
      <Card title="Rep Session Notifications">
        <p className="text-sm text-muted-foreground mb-4">
          Get notified when your reps start or stop dialing sessions.
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="session-enabled"
              checked={effectiveSettings.repSessionNotifications.enabled}
              onCheckedChange={(checked) =>
                handleUpdate({
                  repSessionNotifications: { enabled: checked === true },
                })
              }
            />
            <label
              htmlFor="session-enabled"
              className="text-sm font-medium cursor-pointer"
            >
              Enable rep session notifications
            </label>
          </div>

          {effectiveSettings.repSessionNotifications.enabled && (
            <div className="pl-7 space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="notify-start"
                  checked={effectiveSettings.repSessionNotifications.notifyOnStart}
                  onCheckedChange={(checked) =>
                    handleUpdate({
                      repSessionNotifications: { notifyOnStart: checked === true },
                    })
                  }
                />
                <label
                  htmlFor="notify-start"
                  className="text-sm cursor-pointer"
                >
                  Notify when rep starts dialing
                </label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="notify-stop"
                  checked={effectiveSettings.repSessionNotifications.notifyOnStop}
                  onCheckedChange={(checked) =>
                    handleUpdate({
                      repSessionNotifications: { notifyOnStop: checked === true },
                    })
                  }
                />
                <label htmlFor="notify-stop" className="text-sm cursor-pointer">
                  Notify when rep stops dialing
                </label>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Daily Performance Summary */}
      <Card title="Daily Performance Summary">
        <p className="text-sm text-muted-foreground mb-4">
          Receive a daily email with your team&apos;s performance metrics and
          coaching insights.
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="daily-enabled"
              checked={effectiveSettings.dailyPerformanceSummary.enabled}
              onCheckedChange={(checked) =>
                handleUpdate({
                  dailyPerformanceSummary: { enabled: checked === true },
                })
              }
            />
            <label
              htmlFor="daily-enabled"
              className="text-sm font-medium cursor-pointer"
            >
              Enable daily performance summary
            </label>
          </div>

          {effectiveSettings.dailyPerformanceSummary.enabled && (
            <div className="pl-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Send Time
                  </label>
                  <Select
                    value={effectiveSettings.dailyPerformanceSummary.sendTime}
                    onValueChange={(value) =>
                      handleUpdate({
                        dailyPerformanceSummary: { sendTime: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Timezone
                  </label>
                  <Select
                    value={effectiveSettings.dailyPerformanceSummary.timezone}
                    onValueChange={(value) =>
                      handleUpdate({
                        dailyPerformanceSummary: { timezone: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="include-coaching"
                  checked={
                    effectiveSettings.dailyPerformanceSummary.includeCoachingSummary
                  }
                  onCheckedChange={(checked) =>
                    handleUpdate({
                      dailyPerformanceSummary: {
                        includeCoachingSummary: checked === true,
                      },
                    })
                  }
                />
                <label
                  htmlFor="include-coaching"
                  className="text-sm cursor-pointer"
                >
                  Include coaching summary
                </label>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestDailySummary}
                  disabled={testDailySummaryMutation.isPending}
                >
                  {testDailySummaryMutation.isPending
                    ? "Sending..."
                    : "Send Test Email"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Rep Daily Reminders */}
      <Card title="Rep Daily Reminders">
        <p className="text-sm text-muted-foreground mb-4">
          Send morning emails to your reps with their follow-ups and campaign
          schedules.
        </p>
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <Checkbox
              id="reminders-enabled"
              checked={effectiveSettings.repReminders.enabled}
              onCheckedChange={(checked) =>
                handleUpdate({
                  repReminders: { enabled: checked === true },
                })
              }
            />
            <label
              htmlFor="reminders-enabled"
              className="text-sm font-medium cursor-pointer"
            >
              Enable rep daily reminders
            </label>
          </div>

          {effectiveSettings.repReminders.enabled && (
            <div className="pl-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Send Time
                  </label>
                  <Select
                    value={effectiveSettings.repReminders.sendTime}
                    onValueChange={(value) =>
                      handleUpdate({
                        repReminders: { sendTime: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Timezone
                  </label>
                  <Select
                    value={effectiveSettings.repReminders.timezone}
                    onValueChange={(value) =>
                      handleUpdate({
                        repReminders: { timezone: value },
                      })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-followups"
                    checked={effectiveSettings.repReminders.includeFollowUps}
                    onCheckedChange={(checked) =>
                      handleUpdate({
                        repReminders: { includeFollowUps: checked === true },
                      })
                    }
                  />
                  <label
                    htmlFor="include-followups"
                    className="text-sm cursor-pointer"
                  >
                    Include follow-up reminders
                  </label>
                </div>
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="include-campaign"
                    checked={effectiveSettings.repReminders.includeCampaignSchedule}
                    onCheckedChange={(checked) =>
                      handleUpdate({
                        repReminders: {
                          includeCampaignSchedule: checked === true,
                        },
                      })
                    }
                  />
                  <label
                    htmlFor="include-campaign"
                    className="text-sm cursor-pointer"
                  >
                    Include campaign schedule
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestRepReminder}
                  disabled={testRepReminderMutation.isPending}
                >
                  {testRepReminderMutation.isPending
                    ? "Sending..."
                    : "Send Test Email"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

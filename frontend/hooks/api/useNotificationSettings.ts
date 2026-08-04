"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, patch } from "@/lib/api";
import { ENDPOINTS, QUERY_KEYS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  NotificationSettings,
  UpdateNotificationSettingsRequest,
} from "@shared/types/src";

export const useNotificationSettings = () => {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.notificationSettings(orgId),
    queryFn: async (): Promise<NotificationSettings> => {
      return get<NotificationSettings>(ENDPOINTS.NOTIFICATION_SETTINGS.GET);
    },
    enabled: !!orgId,
  });
};

export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (
      updates: UpdateNotificationSettingsRequest
    ): Promise<NotificationSettings> => {
      return patch<NotificationSettings>(
        ENDPOINTS.NOTIFICATION_SETTINGS.UPDATE,
        updates
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notificationSettings(orgId),
      });
    },
  });
};

export const useTestDailySummary = () => {
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      return post<{ success: boolean; message: string }>(
        ENDPOINTS.NOTIFICATION_SETTINGS.TEST_DAILY_SUMMARY
      );
    },
  });
};

export const useTestRepReminder = () => {
  return useMutation({
    mutationFn: async (): Promise<{ success: boolean; message: string }> => {
      return post<{ success: boolean; message: string }>(
        ENDPOINTS.NOTIFICATION_SETTINGS.TEST_REP_REMINDER
      );
    },
  });
};

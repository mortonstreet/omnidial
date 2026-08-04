"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, put } from "@/lib/api";
import { ENDPOINTS, QUERY_KEYS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  SlackStatusResponse,
  SlackChannelsResponse,
  SlackSuccessResponse,
  SlackAutoLinkResponse,
  SlackNotificationRulesResponse,
  UpdateSlackNotificationRulesRequest,
  TestSlackNotificationRequest,
} from "@shared/types/src";

export const useSlackStatus = () => {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.slackStatus(orgId),
    queryFn: async (): Promise<SlackStatusResponse> => {
      return get<SlackStatusResponse>(ENDPOINTS.SLACK.STATUS);
    },
    enabled: !!orgId,
  });
};

export const useSlackChannels = () => {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.slackChannels(orgId),
    queryFn: async (): Promise<SlackChannelsResponse> => {
      return get<SlackChannelsResponse>(ENDPOINTS.SLACK.CHANNELS);
    },
    enabled: !!orgId,
  });
};

export const useDisconnectSlack = () => {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (): Promise<SlackSuccessResponse> => {
      return post<SlackSuccessResponse>(ENDPOINTS.SLACK.DISCONNECT);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.slackStatus(orgId),
      });
    },
  });
};

export const useUpdateSlackNotificationRules = () => {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (
      data: UpdateSlackNotificationRulesRequest
    ): Promise<SlackNotificationRulesResponse> => {
      return put<SlackNotificationRulesResponse>(
        ENDPOINTS.SLACK.NOTIFICATION_RULES,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.slackStatus(orgId),
      });
    },
  });
};

export const useAutoLinkSlackUsers = () => {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (): Promise<SlackAutoLinkResponse> => {
      return post<SlackAutoLinkResponse>(ENDPOINTS.SLACK.AUTO_LINK);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.slackStatus(orgId),
      });
    },
  });
};

export const useTestSlackNotification = () => {
  return useMutation({
    mutationFn: async (
      data: TestSlackNotificationRequest
    ): Promise<SlackSuccessResponse> => {
      return post<SlackSuccessResponse>(ENDPOINTS.SLACK.TEST_NOTIFICATION, data);
    },
  });
};

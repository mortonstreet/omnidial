"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useActiveOrganization } from "@/lib/auth-client";
import { ENDPOINTS, QUERY_KEYS } from "@/lib/config";
import { get, post } from "@/lib/api";
import { ActiveDialerSessionResponse, ActiveSessionsListResponse } from "@shared/types/src";

interface SessionResponse {
  data: ActiveDialerSessionResponse;
}

// Hook to get active sessions for the organization (managers only)
export function useActiveSessions() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.activeSessions(orgId),
    queryFn: async () => {
      if (!orgId) return { data: [] };
      const response = await get<ActiveSessionsListResponse>(
        ENDPOINTS.DIALER.ACTIVE_SESSIONS(orgId)
      );
      return response;
    },
    enabled: !!orgId,
    refetchInterval: 10000, // Poll every 10 seconds for live updates
  });
}

// Hook to get the current user's active session
export function useMySession() {
  return useQuery({
    queryKey: QUERY_KEYS.mySession(),
    queryFn: async () => {
      const response = await get<SessionResponse>(ENDPOINTS.DIALER.MY_SESSION);
      return response;
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

// Hook to start a dialer session
export function useStartSession() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (data: { campaignId?: string; listId?: string }) => {
      if (!orgId) throw new Error("No active organization");
      return post<SessionResponse>(ENDPOINTS.DIALER.SESSIONS, {
        organizationId: orgId,
        ...data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mySession() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.activeSessions(orgId) });
    },
  });
}

// Hook to end a dialer session
export function useEndSession() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return post<SessionResponse>(ENDPOINTS.DIALER.SESSION_END(sessionId), {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.mySession() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.activeSessions(orgId) });
    },
  });
}

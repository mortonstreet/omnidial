"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  SalesFloorStatusResponse,
  LeaderboardResponse,
  BlitzResponse,
  BlitzListResponse,
  ManagerListenSessionResponse,
} from "@shared/types/src";

// Get sales floor status
export function useSalesFloorStatus(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.salesFloorStatus(orgId),
    queryFn: async () => {
      return await get<SalesFloorStatusResponse>(ENDPOINTS.SALES_FLOOR.STATUS);
    },
    enabled: enabled && !!orgId,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });
}

export type LeaderboardPeriod = "today" | "week" | "month" | "90d" | "all";

interface LeaderboardFilters {
  period?: LeaderboardPeriod;
  metricType?: "calls" | "connections" | "talk_time" | "conversions";
}

// Get leaderboard
export function useSalesFloorLeaderboard(filters?: LeaderboardFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.salesFloorLeaderboard(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.period) params.set("period", filters.period);
      if (filters?.metricType) params.set("metric", filters.metricType === "connections" ? "connects" : filters.metricType === "talk_time" ? "talkTime" : "calls");

      const url = `${ENDPOINTS.SALES_FLOOR.LEADERBOARD}?${params.toString()}`;
      return await get<LeaderboardResponse>(url);
    },
    enabled: enabled && !!orgId,
    refetchInterval: 10000, // Refresh every 10 seconds
  });
}

// === Blitz Management ===

// List blitzes
export function useBlitzes(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.blitzes(orgId),
    queryFn: async () => {
      return await get<BlitzListResponse>(ENDPOINTS.SALES_FLOOR.BLITZ_LIST);
    },
    enabled: enabled && !!orgId,
  });
}

// Get single blitz
export function useBlitz(blitzId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.blitz(blitzId),
    queryFn: async () => {
      return await get<BlitzResponse>(ENDPOINTS.SALES_FLOOR.BLITZ_GET(blitzId));
    },
    enabled: enabled && !!blitzId,
    refetchInterval: 5000, // Real-time updates during active blitz
  });
}

// Create blitz
export function useCreateBlitz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      durationMinutes: number;
      goalType: "calls" | "connects" | "meetings";
      goalTarget?: number;
    }) => {
      // Calculate startAt and endAt from duration
      const startAt = new Date();
      const endAt = new Date(startAt.getTime() + params.durationMinutes * 60 * 1000);

      const payload = {
        name: params.name,
        description: params.description,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        goalType: params.goalType,
        goalTarget: params.goalTarget,
      };

      return await post<BlitzResponse>(ENDPOINTS.SALES_FLOOR.BLITZ_CREATE, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-floor", "blitzes"] });
    },
  });
}

// Start blitz
export function useStartBlitz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blitzId: string) => {
      return await post<BlitzResponse>(ENDPOINTS.SALES_FLOOR.BLITZ_START(blitzId));
    },
    onSuccess: (_, blitzId) => {
      queryClient.invalidateQueries({ queryKey: ["sales-floor", "blitzes"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.blitz(blitzId) });
    },
  });
}

// End blitz
export function useEndBlitz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blitzId: string) => {
      return await post<BlitzResponse>(ENDPOINTS.SALES_FLOOR.BLITZ_END(blitzId));
    },
    onSuccess: (_, blitzId) => {
      queryClient.invalidateQueries({ queryKey: ["sales-floor", "blitzes"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.blitz(blitzId) });
    },
  });
}

// Join blitz
export function useJoinBlitz() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (blitzId: string) => {
      return await post<{ success: boolean }>(ENDPOINTS.SALES_FLOOR.BLITZ_JOIN(blitzId));
    },
    onSuccess: (_, blitzId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.blitz(blitzId) });
    },
  });
}

// === Manager Listen/Whisper/Barge ===

// Start listen session
export function useStartListenSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { callId: string; mode: "listen" | "whisper" | "barge" }) => {
      return await post<ManagerListenSessionResponse>(ENDPOINTS.SALES_FLOOR.LISTEN_START, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-floor", "status"] });
    },
  });
}

// End listen session
export function useEndListenSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      return await post<{ success: boolean }>(ENDPOINTS.SALES_FLOOR.LISTEN_END(sessionId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-floor", "status"] });
    },
  });
}

// Change listen mode
export function useChangeListenMode() {
  return useMutation({
    mutationFn: async ({
      sessionId,
      mode,
    }: {
      sessionId: string;
      mode: "listen" | "whisper" | "barge";
    }) => {
      return await post<ManagerListenSessionResponse>(
        ENDPOINTS.SALES_FLOOR.LISTEN_MODE(sessionId),
        { mode }
      );
    },
  });
}

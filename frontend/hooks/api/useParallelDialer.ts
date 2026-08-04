"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  ParallelDialSessionResponse,
  ParallelDialAttemptResponse,
  AbandonedCallsReportResponse,
} from "@shared/types/src";

// Get a parallel dial session
export function useParallelDialSession(sessionId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.parallelDialerSession(sessionId),
    queryFn: async () => {
      if (!sessionId) return null;
      return await get<ParallelDialSessionResponse & { currentAttempts?: ParallelDialAttemptResponse[] }>(
        ENDPOINTS.PARALLEL_DIALER.SESSION(sessionId)
      );
    },
    enabled: !!sessionId,
    refetchInterval: 3000, // Poll every 3 seconds for updates
  });
}

// Start a parallel dial session
export function useStartParallelDialSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      campaignId?: string;
      listId?: string;
      lineCount: number;
    }) => {
      const response = await post<ParallelDialSessionResponse>(
        ENDPOINTS.PARALLEL_DIALER.SESSIONS,
        params
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parallel-dialer"] });
      queryClient.invalidateQueries({ queryKey: ["dialer", "sessions"] });
    },
  });
}

// End a parallel dial session
export function useEndParallelDialSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await post<ParallelDialSessionResponse>(
        ENDPOINTS.PARALLEL_DIALER.SESSION_END(sessionId)
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parallel-dialer"] });
      queryClient.invalidateQueries({ queryKey: ["dialer", "sessions"] });
    },
  });
}

// Dial next batch of leads
export function useDialNextBatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { sessionId: string; fromNumber: string }) => {
      const response = await post<{ attempts: ParallelDialAttemptResponse[] }>(
        ENDPOINTS.PARALLEL_DIALER.SESSION_DIAL(params.sessionId),
        { fromNumber: params.fromNumber }
      );
      return response;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.parallelDialerSession(variables.sessionId),
      });
    },
  });
}

// Pause a parallel dial session
export function usePauseParallelDialSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await post<ParallelDialSessionResponse>(
        ENDPOINTS.PARALLEL_DIALER.SESSION_PAUSE(sessionId)
      );
      return response;
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.parallelDialerSession(sessionId),
      });
    },
  });
}

// Resume a parallel dial session
export function useResumeParallelDialSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await post<ParallelDialSessionResponse>(
        ENDPOINTS.PARALLEL_DIALER.SESSION_RESUME(sessionId)
      );
      return response;
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.parallelDialerSession(sessionId),
      });
    },
  });
}

// Join parallel dial conference (get conference ID for browser SDK)
export function useJoinParallelDialConference() {
  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await post<{ conferenceId: string; sessionId: string }>(
        ENDPOINTS.PARALLEL_DIALER.SESSION_JOIN(sessionId)
      );
      return response;
    },
  });
}

interface AbandonedCallsFilters {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

// Get abandoned calls for compliance reporting
export function useAbandonedCalls(filters?: AbandonedCallsFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.abandonedCalls(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const url = `${ENDPOINTS.PARALLEL_DIALER.ABANDONED_CALLS}?${params.toString()}`;
      return await get<AbandonedCallsReportResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

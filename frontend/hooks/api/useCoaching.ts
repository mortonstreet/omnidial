"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import type {
  CoachingEligibilityResponse,
  GetCoachingResponse,
  GenerateCoachingResponse,
  UserCoachingHistoryResponse,
  RecentCoachingResponse,
  CoachingStatsResponse,
  UncoachedCallsResponse,
  LeadCoachingResponse,
} from "@shared/types/src/requests/coaching";
import { useActiveOrganization, useSession } from "@/lib/auth-client";

// Check if a call is eligible for coaching
export function useCoachingEligibility(callId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.coachingEligibility(callId),
    queryFn: async () => {
      const response = await get<CoachingEligibilityResponse>(
        ENDPOINTS.COACHING.ELIGIBILITY(callId)
      );
      return response.data;
    },
    enabled: enabled && !!callId,
  });
}

// Get coaching for a specific call
export function useCallCoaching(callId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.callCoaching(callId),
    queryFn: async () => {
      const response = await get<GetCoachingResponse>(
        ENDPOINTS.COACHING.GET(callId)
      );
      return response.data;
    },
    enabled: enabled && !!callId,
    retry: false, // Don't retry if coaching doesn't exist
  });
}

// Generate coaching for a call
export function useGenerateCoaching() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const response = await post<GenerateCoachingResponse>(
        ENDPOINTS.COACHING.GENERATE(callId),
        {}
      );
      return response.data;
    },
    onSuccess: (data) => {
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.callCoaching(data.coaching.callId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.coachingEligibility(data.coaching.callId),
      });
      queryClient.invalidateQueries({ queryKey: ["coaching", "recent"] });
      queryClient.invalidateQueries({ queryKey: ["coaching", "history"] });
      queryClient.invalidateQueries({ queryKey: ["coaching", "stats"] });
    },
  });
}

// Get user's coaching history
interface CoachingHistoryFilters {
  limit?: number;
  offset?: number;
}

export function useCoachingHistory(filters?: CoachingHistoryFilters, enabled = true) {
  const { data: session } = useSession();
  const userId = session?.user?.id;

  return useQuery({
    queryKey: QUERY_KEYS.coachingHistory(userId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.offset) params.set("offset", filters.offset.toString());

      const url = `${ENDPOINTS.COACHING.HISTORY}?${params.toString()}`;
      const response = await get<UserCoachingHistoryResponse>(url);
      return response.data;
    },
    enabled: enabled && !!userId,
  });
}

// Get recent coaching for the organization
interface RecentCoachingFilters {
  limit?: number;
  offset?: number;
  minScore?: number;
  maxScore?: number;
}

export function useRecentCoaching(filters?: RecentCoachingFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.coachingRecent(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.offset) params.set("offset", filters.offset.toString());
      if (filters?.minScore !== undefined) params.set("minScore", filters.minScore.toString());
      if (filters?.maxScore !== undefined) params.set("maxScore", filters.maxScore.toString());

      const url = `${ENDPOINTS.COACHING.RECENT}?${params.toString()}`;
      const response = await get<RecentCoachingResponse>(url);
      return response.data;
    },
    enabled: enabled && !!orgId,
  });
}

// Get coaching stats
export function useCoachingStats(userId?: string, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.coachingStats(orgId, userId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);

      const url = `${ENDPOINTS.COACHING.STATS}?${params.toString()}`;
      const response = await get<CoachingStatsResponse>(url);
      return response.data;
    },
    enabled: enabled && !!orgId,
  });
}

// Get uncoached eligible calls
interface UncoachedCallsFilters {
  limit?: number;
  offset?: number;
}

export function useUncoachedCalls(filters?: UncoachedCallsFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.uncoachedCalls(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.offset) params.set("offset", filters.offset.toString());

      const url = `${ENDPOINTS.COACHING.UNCOACHED}?${params.toString()}`;
      const response = await get<UncoachedCallsResponse>(url);
      return response.data;
    },
    enabled: enabled && !!orgId,
  });
}

// Get coaching for a specific lead
interface LeadCoachingFilters {
  limit?: number;
  offset?: number;
  minScore?: number;
  maxScore?: number;
}

export function useLeadCoaching(leadId: string, filters?: LeadCoachingFilters, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.leadCoaching(leadId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.offset) params.set("offset", filters.offset.toString());
      if (filters?.minScore !== undefined) params.set("minScore", filters.minScore.toString());
      if (filters?.maxScore !== undefined) params.set("maxScore", filters.maxScore.toString());

      const url = `${ENDPOINTS.COACHING.BY_LEAD(leadId)}?${params.toString()}`;
      const response = await get<LeadCoachingResponse>(url);
      return response.data;
    },
    enabled: enabled && !!leadId,
  });
}

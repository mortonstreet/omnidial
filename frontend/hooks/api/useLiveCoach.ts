"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, patch, del } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  CoachCardResponse,
  CoachCardListResponse,
  LiveTranscriptResponse,
  TriggerStatsResponse,
} from "@shared/types/src";

interface CoachCardFilters {
  category?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// List coach cards
export function useCoachCards(filters?: CoachCardFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.coachCards(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.set("category", filters.category);
      if (filters?.isActive !== undefined) params.set("isActive", filters.isActive.toString());
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const url = `${ENDPOINTS.LIVE_COACH.CARDS}?${params.toString()}`;
      return await get<CoachCardListResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

// Get single coach card
export function useCoachCard(cardId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.coachCard(cardId),
    queryFn: async () => {
      return await get<CoachCardResponse>(ENDPOINTS.LIVE_COACH.CARD(cardId));
    },
    enabled: enabled && !!cardId,
  });
}

// Create coach card
export function useCreateCoachCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      title: string;
      category: "objection" | "question" | "closing" | "discovery" | "general";
      triggerPhrases: string[];
      content: string;
      tips?: string[];
      sortOrder?: number;
    }) => {
      return await post<CoachCardResponse>(ENDPOINTS.LIVE_COACH.CARDS, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-coach", "cards"] });
    },
  });
}

// Update coach card
export function useUpdateCoachCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      title?: string;
      category?: "objection" | "question" | "closing" | "discovery" | "general";
      triggerPhrases?: string[];
      content?: string;
      tips?: string[];
      isActive?: boolean;
      sortOrder?: number;
    }) => {
      return await patch<CoachCardResponse>(ENDPOINTS.LIVE_COACH.CARD(id), data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["live-coach", "cards"] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.coachCard(variables.id) });
    },
  });
}

// Delete coach card
export function useDeleteCoachCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cardId: string) => {
      await del(ENDPOINTS.LIVE_COACH.CARD(cardId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["live-coach", "cards"] });
    },
  });
}

// Get live transcript
export function useLiveTranscript(callId: string, afterMs?: number, enabled = true) {
  return useQuery({
    queryKey: [...QUERY_KEYS.liveTranscript(callId), afterMs],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (afterMs !== undefined) params.set("afterMs", afterMs.toString());

      const url = `${ENDPOINTS.LIVE_COACH.TRANSCRIPT(callId)}?${params.toString()}`;
      return await get<LiveTranscriptResponse>(url);
    },
    enabled: enabled && !!callId,
    refetchInterval: 1000, // Poll every second for live updates
  });
}

// Submit trigger feedback
export function useSubmitTriggerFeedback() {
  return useMutation({
    mutationFn: async ({
      triggerId,
      wasHelpful,
    }: {
      triggerId: string;
      wasHelpful: boolean;
    }) => {
      return await post<{ success: boolean }>(
        ENDPOINTS.LIVE_COACH.TRIGGER_FEEDBACK(triggerId),
        { wasHelpful }
      );
    },
  });
}

interface TriggerStatsFilters {
  coachCardId?: string;
  startDate?: string;
  endDate?: string;
}

// Get trigger stats
export function useTriggerStats(filters?: TriggerStatsFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.triggerStats(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.coachCardId) params.set("coachCardId", filters.coachCardId);
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);

      const url = `${ENDPOINTS.LIVE_COACH.TRIGGER_STATS}?${params.toString()}`;
      return await get<TriggerStatsResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

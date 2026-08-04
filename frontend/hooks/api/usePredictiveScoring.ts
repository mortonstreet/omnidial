"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  CalculateScoresResponse,
  ReorderResponse,
  LeadPredictiveScoreResponse,
  CallAnswerPatternsResponse,
  PhoneTypeDetectionResponse,
} from "@shared/types/src";

// Calculate predictive scores for a list
export function useCalculatePredictiveScores() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (listId: string) => {
      const response = await post<CalculateScoresResponse>(
        ENDPOINTS.PREDICTIVE_SCORING.CALCULATE(listId)
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictive-scoring"] });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["list"] });
    },
  });
}

// Reorder campaign leads by score
export function useReorderByScore() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      campaignId,
      listId,
    }: {
      campaignId: string;
      listId: string;
    }) => {
      const response = await post<ReorderResponse>(
        ENDPOINTS.PREDICTIVE_SCORING.REORDER(campaignId, listId)
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign"] });
      queryClient.invalidateQueries({ queryKey: ["power-dialer"] });
    },
  });
}

// Get score for a single lead
export function useLeadPredictiveScore(leadId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.leadPredictiveScore(leadId),
    queryFn: async () => {
      return await get<LeadPredictiveScoreResponse>(
        ENDPOINTS.PREDICTIVE_SCORING.LEAD_SCORE(leadId)
      );
    },
    enabled: enabled && !!leadId,
  });
}

// Get call answer patterns for the organization
export function useCallAnswerPatterns(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.predictiveScorePatterns(orgId),
    queryFn: async () => {
      return await get<CallAnswerPatternsResponse>(ENDPOINTS.PREDICTIVE_SCORING.PATTERNS);
    },
    enabled: enabled && !!orgId,
  });
}

// Detect phone type for a number
export function useDetectPhoneType() {
  return useMutation({
    mutationFn: async (phoneNumber: string) => {
      const params = new URLSearchParams({ phoneNumber });
      return await get<PhoneTypeDetectionResponse>(
        `${ENDPOINTS.PREDICTIVE_SCORING.PHONE_TYPE}?${params.toString()}`
      );
    },
  });
}

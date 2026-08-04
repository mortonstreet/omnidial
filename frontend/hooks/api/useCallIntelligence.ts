"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import type {
  IntelligenceEligibilityResponse,
  GetIntelligenceResponse,
  GenerateIntelligenceResponse,
  LeadIntelligenceResponse,
} from "@shared/types/src/requests/callIntelligence";

// Check if a call is eligible for intelligence extraction
export function useIntelligenceEligibility(callId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.intelligenceEligibility(callId),
    queryFn: async () => {
      const response = await get<IntelligenceEligibilityResponse>(
        ENDPOINTS.CALL_INTELLIGENCE.ELIGIBILITY(callId)
      );
      return response.data;
    },
    enabled: enabled && !!callId,
  });
}

// Get intelligence for a specific call
export function useCallIntelligence(callId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.callIntelligence(callId),
    queryFn: async () => {
      const response = await get<GetIntelligenceResponse>(
        ENDPOINTS.CALL_INTELLIGENCE.GET(callId)
      );
      return response.data;
    },
    enabled: enabled && !!callId,
    retry: false,
  });
}

// Generate intelligence for a call
export function useGenerateIntelligence() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (callId: string) => {
      const response = await post<GenerateIntelligenceResponse>(
        ENDPOINTS.CALL_INTELLIGENCE.GENERATE(callId),
        {}
      );
      return response.data;
    },
    onSuccess: (data) => {
      const callId = data.intelligence.callId;
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.callIntelligence(callId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.intelligenceEligibility(callId),
      });
      // Invalidate lead intelligence if this call has a lead
      if (data.intelligence.leadId) {
        queryClient.invalidateQueries({
          queryKey: ['intelligence', 'lead'],
        });
      }
    },
  });
}

// Get intelligence for a specific lead
export function useLeadIntelligence(leadId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.leadIntelligence(leadId),
    queryFn: async () => {
      const response = await get<LeadIntelligenceResponse>(
        ENDPOINTS.CALL_INTELLIGENCE.BY_LEAD(leadId)
      );
      return response.data;
    },
    enabled: enabled && !!leadId,
  });
}

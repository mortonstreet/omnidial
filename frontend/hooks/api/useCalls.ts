"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, patch, del } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import type {
  CallListResponse,
  CallResponse,
  VoicemailDropListResponse,
  DispositionListResponse,
  SuggestDispositionResponse,
} from "@shared/types/src";
import { useActiveOrganization } from "@/lib/auth-client";

interface CallFilters {
  page?: number;
  limit?: number;
  direction?: "inbound" | "outbound";
  status?: string;
  leadId?: string;
  campaignId?: string;
  userId?: string;
  dispositionId?: string; // UUID or 'null' string for calls without disposition
  startDate?: string;
  endDate?: string;
}

// List calls
export function useCalls(filters?: CallFilters, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.calls(filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.direction) params.set("direction", filters.direction);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.leadId) params.set("leadId", filters.leadId);
      if (filters?.campaignId) params.set("campaignId", filters.campaignId);
      if (filters?.userId) params.set("userId", filters.userId);
      if (filters?.dispositionId) params.set("dispositionId", filters.dispositionId);
      if (filters?.startDate) params.set("startDate", filters.startDate);
      if (filters?.endDate) params.set("endDate", filters.endDate);

      const url = `${ENDPOINTS.CALLS.LIST}?${params.toString()}`;
      return await get<CallListResponse>(url);
    },
    enabled,
  });
}

// List inbound calls only
export function useInboundCalls(enabled = true) {
  return useCalls({ direction: "inbound", limit: 50 }, enabled);
}

// Get single call
export function useCall(callId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.call(callId),
    queryFn: async () => {
      const response = await get<{ data: CallResponse }>(ENDPOINTS.CALLS.GET(callId));
      return response.data;
    },
    enabled: !!callId,
  });
}

// Set call disposition
export function useSetCallDisposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callId, dispositionId }: { callId: string; dispositionId: string }) => {
      const response = await patch<{ data: CallResponse }>(
        ENDPOINTS.CALLS.SET_DISPOSITION(callId),
        { dispositionId }
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.call(data.id) });
      // Also invalidate lead calls to refresh call history in lead views
      queryClient.invalidateQueries({ queryKey: ['lead'] });
    },
  });
}

// Drop voicemail
export function useDropVoicemail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ callId, voicemailDropId }: { callId: string; voicemailDropId: string }) => {
      const response = await post<{ data: CallResponse }>(
        ENDPOINTS.CALLS.DROP_VOICEMAIL(callId),
        { voicemailDropId }
      );
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.call(data.id) });
    },
  });
}

// List voicemail drops
export function useVoicemailDrops(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.voicemailDrops(),
    queryFn: async () => {
      return await get<VoicemailDropListResponse>(ENDPOINTS.VOICEMAIL_DROPS.LIST);
    },
    enabled,
  });
}

// Create voicemail drop
export function useCreateVoicemailDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { name: string; recordingUrl: string; duration: number }) => {
      const response = await post<{ data: unknown }>(ENDPOINTS.VOICEMAIL_DROPS.CREATE, params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.voicemailDrops() });
    },
  });
}

// Delete voicemail drop
export function useDeleteVoicemailDrop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await del(ENDPOINTS.VOICEMAIL_DROPS.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.voicemailDrops() });
    },
  });
}

// List dispositions
export function useDispositions(enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.dispositions(),
    queryFn: async () => {
      return await get<DispositionListResponse>(ENDPOINTS.DISPOSITIONS.LIST);
    },
    enabled,
  });
}

// Create disposition
export function useCreateDisposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      label: string;
      color?: string;
      sortOrder?: number;
      isDefault?: boolean;
    }) => {
      const response = await post<{ data: unknown }>(ENDPOINTS.DISPOSITIONS.CREATE, params);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dispositions() });
    },
  });
}

// Update disposition
export function useUpdateDisposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      label?: string;
      color?: string;
      sortOrder?: number;
      isDefault?: boolean;
    }) => {
      const response = await patch<{ data: unknown }>(ENDPOINTS.DISPOSITIONS.UPDATE(id), data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dispositions() });
    },
  });
}

// Delete disposition
export function useDeleteDisposition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await del(ENDPOINTS.DISPOSITIONS.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dispositions() });
    },
  });
}

// Get AI-powered disposition suggestions for a call
export function useSuggestDisposition() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async ({ callId, transcript }: { callId: string; transcript?: string }) => {
      const response = await post<{ data: SuggestDispositionResponse }>(
        ENDPOINTS.CALLS.SUGGEST_DISPOSITION(callId),
        {
          organizationId: orgId,
          transcript,
        }
      );
      return response.data;
    },
  });
}

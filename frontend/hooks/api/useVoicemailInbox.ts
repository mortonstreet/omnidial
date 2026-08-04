"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import type {
  VoicemailGreetingResponse,
  VoicemailInboxResponse,
} from "@shared/types/src";

// === Voicemail Greeting Hooks ===

export function useVoicemailGreetings() {
  return useQuery({
    queryKey: QUERY_KEYS.voicemailGreetings(),
    queryFn: async () => {
      const response = await get<{
        data: VoicemailGreetingResponse[];
        total: number;
      }>(ENDPOINTS.VOICEMAIL_GREETINGS.LIST);
      return response;
    },
  });
}

export function useCreateVoicemailGreeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      name: string;
      recordingUrl: string;
      duration: number;
      recordingSid?: string;
    }) => {
      const response = await post<{ data: VoicemailGreetingResponse }>(
        ENDPOINTS.VOICEMAIL_GREETINGS.CREATE,
        data
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.voicemailGreetings(),
      });
    },
  });
}

export function useActivateVoicemailGreeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await post<{ data: VoicemailGreetingResponse }>(
        ENDPOINTS.VOICEMAIL_GREETINGS.ACTIVATE(id)
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.voicemailGreetings(),
      });
    },
  });
}

export function useDeleteVoicemailGreeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await del(ENDPOINTS.VOICEMAIL_GREETINGS.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.voicemailGreetings(),
      });
    },
  });
}

// === Voicemail Inbox Hooks ===

interface VoicemailInboxFilters {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

export function useVoicemailInbox(filters?: VoicemailInboxFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.voicemailInbox(filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());
      if (filters?.unreadOnly) params.set("unreadOnly", "true");

      const url = `${ENDPOINTS.VOICEMAIL_INBOX.LIST}?${params.toString()}`;
      return await get<VoicemailInboxResponse>(url);
    },
    refetchInterval: 30000, // Poll every 30 seconds
  });
}

export function useMarkVoicemailRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await post(ENDPOINTS.VOICEMAIL_INBOX.MARK_READ(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.voicemailInbox(),
      });
    },
  });
}

export function useMarkAllVoicemailsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await post(ENDPOINTS.VOICEMAIL_INBOX.MARK_ALL_READ);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.voicemailInbox(),
      });
    },
  });
}

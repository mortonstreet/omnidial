import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";
import { ENDPOINTS, QUERY_KEYS } from "@/lib/config";
import type {
  GetAdminCallsResponse,
  GetAdminCallDetailResponse,
  GetAdminRecordingsResponse,
  GetAdminTranscriptionsResponse,
  GetAdminTranscriptionDetailResponse,
  GetAdminActivityResponse,
} from "@shared/types/src";

export interface UseAdminCallsParams {
  page?: number;
  limit?: number;
  status?: string;
  direction?: string;
  organizationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useAdminCalls(params: UseAdminCallsParams = {}) {
  const { page = 1, limit = 20, ...filters } = params;

  return useQuery({
    queryKey: QUERY_KEYS.adminLogsCalls({ page, limit, ...filters }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      if (filters.status) searchParams.set("status", filters.status);
      if (filters.direction) searchParams.set("direction", filters.direction);
      if (filters.organizationId) searchParams.set("organizationId", filters.organizationId);
      if (filters.userId) searchParams.set("userId", filters.userId);
      if (filters.startDate) searchParams.set("startDate", filters.startDate);
      if (filters.endDate) searchParams.set("endDate", filters.endDate);
      if (filters.search) searchParams.set("search", filters.search);

      return get<GetAdminCallsResponse>(`${ENDPOINTS.ADMIN.LOGS_CALLS}?${searchParams.toString()}`);
    },
  });
}

export function useAdminCallDetail(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminLogsCallDetail(id ?? undefined),
    queryFn: async () => {
      if (!id) return null;
      return get<GetAdminCallDetailResponse>(ENDPOINTS.ADMIN.LOGS_CALL_DETAIL(id));
    },
    enabled: !!id,
  });
}

export interface UseAdminRecordingsParams {
  page?: number;
  limit?: number;
  status?: string;
  organizationId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useAdminRecordings(params: UseAdminRecordingsParams = {}) {
  const { page = 1, limit = 20, ...filters } = params;

  return useQuery({
    queryKey: QUERY_KEYS.adminLogsRecordings({ page, limit, ...filters }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      if (filters.status) searchParams.set("status", filters.status);
      if (filters.organizationId) searchParams.set("organizationId", filters.organizationId);
      if (filters.userId) searchParams.set("userId", filters.userId);
      if (filters.startDate) searchParams.set("startDate", filters.startDate);
      if (filters.endDate) searchParams.set("endDate", filters.endDate);
      if (filters.search) searchParams.set("search", filters.search);

      return get<GetAdminRecordingsResponse>(`${ENDPOINTS.ADMIN.LOGS_RECORDINGS}?${searchParams.toString()}`);
    },
  });
}

export interface UseAdminTranscriptionsParams {
  page?: number;
  limit?: number;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useAdminTranscriptions(params: UseAdminTranscriptionsParams = {}) {
  const { page = 1, limit = 20, ...filters } = params;

  return useQuery({
    queryKey: QUERY_KEYS.adminLogsTranscriptions({ page, limit, ...filters }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      if (filters.organizationId) searchParams.set("organizationId", filters.organizationId);
      if (filters.startDate) searchParams.set("startDate", filters.startDate);
      if (filters.endDate) searchParams.set("endDate", filters.endDate);
      if (filters.search) searchParams.set("search", filters.search);

      return get<GetAdminTranscriptionsResponse>(`${ENDPOINTS.ADMIN.LOGS_TRANSCRIPTIONS}?${searchParams.toString()}`);
    },
  });
}

export function useAdminTranscriptionDetail(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminLogsTranscriptionDetail(id ?? undefined),
    queryFn: async () => {
      if (!id) return null;
      return get<GetAdminTranscriptionDetailResponse>(ENDPOINTS.ADMIN.LOGS_TRANSCRIPTION_DETAIL(id));
    },
    enabled: !!id,
  });
}

export interface UseAdminActivityParams {
  page?: number;
  limit?: number;
  organizationId?: string;
  userId?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
}

export function useAdminActivity(params: UseAdminActivityParams = {}) {
  const { page = 1, limit = 20, ...filters } = params;

  return useQuery({
    queryKey: QUERY_KEYS.adminLogsActivity({ page, limit, ...filters }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      if (filters.organizationId) searchParams.set("organizationId", filters.organizationId);
      if (filters.userId) searchParams.set("userId", filters.userId);
      if (filters.type) searchParams.set("type", filters.type);
      if (filters.startDate) searchParams.set("startDate", filters.startDate);
      if (filters.endDate) searchParams.set("endDate", filters.endDate);

      return get<GetAdminActivityResponse>(`${ENDPOINTS.ADMIN.LOGS_ACTIVITY}?${searchParams.toString()}`);
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, patch } from "@/lib/api";
import { ENDPOINTS, QUERY_KEYS } from "@/lib/config";
import type {
  GetErrorLogsResponse,
  GetErrorLogDetailResponse,
  GetErrorLogStatsResponse,
  UpdateErrorLogStatusResponse,
} from "@shared/types/src";

export interface UseAdminErrorLogsParams {
  page?: number;
  limit?: number;
  severity?: string;
  product?: string;
  category?: string;
  status?: string;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useAdminErrorLogs(params: UseAdminErrorLogsParams = {}) {
  const { page = 1, limit = 20, ...filters } = params;

  return useQuery({
    queryKey: QUERY_KEYS.adminErrorLogs({ page, limit, ...filters }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));

      if (filters.severity) searchParams.set("severity", filters.severity);
      if (filters.product) searchParams.set("product", filters.product);
      if (filters.category) searchParams.set("category", filters.category);
      if (filters.status) searchParams.set("status", filters.status);
      if (filters.organizationId) searchParams.set("organizationId", filters.organizationId);
      if (filters.startDate) searchParams.set("startDate", filters.startDate);
      if (filters.endDate) searchParams.set("endDate", filters.endDate);
      if (filters.search) searchParams.set("search", filters.search);

      return get<GetErrorLogsResponse>(`${ENDPOINTS.ADMIN.ERROR_LOGS}?${searchParams.toString()}`);
    },
  });
}

export function useAdminErrorLogDetail(id: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.adminErrorLog(id ?? undefined),
    queryFn: async () => {
      if (!id) return null;
      return get<GetErrorLogDetailResponse>(ENDPOINTS.ADMIN.ERROR_LOG(id));
    },
    enabled: !!id,
  });
}

export interface UseAdminErrorLogStatsParams {
  startDate: string;
  endDate: string;
  groupBy?: 'hour' | 'day' | 'week';
  organizationId?: string;
}

export function useAdminErrorLogStats(params: UseAdminErrorLogStatsParams) {
  return useQuery({
    queryKey: QUERY_KEYS.adminErrorLogStats({ ...params }),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("startDate", params.startDate);
      searchParams.set("endDate", params.endDate);
      if (params.groupBy) searchParams.set("groupBy", params.groupBy);
      if (params.organizationId) searchParams.set("organizationId", params.organizationId);

      return get<GetErrorLogStatsResponse>(`${ENDPOINTS.ADMIN.ERROR_LOG_STATS}?${searchParams.toString()}`);
    },
    enabled: !!params.startDate && !!params.endDate,
  });
}

export function useUpdateErrorLogStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      id: string;
      status: 'acknowledged' | 'resolved';
      resolutionNote?: string;
    }) => {
      return patch<UpdateErrorLogStatusResponse>(
        ENDPOINTS.ADMIN.ERROR_LOG_STATUS(params.id),
        { status: params.status, resolutionNote: params.resolutionNote }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-logs'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-log'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'error-log-stats'] });
    },
  });
}

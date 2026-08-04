"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, patch } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  PhonePoolListResponse,
  SyncPhonePoolResponse,
  PhonePoolNumberResponse,
  LocalPresencePreviewResponse,
  AreaCodeCoverageResponse,
  MissingAreaCodesResponse,
} from "@shared/types/src";

interface PhonePoolFilters {
  areaCode?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// List phone pool
export function usePhonePool(filters?: PhonePoolFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.phonePool(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.areaCode) params.set("areaCode", filters.areaCode);
      if (filters?.isActive !== undefined) params.set("isActive", filters.isActive.toString());
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const url = `${ENDPOINTS.LOCAL_PRESENCE.PHONE_POOL}?${params.toString()}`;
      return await get<PhonePoolListResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

// Sync phone pool from Twilio
export function useSyncPhonePool() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await post<SyncPhonePoolResponse>(ENDPOINTS.LOCAL_PRESENCE.PHONE_POOL_SYNC);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-presence", "phone-pool"] });
    },
  });
}

// Update pool number
export function useUpdatePoolNumber() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      friendlyName?: string;
      isActive?: boolean;
    }) => {
      return await patch<PhonePoolNumberResponse>(
        ENDPOINTS.LOCAL_PRESENCE.PHONE_POOL_UPDATE(id),
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-presence", "phone-pool"] });
    },
  });
}

// Preview local presence number for a lead
export function useLocalPresencePreview(leadPhone?: string, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.localPresencePreview(leadPhone),
    queryFn: async () => {
      const params = new URLSearchParams({ leadPhone: leadPhone! });
      const url = `${ENDPOINTS.LOCAL_PRESENCE.PREVIEW}?${params.toString()}`;
      return await get<LocalPresencePreviewResponse>(url);
    },
    enabled: enabled && !!orgId && !!leadPhone,
  });
}

// Get area code coverage
export function useAreaCodeCoverage(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.areaCodeCoverage(orgId),
    queryFn: async () => {
      return await get<AreaCodeCoverageResponse>(ENDPOINTS.LOCAL_PRESENCE.COVERAGE);
    },
    enabled: enabled && !!orgId,
  });
}

// Get missing area codes for a list
export function useMissingAreaCodes(listId?: string, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.missingAreaCodes(orgId, listId),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (listId) params.set("listId", listId);

      const url = `${ENDPOINTS.LOCAL_PRESENCE.MISSING_AREA_CODES}?${params.toString()}`;
      return await get<MissingAreaCodesResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

// Clear expired callback routes
export function useClearExpiredRoutes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return await post<{ cleared: number }>(ENDPOINTS.LOCAL_PRESENCE.CLEAR_EXPIRED_ROUTES);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-presence"] });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, del } from '@/lib/api';
import {
  ApiKeyResponse,
  ApiKeyCreateResponse,
  ApiKeyUsageResponse,
  ApiKeyListResponse,
} from '@shared/types/src';

export function useApiKeys() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.apiKeys(orgId),
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);

        return await get<ApiKeyListResponse>(
          `${ENDPOINTS.API_KEYS.LIST}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch API keys:', error);
        return { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false } };
      }
    },
    enabled: !!orgId,
  });
}

export function useApiKey(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.apiKey(id),
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);

        return await get<{ data: ApiKeyResponse }>(
          `${ENDPOINTS.API_KEYS.GET(id!)}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch API key:', error);
        return { data: null };
      }
    },
    enabled: !!id && !!orgId,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      name: string;
      scopes: string[];
      expiresInDays?: number | null;
    }) => {
      return post<{ data: ApiKeyCreateResponse }>(ENDPOINTS.API_KEYS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.apiKeys(orgId) });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return del(
        `${ENDPOINTS.API_KEYS.REVOKE(id)}?${searchParams.toString()}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.apiKeys(orgId) });
    },
  });
}

export function useApiKeyUsage(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.apiKeyUsage(id),
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);

        return await get<{ data: ApiKeyUsageResponse }>(
          `${ENDPOINTS.API_KEYS.USAGE(id!)}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch API key usage:', error);
        return { data: { requests: [] } };
      }
    },
    enabled: !!id && !!orgId,
  });
}

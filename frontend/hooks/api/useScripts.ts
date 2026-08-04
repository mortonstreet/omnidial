import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';

export interface Script {
  id: string;
  organizationId: string;
  campaignId?: string | null;
  name: string;
  content: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function useScripts(campaignId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.scripts(orgId, campaignId),
    queryFn: async () => {
      try {
        const params = new URLSearchParams({ organizationId: orgId! });
        if (campaignId) {
          params.set('campaignId', campaignId);
        }
        const response = await get<PaginatedResponse<Script>>(
          `${ENDPOINTS.SCRIPTS.LIST}?${params.toString()}`
        );
        return response.data ?? [];
      } catch (error) {
        console.error('Failed to fetch scripts:', error);
        return [];
      }
    },
    enabled: !!orgId,
  });
}

export function useScript(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.script(id),
    queryFn: async () => {
      try {
        return await get<Script>(
          `${ENDPOINTS.SCRIPTS.GET(id!)}?organizationId=${orgId}`
        );
      } catch (error) {
        console.error('Failed to fetch script:', error);
        return null;
      }
    },
    enabled: !!id && !!orgId,
  });
}

export function useCreateScript() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      name: string;
      content: string;
      campaignId?: string;
      isDefault?: boolean;
    }) => {
      return post<Script>(ENDPOINTS.SCRIPTS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scripts(orgId) });
    },
  });
}

export function useUpdateScript() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      content?: string;
      campaignId?: string | null;
      isDefault?: boolean;
    }) => {
      const { id, ...data } = params;
      return patch<Script>(ENDPOINTS.SCRIPTS.UPDATE(id), {
        ...data,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scripts(orgId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.script(variables.id),
      });
    },
  });
}

export function useDeleteScript() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(`${ENDPOINTS.SCRIPTS.DELETE(id)}?organizationId=${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.scripts(orgId) });
    },
  });
}

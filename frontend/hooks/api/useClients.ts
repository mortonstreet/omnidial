import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  color?: string | null;
  campaignCount: number;
  createdAt: string;
  updatedAt: string;
}

export function useClients() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.clients(orgId),
    queryFn: async () => {
      try {
        const response = await get<{ data: Client[] }>(
          `${ENDPOINTS.CLIENTS.LIST}?organizationId=${orgId}`
        );
        return response.data ?? [];
      } catch (error) {
        console.error('Failed to fetch clients:', error);
        return [];
      }
    },
    enabled: !!orgId,
  });
}

export function useClient(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.client(id),
    queryFn: async () => {
      return get<Client>(
        `${ENDPOINTS.CLIENTS.GET(id!)}?organizationId=${orgId}`
      );
    },
    enabled: !!id && !!orgId,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { name: string; color?: string }) => {
      if (!orgId) {
        throw new Error('No organization selected');
      }
      return post<Client>(ENDPOINTS.CLIENTS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients(orgId) });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { id: string; name?: string; color?: string }) => {
      const { id, ...data } = params;
      return patch<Client>(ENDPOINTS.CLIENTS.UPDATE(id), {
        ...data,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients(orgId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.client(variables.id),
      });
    },
  });
}

export function useDeleteClient() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(`${ENDPOINTS.CLIENTS.DELETE(id)}?organizationId=${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.clients(orgId) });
    },
  });
}

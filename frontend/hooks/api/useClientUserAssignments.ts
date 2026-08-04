import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, del } from '@/lib/api';
import type { Client } from './useClients';

interface ClientUserAssignment {
  id: string;
  clientId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  createdAt: string;
}

interface UserClientAssignment {
  id: string;
  clientId: string;
  userId: string;
  clientName: string | null;
  clientColor: string | null;
  createdAt: string;
}

// Get clients assigned to current user (role-aware: admins get all, members get assigned only)
export function useMyAssignedClients() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.myAssignedClients(orgId),
    queryFn: async () => {
      try {
        const response = await get<{ data: Client[] }>(
          `${ENDPOINTS.CLIENT_USER_ASSIGNMENTS.MY_CLIENTS}?organizationId=${orgId}`
        );
        return response.data ?? [];
      } catch (error) {
        console.error('Failed to fetch assigned clients:', error);
        return [];
      }
    },
    enabled: !!orgId,
  });
}

// Get users assigned to a specific client (admin only)
export function useClientUserAssignments(clientId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.clientUserAssignments(orgId, clientId),
    queryFn: async () => {
      try {
        const response = await get<{ data: ClientUserAssignment[] }>(
          `${ENDPOINTS.CLIENT_USER_ASSIGNMENTS.CLIENT_USERS(clientId!)}?organizationId=${orgId}`
        );
        return response.data ?? [];
      } catch (error) {
        console.error('Failed to fetch client users:', error);
        return [];
      }
    },
    enabled: !!orgId && !!clientId,
  });
}

// Get clients assigned to a specific user (admin only)
export function useUserClientAssignments(userId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.userClientAssignments(orgId, userId),
    queryFn: async () => {
      try {
        const response = await get<{ data: UserClientAssignment[] }>(
          `${ENDPOINTS.CLIENT_USER_ASSIGNMENTS.USER_CLIENTS(userId!)}?organizationId=${orgId}`
        );
        return response.data ?? [];
      } catch (error) {
        console.error('Failed to fetch user clients:', error);
        return [];
      }
    },
    enabled: !!orgId && !!userId,
  });
}

// Assign user to client (admin only)
export function useAssignUserToClient() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { clientId: string; userId: string }) => {
      if (!orgId) {
        throw new Error('No organization selected');
      }
      return post(ENDPOINTS.CLIENT_USER_ASSIGNMENTS.ASSIGN, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.clientUserAssignments(orgId, variables.clientId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.userClientAssignments(orgId, variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.myAssignedClients(orgId),
      });
    },
  });
}

// Unassign user from client (admin only)
export function useUnassignUserFromClient() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { clientId: string; userId: string }) => {
      if (!orgId) {
        throw new Error('No organization selected');
      }
      return del(
        `${ENDPOINTS.CLIENT_USER_ASSIGNMENTS.UNASSIGN(params.clientId, params.userId)}?organizationId=${orgId}`
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.clientUserAssignments(orgId, variables.clientId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.userClientAssignments(orgId, variables.userId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.myAssignedClients(orgId),
      });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, del } from "@/lib/api";
import { admin } from "@/lib/auth-client";
import type {
  AdminStats,
  AdminUsersResponse,
  AdminOrganizationsResponse,
  DeleteUserResponse,
  DeleteOrganizationResponse,
  ReassignUserResponse,
  CreateOrganizationResponse,
  RemoveUserFromOrganizationResponse,
  GetOrganizationMembersResponse,
  SwitchOrgResponse,
} from "@shared/types/src";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";

export function useAdminStats() {
  return useQuery({
    queryKey: QUERY_KEYS.adminStats(),
    queryFn: async () => {
      return get<AdminStats>(ENDPOINTS.ADMIN.STATS);
    },
  });
}

export function useAdminUsers(params: { page?: number; limit?: number; search?: string } = {}) {
  const { page = 1, limit = 20, search } = params;
  return useQuery({
    queryKey: ["admin", "users", { page, limit, search }],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (search) searchParams.set("search", search);
      return get<AdminUsersResponse>(`${ENDPOINTS.ADMIN.USERS}?${searchParams.toString()}`);
    },
  });
}

export function useAdminOrganizations(params: { page?: number; limit?: number; search?: string } = {}) {
  const { page = 1, limit = 20, search } = params;
  return useQuery({
    queryKey: ["admin", "organizations", { page, limit, search }],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set("page", String(page));
      searchParams.set("limit", String(limit));
      if (search) searchParams.set("search", search);
      return get<AdminOrganizationsResponse>(`${ENDPOINTS.ADMIN.ORGANIZATIONS}?${searchParams.toString()}`);
    },
  });
}

export function useImpersonateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return admin.impersonateUser({ userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useStopImpersonation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return admin.stopImpersonating();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useAddOrganizationCredits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string; amount: number; reason?: string }) => {
      return post<{ success: boolean; newBalance: number }>(
        ENDPOINTS.ADMIN.ADD_CREDITS(params.organizationId),
        { amount: params.amount, reason: params.reason }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return del<DeleteUserResponse>(ENDPOINTS.ADMIN.DELETE_USER(userId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useDeleteOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      return del<DeleteOrganizationResponse>(ENDPOINTS.ADMIN.DELETE_ORGANIZATION(organizationId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useReassignUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      userId: string;
      fromOrganizationId?: string;
      toOrganizationId: string;
      role?: string;
    }) => {
      return post<ReassignUserResponse>(
        ENDPOINTS.ADMIN.REASSIGN_USER(params.userId),
        {
          fromOrganizationId: params.fromOrganizationId,
          toOrganizationId: params.toOrganizationId,
          role: params.role || "member",
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; slug: string }) => {
      return post<CreateOrganizationResponse>(
        ENDPOINTS.ADMIN.CREATE_ORGANIZATION,
        params
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });
}

export function useRemoveUserFromOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { organizationId: string; userId: string }) => {
      return del<RemoveUserFromOrganizationResponse>(
        ENDPOINTS.ADMIN.REMOVE_USER_FROM_ORG(params.organizationId, params.userId)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useOrganizationMembers(organizationId: string | null) {
  return useQuery({
    queryKey: ["admin", "organization-members", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      return get<GetOrganizationMembersResponse>(
        ENDPOINTS.ADMIN.ORGANIZATION_MEMBERS(organizationId)
      );
    },
    enabled: !!organizationId,
  });
}

export function useAdminSwitchOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (organizationId: string) => {
      return post<SwitchOrgResponse>(ENDPOINTS.ADMIN.SWITCH_ORG, { organizationId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

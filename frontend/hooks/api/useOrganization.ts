/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organization, useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, patch } from '@/lib/api';

export function useOrganizations() {
  
  return useQuery({
    queryKey: QUERY_KEYS.organizations(),
    queryFn: async () => {
      const result = await organization.list();
      return result;
    }
  });
}

/**
 * Create a new organization
 * Automatically adds to Zustand store and sets as active organization
 */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (params: { name: string; slug: string }) => {
      return await organization.create({
        name: params.name,
        slug: params.slug,
        keepCurrentActiveOrganization: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations() });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { organizationId: string; name: string }) => {
      return patch(ENDPOINTS.ORGANIZATION.UPDATE(params.organizationId), params);
    },
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations() });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.organizationMembers(variables.organizationId),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.adminOrganizations() });
    },
  });
}

export function useCheckSlug() {
  return useMutation({
    mutationFn: async (slug: string) => {
      return await organization.checkSlug({ slug });
    },
  });
}

export function useListOrganizationMembers() {
  const activeOrganization = useActiveOrganization();
  
  return useQuery({
    queryKey: QUERY_KEYS.organizationMembers(activeOrganization?.data?.id),
    queryFn: async () => {
      return await organization.listMembers();
    },
    enabled: !!activeOrganization,
  });
}

export function useListOrganizationInvitations() {  
  const activeOrganization = useActiveOrganization();
  
  return useQuery({
    queryKey: QUERY_KEYS.organizationInvitations(activeOrganization?.data?.id),
    queryFn: async () => {
      return await organization.listInvitations();
    },
    enabled: !!activeOrganization,
  });
}


/**
 * Set the active organization
 * Updates both the server and the local store
 */
export function useSetActiveOrganizationMutation() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { organizationId?: string; organizationSlug?: string }) => {
      return await organization.setActive(params);
    },
    onSuccess: (result) => {
      if (result.data) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizationMembers(activeOrganization?.data?.id) });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizationInvitations(activeOrganization?.data?.id) });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizations() });
      }
    },
  });
}

/**
 * Invite a member to the organization
 */
export function useInviteMember() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { email: string; role: "member" | "admin" | "owner"; organizationId: string }) => {
      return await organization.inviteMember({ email: params.email, role: params.role as "member" | "admin" | "owner", organizationId: params.organizationId });
    },
    onSettled: () => {
      // Always invalidate on both success and error to ensure UI reflects current state
      if (activeOrganization?.data?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizationInvitations(activeOrganization.data.id) });
      }
    },
  });
}

export function useCancelOrganizationInvitation() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { invitationId: string }) => {
      return organization.cancelInvitation(params);
    },
    onSettled: () => {
      // Always invalidate to ensure UI reflects current state
      if (activeOrganization?.data?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizationInvitations(activeOrganization.data.id) });
      }
    }
  });
}

export const useRemoveOrganizationMember = () => {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { memberIdOrEmail: string }) => {
      return organization.removeMember({ memberIdOrEmail: params.memberIdOrEmail, organizationId: activeOrganization?.data?.id });
    },
    onSuccess: (result: any) => {
      if (result.data && activeOrganization) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizationMembers(activeOrganization.data?.id) });
      }
    }
  });
}

/**
 * Resend an organization invitation
 * Refreshes the pending invitation expiration and triggers a new email.
 */
export function useResendOrganizationInvitation() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { invitationId: string; email: string; role: "member" | "admin" | "owner" }) => {
      const inviteResult = await organization.inviteMember({
        email: params.email,
        role: params.role,
        organizationId: activeOrganization?.data?.id || '',
        resend: true,
      });

      if (inviteResult.error) {
        throw new Error(inviteResult.error.message || 'Failed to resend invitation');
      }

      return inviteResult;
    },
    onSettled: () => {
      if (activeOrganization?.data?.id) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.organizationInvitations(activeOrganization.data.id) });
      }
    },
  });
}

export function useOrganizationCreditBalance() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.organizationCreditBalance(orgId),
    queryFn: async () => {
      const result = await get<{ balance: number }>(ENDPOINTS.ORGANIZATION.CREDIT_BALANCE(orgId!));
      return result.balance;
    },
    enabled: !!orgId,
  });
}

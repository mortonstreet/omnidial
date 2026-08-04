/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { organization, useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get } from '@/lib/api';

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
 * Cancels the existing invitation and creates a new one with fresh expiration
 */
export function useResendOrganizationInvitation() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { invitationId: string; email: string; role: "member" | "admin" | "owner" }) => {
      // First cancel the existing invitation
      const cancelResult = await organization.cancelInvitation({ invitationId: params.invitationId });
      if (cancelResult.error) {
        throw new Error(cancelResult.error.message || 'Failed to cancel existing invitation');
      }

      // Then create a new invitation
      const inviteResult = await organization.inviteMember({
        email: params.email,
        role: params.role,
        organizationId: activeOrganization?.data?.id || '',
      });

      // Check if the invite failed and throw so onSettled still invalidates
      if (inviteResult.error) {
        throw new Error(inviteResult.error.message || 'Failed to send new invitation');
      }

      return inviteResult;
    },
    onSettled: () => {
      // Always invalidate to ensure UI reflects current state (especially important
      // since we cancel first, then invite - if invite fails, old one is gone)
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


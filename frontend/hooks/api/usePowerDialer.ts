import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post } from '@/lib/api';

export interface PowerDialerProgress {
  id?: string;
  userId?: string;
  campaignId?: string;
  listId?: string;
  currentIndex: number;
  totalLeads: number;
  dialedCount: number;
  isPaused: boolean;
  isComplete?: boolean;
  isEmpty?: boolean;
  isNew?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Import structured summary types
import type { AIBusinessContext } from './useLeads';

export interface Lead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone: string;
  company?: string | null;
  title?: string | null;
  linkedInUrl?: string | null;
  website?: string | null;
  customFields?: Record<string, string>;
  aiCompanySummary?: string | null;
  // Structured AI summary fields
  aiCompanyOverview?: string | null;
  aiSalesTalkingPoints?: string[] | null;
  aiBusinessContext?: AIBusinessContext | null;
  // Timezone (resolved from LinkedIn location)
  timezone?: string | null;
  timezoneResolvedAt?: string | null;
  // List ID for campaign mode (to know which list the lead belongs to)
  listId?: string | null;
}

export interface NextLeadResponse {
  lead: Lead | null;
  progress: {
    currentIndex: number;
    totalLeads: number;
    dialedCount: number;
    isComplete: boolean;
    isEmpty?: boolean;
  };
}

export function usePowerDialerProgress(campaignId?: string, listId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.powerDialerProgress(campaignId, listId),
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          organizationId: orgId!,
          campaignId: campaignId!,
        });
        if (listId) {
          params.set('listId', listId);
        }
        return await get<PowerDialerProgress>(
          `${ENDPOINTS.POWER_DIALER.PROGRESS}?${params.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch power dialer progress:', error);
        return {
          currentIndex: 0,
          totalLeads: 0,
          dialedCount: 0,
          isPaused: true,
          isNew: true,
        };
      }
    },
    enabled: !!orgId && !!campaignId,
  });
}

export function useNextLead(campaignId?: string, listId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.powerDialerNextLead(campaignId, listId),
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          organizationId: orgId!,
          campaignId: campaignId!,
        });
        if (listId) {
          params.set('listId', listId);
        }
        return await get<NextLeadResponse>(
          `${ENDPOINTS.POWER_DIALER.NEXT_LEAD}?${params.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch next lead:', error);
        return {
          lead: null,
          progress: { currentIndex: 0, totalLeads: 0, dialedCount: 0, isComplete: true },
        };
      }
    },
    enabled: !!orgId && !!campaignId,
  });
}

export function useStartPowerDialer() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      campaignId: string;
      listId?: string;
      delaySeconds?: number;
    }) => {
      return post<PowerDialerProgress>(ENDPOINTS.POWER_DIALER.START, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.powerDialerProgress(
          variables.campaignId,
          variables.listId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.powerDialerNextLead(
          variables.campaignId,
          variables.listId
        ),
      });
    },
  });
}

export function useStopPowerDialer() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; listId?: string }) => {
      return post<{ success: boolean }>(ENDPOINTS.POWER_DIALER.STOP, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.powerDialerProgress(
          variables.campaignId,
          variables.listId
        ),
      });
    },
  });
}

export function useSkipLead() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; listId?: string }) => {
      return post<NextLeadResponse>(ENDPOINTS.POWER_DIALER.SKIP, {
        ...params,
        organizationId: orgId,
      });
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
      });
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId),
      });

      // Snapshot the previous value
      const previousNextLead = queryClient.getQueryData<NextLeadResponse>(
        QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId)
      );
      const previousProgress = queryClient.getQueryData<PowerDialerProgress>(
        QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId)
      );

      // Optimistically update the current index
      if (previousNextLead) {
        queryClient.setQueryData<NextLeadResponse>(
          QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
          {
            ...previousNextLead,
            progress: {
              ...previousNextLead.progress,
              currentIndex: previousNextLead.progress.currentIndex + 1,
            },
          }
        );
      }

      return { previousNextLead, previousProgress };
    },
    onError: (_err, variables, context) => {
      // Roll back on error
      if (context?.previousNextLead) {
        queryClient.setQueryData(
          QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
          context.previousNextLead
        );
      }
      if (context?.previousProgress) {
        queryClient.setQueryData(
          QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId),
          context.previousProgress
        );
      }
    },
    onSuccess: (data, variables) => {
      // Update both caches with actual data from server
      queryClient.setQueryData(
        QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
        data
      );
      // Also update progress cache to avoid refetch delay
      queryClient.setQueryData<PowerDialerProgress>(
        QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId),
        (prev) => prev ? {
          ...prev,
          currentIndex: data.progress.currentIndex,
          dialedCount: data.progress.dialedCount,
        } : prev
      );
    },
  });
}

export function useAdvanceToNext() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; listId?: string }) => {
      return post<PowerDialerProgress>(ENDPOINTS.POWER_DIALER.ADVANCE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.powerDialerProgress(
          variables.campaignId,
          variables.listId
        ),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.powerDialerNextLead(
          variables.campaignId,
          variables.listId
        ),
      });
    },
  });
}

export function useGoToPrevious() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; listId?: string }) => {
      return post<NextLeadResponse>(ENDPOINTS.POWER_DIALER.PREVIOUS, {
        ...params,
        organizationId: orgId,
      });
    },
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
      });
      await queryClient.cancelQueries({
        queryKey: QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId),
      });

      // Snapshot the previous value
      const previousNextLead = queryClient.getQueryData<NextLeadResponse>(
        QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId)
      );
      const previousProgress = queryClient.getQueryData<PowerDialerProgress>(
        QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId)
      );

      // Optimistically update the current index (server handles wrapping)
      if (previousNextLead) {
        const totalLeads = previousNextLead.progress.totalLeads || 1;
        const currentIndex = previousNextLead.progress.currentIndex;
        // Calculate wrapped index: if at 0, wrap to last; otherwise decrement
        const effectiveCurrent = currentIndex % totalLeads;
        const newIndex = effectiveCurrent === 0
          ? (currentIndex === 0 ? totalLeads - 1 : currentIndex - 1)
          : currentIndex - 1;

        queryClient.setQueryData<NextLeadResponse>(
          QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
          {
            ...previousNextLead,
            progress: {
              ...previousNextLead.progress,
              currentIndex: newIndex,
            },
          }
        );
      }

      return { previousNextLead, previousProgress };
    },
    onError: (_err, variables, context) => {
      // Roll back on error
      if (context?.previousNextLead) {
        queryClient.setQueryData(
          QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
          context.previousNextLead
        );
      }
      if (context?.previousProgress) {
        queryClient.setQueryData(
          QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId),
          context.previousProgress
        );
      }
    },
    onSuccess: (data, variables) => {
      // Update both caches with actual data from server
      queryClient.setQueryData(
        QUERY_KEYS.powerDialerNextLead(variables.campaignId, variables.listId),
        data
      );
      // Also update progress cache to avoid refetch delay
      queryClient.setQueryData<PowerDialerProgress>(
        QUERY_KEYS.powerDialerProgress(variables.campaignId, variables.listId),
        (prev) => prev ? {
          ...prev,
          currentIndex: data.progress.currentIndex,
          dialedCount: data.progress.dialedCount,
        } : prev
      );
    },
  });
}

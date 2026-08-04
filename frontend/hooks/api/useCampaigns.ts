import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';
import { env } from '@/lib/config';

interface Client {
  id: string;
  name: string | null;
  color: string | null;
}

interface Campaign {
  id: string;
  organizationId: string;
  createdById: string;
  clientId: string | null;
  client: Client | null;
  name: string;
  status: 'active' | 'inactive'; // Calculated based on lastCalledAt
  leadCount: number;
  dialedCount: number;
  connectedCount: number;
  lastCalledAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignedUsers?: { id: string; name: string; email: string }[];
}

interface CampaignLead {
  id: string;
  campaignId: string;
  leadId: string;
  assignedUserId?: string;
  status: 'pending' | 'dialed' | 'completed';
  dialOrder: number;
  createdAt: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone: string;
  company?: string;
  title?: string;
  linkedInUrl?: string;
  customFields?: Record<string, string>;
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

interface ListCampaignsParams {
  clientId?: string;
  status?: 'active' | 'inactive';
  search?: string;
  page?: number;
  limit?: number;
}

export function useCampaigns(params: ListCampaignsParams = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.campaigns(orgId), params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);
      if (params.clientId) searchParams.set('clientId', params.clientId);
      if (params.status) searchParams.set('status', params.status);
      if (params.search) searchParams.set('search', params.search);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());

      try {
        return await get<PaginatedResponse<Campaign>>(
          `${ENDPOINTS.CAMPAIGNS.LIST}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch campaigns:', error);
        return {
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }
    },
    enabled: !!orgId,
  });
}

export function useCampaign(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.campaign(id),
    queryFn: async () => {
      return get<Campaign>(
        `${ENDPOINTS.CAMPAIGNS.GET(id!)}?organizationId=${orgId}`
      );
    },
    enabled: !!id && !!orgId,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      name: string;
      clientId?: string;
      listId?: string;
      assignedUserIds?: string[];
    }) => {
      if (!orgId) {
        throw new Error('No organization selected');
      }
      return post<Campaign>(ENDPOINTS.CAMPAIGNS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campaigns(orgId) });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      clientId?: string | null;
      assignedUserIds?: string[];
    }) => {
      const { id, ...data } = params;
      return patch<Campaign>(ENDPOINTS.CAMPAIGNS.UPDATE(id), {
        ...data,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campaigns(orgId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaign(variables.id),
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(`${ENDPOINTS.CAMPAIGNS.DELETE(id)}?organizationId=${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campaigns(orgId) });
    },
  });
}

export function useUploadCsv() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { campaignId: string; file: File }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error('No organization selected');
      }

      const formData = new FormData();
      formData.append('file', params.file);
      formData.append('organizationId', orgId);

      const response = await fetch(
        `${env.API_URL}${ENDPOINTS.CAMPAIGNS.UPLOAD(params.campaignId)}`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
        } catch {
          // Response wasn't JSON, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaign(variables.campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaignLeads(variables.campaignId),
      });
    },
  });
}

export function useAssignLeads() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; userIds: string[] }) => {
      return post(`${ENDPOINTS.CAMPAIGNS.ASSIGN(params.campaignId)}`, {
        organizationId: orgId,
        userIds: params.userIds,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaignLeads(variables.campaignId),
      });
    },
  });
}

interface CampaignLeadsParams {
  campaignId: string;
  status?: 'pending' | 'dialed' | 'completed';
  assignedUserId?: string;
  page?: number;
  limit?: number;
}

export function useCampaignLeads(params: CampaignLeadsParams) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.campaignLeads(params.campaignId), params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);
      if (params.status) searchParams.set('status', params.status);
      if (params.assignedUserId)
        searchParams.set('assignedUserId', params.assignedUserId);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());

      return get<PaginatedResponse<CampaignLead>>(
        `${ENDPOINTS.CAMPAIGNS.LEADS(params.campaignId)}?${searchParams.toString()}`
      );
    },
    enabled: !!params.campaignId && !!orgId,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS, env } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';

// Types
interface LeadListFolder {
  id: string;
  organizationId: string;
  parentId?: string | null;
  name: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface LeadList {
  id: string;
  organizationId: string;
  folderId?: string;
  folderName?: string;
  name: string;
  description?: string;
  leadCount: number;
  importStatus: 'pending' | 'processing' | 'completed' | 'failed';
  importError?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

interface ListLead {
  entryId: string;
  sortOrder: number;
  id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone: string;
  company?: string;
  title?: string;
  linkedInUrl?: string;
  customFields?: Record<string, string>;
  createdAt: string;
}

interface CampaignList {
  id: string;
  addedAt: string;
  listId: string;
  name: string;
  leadCount: number;
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

// ======= FOLDER HOOKS =======

export function useFolders() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.listFolders(orgId),
    queryFn: async () => {
      try {
        return await get<{ data: LeadListFolder[] }>(
          `${ENDPOINTS.LISTS.FOLDERS}?organizationId=${orgId}`
        );
      } catch (error) {
        console.error('Failed to fetch folders:', error);
        return { data: [] };
      }
    },
    enabled: !!orgId,
    staleTime: 30000, // Consider data fresh for 30s - improves responsiveness
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { name: string; color?: string; parentId?: string | null }) => {
      return post<LeadListFolder>(ENDPOINTS.LISTS.FOLDERS, {
        ...params,
        organizationId: orgId,
      });
    },
    onMutate: async (newFolder) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: QUERY_KEYS.listFolders(orgId) });

      // Snapshot previous value
      const previousFolders = queryClient.getQueryData<{ data: LeadListFolder[] }>(QUERY_KEYS.listFolders(orgId));

      // Create optimistic folder
      const optimisticFolder: LeadListFolder = {
        id: `temp-${Date.now()}`,
        organizationId: orgId!,
        parentId: newFolder.parentId ?? null,
        name: newFolder.name,
        color: newFolder.color || '#6366f1',
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Optimistically add the new folder
      queryClient.setQueryData<{ data: LeadListFolder[] }>(
        QUERY_KEYS.listFolders(orgId),
        (old) => {
          if (!old) return { data: [optimisticFolder] };
          return { data: [optimisticFolder, ...old.data] };
        }
      );

      return { previousFolders, optimisticFolder };
    },
    onError: (_err, _newFolder, context) => {
      // Rollback on error
      if (context?.previousFolders) {
        queryClient.setQueryData(QUERY_KEYS.listFolders(orgId), context.previousFolders);
      }
    },
    onSuccess: (createdFolder, _variables, context) => {
      // Replace optimistic folder with real folder data
      if (context?.optimisticFolder) {
        queryClient.setQueryData<{ data: LeadListFolder[] }>(
          QUERY_KEYS.listFolders(orgId),
          (old) => {
            if (!old) return { data: [createdFolder] };
            return {
              data: old.data.map(folder =>
                folder.id === context.optimisticFolder.id ? createdFolder : folder
              ),
            };
          }
        );
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listFolders(orgId) });
    },
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { id: string; name?: string; color?: string }) => {
      const { id, ...data } = params;
      return patch<LeadListFolder>(ENDPOINTS.LISTS.FOLDER(id), {
        ...data,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listFolders(orgId) });
    },
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(`${ENDPOINTS.LISTS.FOLDER(id)}?organizationId=${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listFolders(orgId) });
      // Invalidate all lists queries (root and all folders) using prefix match
      queryClient.invalidateQueries({ queryKey: ['lists', orgId] });
    },
  });
}

export function useReorderFolders() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (folderIds: string[]) => {
      return post(ENDPOINTS.LISTS.REORDER_FOLDERS, {
        organizationId: orgId,
        folderIds,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listFolders(orgId) });
    },
  });
}

// ======= LIST HOOKS =======

interface ListListsParams {
  folderId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useLists(params: ListListsParams = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.lists(orgId, params.folderId), params],
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);
        if (params.folderId) searchParams.set('folderId', params.folderId);
        if (params.search) searchParams.set('search', params.search);
        if (params.page) searchParams.set('page', params.page.toString());
        if (params.limit) searchParams.set('limit', params.limit.toString());

        return await get<PaginatedResponse<LeadList>>(
          `${ENDPOINTS.LISTS.LIST}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch lists:', error);
        return {
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        };
      }
    },
    enabled: !!orgId,
    staleTime: 30000, // Consider data fresh for 30s - improves folder navigation speed
  });
}

export function useList(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.list(id),
    queryFn: async () => {
      try {
        return await get<LeadList>(
          `${ENDPOINTS.LISTS.GET(id!)}?organizationId=${orgId}`
        );
      } catch (error) {
        console.error('Failed to fetch list:', error);
        return null;
      }
    },
    enabled: !!id && !!orgId,
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      folderId?: string | null;
    }) => {
      return post<LeadList>(ENDPOINTS.LISTS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onMutate: async (newList) => {
      // Normalize folderId - null becomes undefined for consistency
      const normalizedFolderId = newList.folderId ?? undefined;

      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['lists', orgId] });

      // Create optimistic list item
      const optimisticList: LeadList = {
        id: `temp-${Date.now()}`,
        organizationId: orgId!,
        folderId: normalizedFolderId,
        name: newList.name,
        description: newList.description,
        leadCount: 0,
        importStatus: 'pending',
        createdById: '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Snapshot previous value for rollback - get all list queries
      const previousData = queryClient.getQueriesData<PaginatedResponse<LeadList>>({
        queryKey: ['lists', orgId]
      });

      // Optimistically add the new list to matching queries
      // Use the exact query key structure that useLists uses
      const exactParams = { folderId: normalizedFolderId, search: undefined };
      const exactQueryKey = [...QUERY_KEYS.lists(orgId, normalizedFolderId), exactParams];

      queryClient.setQueryData<PaginatedResponse<LeadList>>(
        exactQueryKey,
        (old) => {
          if (!old) {
            // If no cached data exists, create initial structure
            return {
              data: [optimisticList],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false },
            };
          }
          return {
            ...old,
            data: [optimisticList, ...old.data],
            pagination: {
              ...old.pagination,
              total: old.pagination.total + 1,
            },
          };
        }
      );

      return { previousData, optimisticList };
    },
    onError: (_err, _newList, context) => {
      // Rollback on error
      if (context?.previousData) {
        for (const [queryKey, data] of context.previousData) {
          queryClient.setQueryData(queryKey, data);
        }
      }
    },
    onSuccess: (createdList, _variables, context) => {
      // Replace optimistic list with real list data in cache
      if (context?.optimisticList) {
        const normalizedFolderId = createdList.folderId ?? undefined;
        const exactParams = { folderId: normalizedFolderId, search: undefined };
        const exactQueryKey = [...QUERY_KEYS.lists(orgId, normalizedFolderId), exactParams];

        queryClient.setQueryData<PaginatedResponse<LeadList>>(
          exactQueryKey,
          (old) => {
            if (!old) return old;
            return {
              ...old,
              data: old.data.map(list =>
                list.id === context.optimisticList.id ? createdList : list
              ),
            };
          }
        );
      }
    },
    onSettled: () => {
      // Invalidate all lists queries (root and all folders) using prefix match
      // This ensures fresh data but won't flicker because we already updated the cache
      queryClient.invalidateQueries({ queryKey: ['lists', orgId] });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      id: string;
      name?: string;
      description?: string | null;
      folderId?: string | null;
    }) => {
      const { id, ...data } = params;
      return patch<LeadList>(ENDPOINTS.LISTS.UPDATE(id), {
        ...data,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      // Invalidate all lists queries (root and all folders) using prefix match
      queryClient.invalidateQueries({ queryKey: ['lists', orgId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(variables.id) });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(`${ENDPOINTS.LISTS.DELETE(id)}?organizationId=${orgId}`);
    },
    onSuccess: () => {
      // Invalidate all lists queries (root and all folders) using prefix match
      queryClient.invalidateQueries({ queryKey: ['lists', orgId] });
    },
  });
}

export function useUploadListCsv() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { listId: string; file: File }) => {
      const formData = new FormData();
      formData.append('file', params.file);
      formData.append('organizationId', orgId!);

      const response = await fetch(
        `${env.API_URL}${ENDPOINTS.LISTS.UPLOAD(params.listId)}`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(variables.listId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listLeads(variables.listId) });
      // Invalidate all lists queries (root and all folders) using prefix match
      queryClient.invalidateQueries({ queryKey: ['lists', orgId] });
    },
  });
}

// ======= LIST LEADS HOOKS =======

interface ListLeadsParams {
  listId: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function useListLeads(params: ListLeadsParams) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.listLeads(params.listId), params],
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);
        if (params.search) searchParams.set('search', params.search);
        if (params.page) searchParams.set('page', params.page.toString());
        if (params.limit) searchParams.set('limit', params.limit.toString());

        return await get<PaginatedResponse<ListLead>>(
          `${ENDPOINTS.LISTS.LEADS(params.listId)}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch list leads:', error);
        return {
          data: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNextPage: false, hasPrevPage: false },
        };
      }
    },
    enabled: !!params.listId && !!orgId,
  });
}

export function useAddLeadsToList() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { listId: string; leadIds: string[] }) => {
      return post(`${ENDPOINTS.LISTS.LEADS(params.listId)}`, {
        organizationId: orgId,
        leadIds: params.leadIds,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(variables.listId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listLeads(variables.listId) });
    },
  });
}

export function useRemoveLeadsFromList() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { listId: string; leadIds: string[] }) => {
      return del(`${ENDPOINTS.LISTS.LEADS(params.listId)}`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          leadIds: params.leadIds,
        }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(variables.listId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listLeads(variables.listId) });
    },
  });
}

// Soft-remove a lead from list (for power dialer - preserves data)
export function useSoftRemoveLeadFromList() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { listId: string; leadId: string }) => {
      return del(`${ENDPOINTS.LISTS.SOFT_REMOVE_LEAD(params.listId, params.leadId)}?organizationId=${orgId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(variables.listId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listLeads(variables.listId) });
      // Also invalidate power dialer queries
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.powerDialerProgress() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.powerDialerNextLead() });
    },
  });
}

// ======= CAMPAIGN-LIST LINKING HOOKS =======

export function useCampaignLists(campaignId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.campaignLists(campaignId),
    queryFn: async () => {
      try {
        return await get<{ data: CampaignList[] }>(
          `${ENDPOINTS.LISTS.CAMPAIGN_LISTS(campaignId!)}?organizationId=${orgId}`
        );
      } catch (error) {
        console.error('Failed to fetch campaign lists:', error);
        return { data: [] };
      }
    },
    enabled: !!campaignId && !!orgId,
  });
}

export function useAddListToCampaign() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; listId: string }): Promise<{ leadsAdded: number }> => {
      return post(ENDPOINTS.LISTS.ADD_TO_CAMPAIGN(params.campaignId), {
        organizationId: orgId,
        listId: params.listId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaignLists(variables.campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaignLeads(variables.campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaign(variables.campaignId),
      });
    },
  });
}

export function useRemoveListFromCampaign() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { campaignId: string; listId: string }) => {
      return del(
        `${ENDPOINTS.LISTS.REMOVE_FROM_CAMPAIGN(params.campaignId, params.listId)}?organizationId=${orgId}`
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaignLists(variables.campaignId),
      });
    },
  });
}

// ======= LEAD UPDATE HOOK (for inline editing) =======

interface UpdateLeadData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedInUrl?: string;
  pipelineStageId?: string | null;
}

export function useUpdateLead(listId: string) {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { leadId: string; data: UpdateLeadData }) => {
      return patch(`${ENDPOINTS.LEADS.UPDATE(params.leadId)}?organizationId=${orgId}`, params.data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listLeads(listId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list(listId) });
      // Cross-view invalidation: sync changes to Leads tab
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(variables.leadId) });
    },
  });
}

// ======= FAVORITES HOOKS =======

interface _FavoriteItem {
  id: string;
  type: 'list' | 'folder';
  favoritedAt: string;
}

interface FavoritesResponse {
  lists: (LeadList & { type: 'list'; favoriteId: string; favoritedAt: string })[];
  folders: (LeadListFolder & { type: 'folder'; favoriteId: string; favoritedAt: string })[];
}

interface FavoriteIdsResponse {
  listIds: string[];
  folderIds: string[];
}

export function useFavorites() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.listFavorites?.(orgId) ?? ['listFavorites', orgId],
    queryFn: async () => {
      try {
        return await get<FavoritesResponse>(
          `${ENDPOINTS.LISTS.FAVORITES}?organizationId=${orgId}`
        );
      } catch (error) {
        console.error('Failed to fetch favorites:', error);
        return { lists: [], folders: [] };
      }
    },
    enabled: !!orgId,
  });
}

export function useFavoriteIds() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.listFavoriteIds?.(orgId) ?? ['listFavoriteIds', orgId],
    queryFn: async () => {
      try {
        return await get<FavoriteIdsResponse>(
          `${ENDPOINTS.LISTS.FAVORITE_IDS}?organizationId=${orgId}`
        );
      } catch (error) {
        console.error('Failed to fetch favorite IDs:', error);
        return { listIds: [], folderIds: [] };
      }
    },
    enabled: !!orgId,
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { itemId: string; type: 'list' | 'folder' }) => {
      return post<{ favorited: boolean }>(ENDPOINTS.LISTS.FAVORITES, {
        organizationId: orgId,
        itemId: params.itemId,
        type: params.type,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listFavorites?.(orgId) ?? ['listFavorites', orgId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listFavoriteIds?.(orgId) ?? ['listFavoriteIds', orgId] });
    },
  });
}

// ======= RECENTS HOOKS =======

// Full recent item with all list/folder data (backend returns complete objects)
interface RecentListItem extends LeadList {
  type: 'list';
  openedAt: string;
  folderName?: string;
}

interface RecentFolderItem extends LeadListFolder {
  type: 'folder';
  openedAt: string;
}

type RecentItem = RecentListItem | RecentFolderItem;

export function useRecents(limit = 20) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.listRecents?.(orgId) ?? ['listRecents', orgId],
    queryFn: async () => {
      try {
        return await get<{ data: RecentItem[] }>(
          `${ENDPOINTS.LISTS.RECENTS}?organizationId=${orgId}&limit=${limit}`
        );
      } catch (error) {
        console.error('Failed to fetch recents:', error);
        return { data: [] };
      }
    },
    enabled: !!orgId,
  });
}

export function useRecordListOpen() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (listId: string) => {
      return post(`${ENDPOINTS.LISTS.OPEN(listId)}`, {
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listRecents?.(orgId) ?? ['listRecents', orgId] });
    },
  });
}

export function useRecordFolderOpen() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (folderId: string) => {
      return post(`${ENDPOINTS.LISTS.FOLDER_OPEN(folderId)}`, {
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.listRecents?.(orgId) ?? ['listRecents', orgId] });
    },
  });
}

// Prefetch folder lists - call this BEFORE navigating for instant navigation
export function usePrefetchFolderLists() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return (folderId: string) => {
    if (!orgId) return;

    // Match the exact query key structure used by useLists
    const params = { folderId, search: undefined };
    queryClient.prefetchQuery({
      queryKey: [...QUERY_KEYS.lists(orgId, folderId), params],
      queryFn: async () => {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId);
        searchParams.set('folderId', folderId);
        return get<PaginatedResponse<LeadList>>(
          `${ENDPOINTS.LISTS.LIST}?${searchParams.toString()}`
        );
      },
      staleTime: 30000, // Consider fresh for 30s to avoid immediate refetch
    });
  };
}

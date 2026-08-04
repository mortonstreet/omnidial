import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { QUERY_KEYS, ENDPOINTS } from '@/lib/config';
import { DBNote } from '@shared/types/src';

type NotesResponse = {
  data: DBNote[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type GetNotesParams = {
  leadId: string;
  page?: number;
  limit?: number;
};

export function useNotes(params: GetNotesParams) {
  return useQuery<NotesResponse>({
    queryKey: QUERY_KEYS.notes(params.leadId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('leadId', params.leadId);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));

      const url = `${ENDPOINTS.NOTES.LIST}?${searchParams.toString()}`;
      return await get<NotesResponse>(url);
    },
    enabled: !!params.leadId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation<DBNote, Error, { leadId: string; content: string }>({
    mutationFn: async (data) => {
      return await post<DBNote>(ENDPOINTS.NOTES.CREATE, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(variables.leadId) });
    },
  });
}

export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation<DBNote, Error, { id: string; content: string; leadId: string }>({
    mutationFn: async ({ id, content }) => {
      return await patch<DBNote>(ENDPOINTS.NOTES.UPDATE(id), { content });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(variables.leadId) });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, { id: string; leadId: string }>({
    mutationFn: async ({ id }) => {
      return await del<{ success: boolean }>(ENDPOINTS.NOTES.DELETE(id));
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes(variables.leadId) });
    },
  });
}

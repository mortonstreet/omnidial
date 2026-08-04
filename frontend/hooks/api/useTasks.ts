import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { QUERY_KEYS, ENDPOINTS } from '@/lib/config';
import { DBTask } from '@shared/types/src';

type TasksResponse = {
  data: DBTask[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type GetTasksParams = {
  leadId?: string;
  userId?: string;
  completed?: 'true' | 'false' | 'all';
  dueFrom?: string;
  dueTo?: string;
  page?: number;
  limit?: number;
};

export function useTasks(params?: GetTasksParams) {
  return useQuery<TasksResponse>({
    queryKey: QUERY_KEYS.tasks(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params?.leadId) searchParams.set('leadId', params.leadId);
      if (params?.userId) searchParams.set('userId', params.userId);
      if (params?.completed) searchParams.set('completed', params.completed);
      if (params?.dueFrom) searchParams.set('dueFrom', params.dueFrom);
      if (params?.dueTo) searchParams.set('dueTo', params.dueTo);
      if (params?.page) searchParams.set('page', String(params.page));
      if (params?.limit) searchParams.set('limit', String(params.limit));

      const query = searchParams.toString();
      const url = query ? `${ENDPOINTS.TASKS.LIST}?${query}` : ENDPOINTS.TASKS.LIST;
      return await get<TasksResponse>(url);
    },
  });
}

export function useTask(id: string) {
  return useQuery<DBTask>({
    queryKey: QUERY_KEYS.task(id),
    queryFn: async () => {
      return await get<DBTask>(ENDPOINTS.TASKS.GET(id));
    },
    enabled: !!id,
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation<
    DBTask,
    Error,
    { leadId: string; title: string; dueAt?: string }
  >({
    mutationFn: async (data) => {
      return await post<DBTask>(ENDPOINTS.TASKS.CREATE, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation<
    DBTask,
    Error,
    { id: string; title?: string; dueAt?: string | null; completedAt?: string | null }
  >({
    mutationFn: async ({ id, ...data }) => {
      return await patch<DBTask>(ENDPOINTS.TASKS.UPDATE(id), data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.task(variables.id) });
    },
  });
}

export function useCompleteTask() {
  const queryClient = useQueryClient();

  return useMutation<DBTask, Error, string>({
    mutationFn: async (id) => {
      return await post<DBTask>(ENDPOINTS.TASKS.COMPLETE(id));
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.task(id) });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      return await del<{ success: boolean }>(ENDPOINTS.TASKS.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

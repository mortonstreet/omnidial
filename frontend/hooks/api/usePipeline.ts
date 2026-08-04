import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, patch, del } from '@/lib/api';
import { QUERY_KEYS, ENDPOINTS } from '@/lib/config';
import { DBPipelineStage } from '@shared/types/src';

// Extended pipeline stage with stats from API
export type PipelineStageWithStats = DBPipelineStage & {
  leadCount: number;
  totalValue: number;
};

type PipelineStagesResponse = {
  data: PipelineStageWithStats[];
};

export function usePipelineStages() {
  return useQuery<PipelineStagesResponse>({
    queryKey: QUERY_KEYS.pipelineStages(),
    queryFn: async () => {
      return await get<PipelineStagesResponse>(ENDPOINTS.PIPELINE_STAGES.LIST);
    },
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation<
    DBPipelineStage,
    Error,
    { label: string; color?: string; sortOrder?: number; isDefault?: boolean }
  >({
    mutationFn: async (data) => {
      return await post<DBPipelineStage>(ENDPOINTS.PIPELINE_STAGES.CREATE, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation<
    DBPipelineStage,
    Error,
    { id: string; label?: string; color?: string; sortOrder?: number; isDefault?: boolean }
  >({
    mutationFn: async ({ id, ...data }) => {
      return await patch<DBPipelineStage>(ENDPOINTS.PIPELINE_STAGES.UPDATE(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      return await del<{ success: boolean }>(ENDPOINTS.PIPELINE_STAGES.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

export function useReorderPipelineStages() {
  const queryClient = useQueryClient();

  return useMutation<
    PipelineStagesResponse,
    Error,
    { stages: { id: string; sortOrder: number }[] }
  >({
    mutationFn: async (data) => {
      return await post<PipelineStagesResponse>(ENDPOINTS.PIPELINE_STAGES.REORDER, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

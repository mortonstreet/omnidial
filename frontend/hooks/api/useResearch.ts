"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post, patch, del } from "@/lib/api";
import { QUERY_KEYS, ENDPOINTS } from "@/lib/config";
import { useActiveOrganization } from "@/lib/auth-client";
import type {
  ResearchTaskListResponse,
  ResearchTaskDetailResponse,
  ResearchTaskResponse,
  BulkResearchTasksResponse,
  ResearchApprovalListResponse,
  ResearchApprovalResponse,
  BulkApprovalActionResponse,
  ResearchTemplateListResponse,
  ResearchTemplateResponse,
  CustomFieldSchemaListResponse,
  CustomFieldSchemaResponse,
  FirecrawlTestResult,
  FirecrawlCreditsResponse,
  ResearchTaskStatus,
  ResearchApprovalStatus,
} from "@shared/types/src";

// === Research Tasks ===

interface ResearchTaskFilters {
  leadId?: string;
  status?: ResearchTaskStatus;
  page?: number;
  limit?: number;
}

export function useResearchTasks(filters?: ResearchTaskFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchTasks(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.leadId) params.set("leadId", filters.leadId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const url = `${ENDPOINTS.RESEARCH.TASKS}?${params.toString()}`;
      return await get<ResearchTaskListResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

export function useResearchTask(taskId: string, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchTask(taskId),
    queryFn: async () => {
      return await get<ResearchTaskDetailResponse>(ENDPOINTS.RESEARCH.TASK(taskId));
    },
    enabled: enabled && !!orgId && !!taskId,
  });
}

export function useCreateResearchTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leadId: string;
      templateId?: string;
      customPrompt?: string;
      targetUrls?: string[];
      priority?: number;
    }) => {
      return await post<ResearchTaskResponse>(ENDPOINTS.RESEARCH.TASKS, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "tasks"] });
    },
  });
}

export function useCreateBulkResearchTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[];
      templateId?: string;
      customPrompt?: string;
      targetUrls?: string[];
      priority?: number;
    }) => {
      return await post<BulkResearchTasksResponse>(ENDPOINTS.RESEARCH.TASKS_BULK, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "tasks"] });
    },
  });
}

export function useCancelResearchTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      return await post<{ success: boolean }>(ENDPOINTS.RESEARCH.TASK_CANCEL(taskId));
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.researchTask(taskId) });
      queryClient.invalidateQueries({ queryKey: ["research", "tasks"] });
    },
  });
}

export function useRetryResearchTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      return await post<{ success: boolean }>(ENDPOINTS.RESEARCH.TASK_RETRY(taskId));
    },
    onSuccess: (_, taskId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.researchTask(taskId) });
      queryClient.invalidateQueries({ queryKey: ["research", "tasks"] });
    },
  });
}

// === Research Approvals ===

interface ResearchApprovalFilters {
  leadId?: string;
  taskId?: string;
  status?: ResearchApprovalStatus;
  page?: number;
  limit?: number;
}

export function useResearchApprovals(filters?: ResearchApprovalFilters, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchApprovals(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.leadId) params.set("leadId", filters.leadId);
      if (filters?.taskId) params.set("taskId", filters.taskId);
      if (filters?.status) params.set("status", filters.status);
      if (filters?.page) params.set("page", filters.page.toString());
      if (filters?.limit) params.set("limit", filters.limit.toString());

      const url = `${ENDPOINTS.RESEARCH.APPROVALS}?${params.toString()}`;
      return await get<ResearchApprovalListResponse>(url);
    },
    enabled: enabled && !!orgId,
  });
}

export function useApproveResearchApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (approvalId: string) => {
      return await post<ResearchApprovalResponse>(
        ENDPOINTS.RESEARCH.APPROVAL_APPROVE(approvalId)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["research", "task"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
    },
  });
}

export function useRejectResearchApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      return await post<ResearchApprovalResponse>(
        ENDPOINTS.RESEARCH.APPROVAL_REJECT(id),
        { reason }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["research", "task"] });
    },
  });
}

export function useModifyResearchApproval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, modifiedValue }: { id: string; modifiedValue: string }) => {
      return await post<ResearchApprovalResponse>(
        ENDPOINTS.RESEARCH.APPROVAL_MODIFY(id),
        { modifiedValue }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["research", "task"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
    },
  });
}

export function useBulkApproveResearchApprovals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      return await post<BulkApprovalActionResponse>(
        ENDPOINTS.RESEARCH.APPROVALS_BULK_APPROVE,
        { ids }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["research", "task"] });
      queryClient.invalidateQueries({ queryKey: ["lead"] });
    },
  });
}

export function useBulkRejectResearchApprovals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ ids, reason }: { ids: string[]; reason?: string }) => {
      return await post<BulkApprovalActionResponse>(
        ENDPOINTS.RESEARCH.APPROVALS_BULK_REJECT,
        { ids, reason }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "approvals"] });
      queryClient.invalidateQueries({ queryKey: ["research", "task"] });
    },
  });
}

// === Research Templates ===

export function useResearchTemplates(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchTemplates(orgId),
    queryFn: async () => {
      return await get<ResearchTemplateListResponse>(ENDPOINTS.RESEARCH.TEMPLATES);
    },
    enabled: enabled && !!orgId,
  });
}

export function useResearchTemplate(templateId: string, enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchTemplate(templateId),
    queryFn: async () => {
      return await get<ResearchTemplateResponse>(ENDPOINTS.RESEARCH.TEMPLATE(templateId));
    },
    enabled: enabled && !!orgId && !!templateId,
  });
}

export function useCreateResearchTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      description?: string;
      prompt: string;
      targetUrls?: string[];
      extractionSchema?: Record<string, unknown>;
      fieldMappings?: Record<string, string>;
    }) => {
      return await post<ResearchTemplateResponse>(ENDPOINTS.RESEARCH.TEMPLATES, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "templates"] });
    },
  });
}

export function useUpdateResearchTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      name?: string;
      description?: string;
      prompt?: string;
      targetUrls?: string[];
      extractionSchema?: Record<string, unknown>;
      fieldMappings?: Record<string, string>;
      isActive?: boolean;
    }) => {
      return await patch<ResearchTemplateResponse>(ENDPOINTS.RESEARCH.TEMPLATE(id), data);
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.researchTemplate(id) });
      queryClient.invalidateQueries({ queryKey: ["research", "templates"] });
    },
  });
}

export function useDeleteResearchTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      await del(ENDPOINTS.RESEARCH.TEMPLATE(templateId));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "templates"] });
    },
  });
}

// === Custom Field Schemas ===

export function useResearchFields(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchFields(orgId),
    queryFn: async () => {
      return await get<CustomFieldSchemaListResponse>(ENDPOINTS.RESEARCH.FIELDS);
    },
    enabled: enabled && !!orgId,
  });
}

export function useCreateResearchField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      name: string;
      label: string;
      fieldType?: string;
      description?: string;
      isRequired?: boolean;
      defaultValue?: string;
      validationRule?: string;
      sortOrder?: number;
    }) => {
      return await post<CustomFieldSchemaResponse>(ENDPOINTS.RESEARCH.FIELDS, params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "fields"] });
    },
  });
}

export function useUpdateResearchField() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string;
      label?: string;
      description?: string;
      isRequired?: boolean;
      defaultValue?: string;
      validationRule?: string;
      sortOrder?: number;
      isActive?: boolean;
    }) => {
      return await patch<CustomFieldSchemaResponse>(ENDPOINTS.RESEARCH.FIELD(id), data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["research", "fields"] });
    },
  });
}

// === Firecrawl Connection ===

export function useTestFirecrawlConnection() {
  return useMutation({
    mutationFn: async (apiKey: string) => {
      return await post<FirecrawlTestResult>(ENDPOINTS.RESEARCH.CONNECTION_TEST, { apiKey });
    },
  });
}

export function useResearchCredits(enabled = true) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.researchCredits(orgId),
    queryFn: async () => {
      return await get<FirecrawlCreditsResponse>(ENDPOINTS.RESEARCH.CREDITS);
    },
    enabled: enabled && !!orgId,
  });
}

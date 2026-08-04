/**
 * Orchestration Hooks
 * React Query hooks for the AI agent orchestration framework
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '@/lib/api'
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config'
import type {
  AgentDefinitionResponse,
  AgentDefinitionListResponse,
  CreateAgentDefinitionRequest,
  UpdateAgentDefinitionRequest,
  InvokeAgentRequest,
  InvokeAgentResponse,
  AgentExecutionResponse,
  AgentExecutionListResponse,
  AgentApprovalResponse,
  AgentApprovalListResponse,
  RespondToApprovalRequest,
  BatchRespondToApprovalsRequest,
  AgentDefinitionType,
} from '@shared/types/src/requests/leadAgent'

// ============================================
// Agent Definitions
// ============================================

export function useAgentDefinitions(filters?: { type?: AgentDefinitionType; isActive?: boolean }) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationDefinitions(undefined, filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.type) params.set('type', filters.type)
      if (filters?.isActive !== undefined) params.set('isActive', String(filters.isActive))
      const query = params.toString() ? `?${params.toString()}` : ''
      return get<AgentDefinitionListResponse>(`${ENDPOINTS.ORCHESTRATION.DEFINITIONS}${query}`)
    },
  })
}

export function useAgentDefinition(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationDefinition(id),
    queryFn: () => get<AgentDefinitionResponse>(ENDPOINTS.ORCHESTRATION.DEFINITION(id!)),
    enabled: !!id,
  })
}

export function useCreateAgentDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateAgentDefinitionRequest) =>
      post<AgentDefinitionResponse>(ENDPOINTS.ORCHESTRATION.DEFINITIONS, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'definitions'] })
    },
  })
}

export function useUpdateAgentDefinition(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateAgentDefinitionRequest) =>
      patch<AgentDefinitionResponse>(ENDPOINTS.ORCHESTRATION.DEFINITION(id), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'definitions'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.orchestrationDefinition(id) })
    },
  })
}

export function useDeleteAgentDefinition() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del(ENDPOINTS.ORCHESTRATION.DEFINITION(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'definitions'] })
    },
  })
}

// ============================================
// Agent Invocation
// ============================================

export function useInvokeOrchestrator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InvokeAgentRequest) =>
      post<InvokeAgentResponse>(ENDPOINTS.ORCHESTRATION.INVOKE, data),
    onSuccess: () => {
      // Invalidate executions and approvals as new ones may have been created
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'executions'] })
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'approvals'] })
    },
  })
}

export function useInvokeAgent(definitionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InvokeAgentRequest) =>
      post<InvokeAgentResponse>(ENDPOINTS.ORCHESTRATION.INVOKE_AGENT(definitionId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'executions'] })
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'approvals'] })
    },
  })
}

export function useInvokeAgentByType(agentType: AgentDefinitionType) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: InvokeAgentRequest) =>
      post<InvokeAgentResponse>(ENDPOINTS.ORCHESTRATION.INVOKE_BY_TYPE(agentType), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'executions'] })
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'approvals'] })
    },
  })
}

// ============================================
// Executions
// ============================================

export function useExecutions(filters?: {
  status?: 'running' | 'awaiting_approval' | 'completed' | 'failed'
  agentDefinitionId?: string
  limit?: number
  offset?: number
}) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationExecutions(undefined, filters),
    queryFn: () => {
      const params = new URLSearchParams()
      if (filters?.status) params.set('status', filters.status)
      if (filters?.agentDefinitionId) params.set('agentDefinitionId', filters.agentDefinitionId)
      if (filters?.limit) params.set('limit', String(filters.limit))
      if (filters?.offset) params.set('offset', String(filters.offset))
      const query = params.toString() ? `?${params.toString()}` : ''
      return get<AgentExecutionListResponse>(`${ENDPOINTS.ORCHESTRATION.EXECUTIONS}${query}`)
    },
  })
}

export function useExecution(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationExecution(id),
    queryFn: () => get<AgentExecutionResponse>(ENDPOINTS.ORCHESTRATION.EXECUTION(id!)),
    enabled: !!id,
  })
}

export function useExecutionChildren(executionId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationExecutionChildren(executionId),
    queryFn: () =>
      get<{ executions: AgentExecutionResponse[]; total: number }>(
        ENDPOINTS.ORCHESTRATION.EXECUTION_CHILDREN(executionId!),
      ),
    enabled: !!executionId,
  })
}

// ============================================
// Approvals
// ============================================

export function usePendingApprovals(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationApprovals(undefined),
    queryFn: () => {
      const params = new URLSearchParams()
      if (options?.limit) params.set('limit', String(options.limit))
      if (options?.offset) params.set('offset', String(options.offset))
      const query = params.toString() ? `?${params.toString()}` : ''
      return get<AgentApprovalListResponse>(`${ENDPOINTS.ORCHESTRATION.APPROVALS}${query}`)
    },
    refetchInterval: 30000, // Poll every 30 seconds for new approvals
  })
}

export function useApproval(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationApproval(id),
    queryFn: () => get<AgentApprovalResponse>(ENDPOINTS.ORCHESTRATION.APPROVAL(id!)),
    enabled: !!id,
  })
}

export function useRespondToApproval(approvalId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: RespondToApprovalRequest) =>
      post<AgentApprovalResponse>(ENDPOINTS.ORCHESTRATION.APPROVAL_RESPOND(approvalId), data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'executions'] })
    },
  })
}

export function useBatchRespondToApprovals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: BatchRespondToApprovalsRequest) =>
      post<{ success: boolean; count: number }>(ENDPOINTS.ORCHESTRATION.APPROVALS_BATCH, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'approvals'] })
      queryClient.invalidateQueries({ queryKey: ['orchestration', 'executions'] })
    },
  })
}

// ============================================
// Tools
// ============================================

interface AgentToolResponse {
  id: string
  organizationId: string | null
  name: string
  description: string
  category: string
  parameters: Record<string, unknown>
  handler: string
  requiresApproval: boolean
  isSystem: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export function useOrchestrationTools(category?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.orchestrationTools(undefined, category),
    queryFn: () => {
      const endpoint = category
        ? ENDPOINTS.ORCHESTRATION.TOOLS_BY_CATEGORY(category)
        : ENDPOINTS.ORCHESTRATION.TOOLS
      return get<{ tools: AgentToolResponse[]; total: number }>(endpoint)
    },
  })
}

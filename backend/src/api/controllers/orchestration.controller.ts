/**
 * Orchestration Controller
 * Handles API requests for the AI agent orchestration framework
 */

import { Response } from 'express'
import { AuthRequest } from '@/types/handlers'
import * as orchestrationService from '@/services/agentOrchestration.service'
import * as agentToolRepo from '@/repositories/agentTool.repository'
import * as agentApprovalRepo from '@/repositories/agentApproval.repository'
import type {
  CreateAgentDefinitionRequest,
  UpdateAgentDefinitionRequest,
  InvokeOrchestratorRequest,
  InvokeAgentRequest,
  RespondToApprovalRequest,
  BatchRespondToApprovalsRequest,
  DefinitionIdParam,
  ExecutionIdParam,
  ApprovalIdParam,
  AgentDefinitionType,
} from '@shared/types/src/requests/leadAgent'

// ============================================
// Agent Definitions
// ============================================

export const createDefinition = async (
  req: AuthRequest<CreateAgentDefinitionRequest>,
  res: Response,
) => {
  const definition = await orchestrationService.createAgentDefinition(
    req.organizationId!,
    req.validated,
  )
  return res.status(201).json(definition)
}

export const listDefinitions = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const type = req.query.type as AgentDefinitionType | undefined
  const isActive =
    req.query.isActive === 'true'
      ? true
      : req.query.isActive === 'false'
        ? false
        : undefined

  const definitions = await orchestrationService.listAgentDefinitions(
    req.organizationId!,
    { type, isActive },
  )
  return res.json({
    definitions,
    total: definitions.length,
  })
}

export const getDefinition = async (
  req: AuthRequest<DefinitionIdParam>,
  res: Response,
) => {
  const definition = await orchestrationService.getAgentDefinition(
    req.params.definitionId,
    req.organizationId!,
  )
  if (!definition) {
    return res.status(404).json({ error: 'Agent definition not found' })
  }
  return res.json(definition)
}

export const updateDefinition = async (
  req: AuthRequest<UpdateAgentDefinitionRequest & DefinitionIdParam>,
  res: Response,
) => {
  const definition = await orchestrationService.updateAgentDefinition(
    req.params.definitionId,
    req.organizationId!,
    req.validated,
  )
  return res.json(definition)
}

export const deleteDefinition = async (
  req: AuthRequest<DefinitionIdParam>,
  res: Response,
) => {
  await orchestrationService.deleteAgentDefinition(
    req.params.definitionId,
    req.organizationId!,
  )
  return res.status(204).send()
}

// ============================================
// Agent Invocation
// ============================================

export const invokeOrchestrator = async (
  req: AuthRequest<InvokeOrchestratorRequest>,
  res: Response,
) => {
  const result = await orchestrationService.invokeOrchestrator(
    req.organizationId!,
    {
      prompt: req.validated.prompt,
      context: req.validated.context,
      leadId: req.validated.leadId,
      campaignId: req.validated.campaignId,
    },
  )
  return res.json(result)
}

export const invokeAgent = async (
  req: AuthRequest<InvokeAgentRequest & DefinitionIdParam>,
  res: Response,
) => {
  const result = await orchestrationService.invokeAgent(
    req.organizationId!,
    req.params.definitionId,
    {
      prompt: req.validated.prompt,
      context: req.validated.context,
      leadId: req.validated.leadId,
      campaignId: req.validated.campaignId,
    },
  )
  return res.json(result)
}

export const invokeByType = async (
  req: AuthRequest<InvokeAgentRequest & { agentType: AgentDefinitionType }>,
  res: Response,
) => {
  const result = await orchestrationService.callSpecializedAgent(
    req.organizationId!,
    req.params.agentType as AgentDefinitionType,
    {
      prompt: req.validated.prompt,
      context: req.validated.context,
      leadId: req.validated.leadId,
      campaignId: req.validated.campaignId,
    },
  )
  return res.json(result)
}

// ============================================
// Executions
// ============================================

export const listExecutions = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const status = req.query.status as
    | 'running'
    | 'awaiting_approval'
    | 'completed'
    | 'failed'
    | undefined
  const agentDefinitionId = req.query.agentDefinitionId as string | undefined
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0

  const executions = await orchestrationService.listExecutions(
    req.organizationId!,
    { status, agentDefinitionId },
    { limit, offset },
  )

  return res.json({
    executions,
    total: executions.length,
    hasMore: executions.length === limit,
  })
}

export const getExecution = async (
  req: AuthRequest<ExecutionIdParam>,
  res: Response,
) => {
  const execution = await orchestrationService.getExecution(
    req.params.executionId,
    req.organizationId!,
  )
  if (!execution) {
    return res.status(404).json({ error: 'Execution not found' })
  }
  return res.json(execution)
}

export const getChildExecutions = async (
  req: AuthRequest<ExecutionIdParam>,
  res: Response,
) => {
  const children = await orchestrationService.getChildExecutions(
    req.params.executionId,
  )
  return res.json({
    executions: children,
    total: children.length,
  })
}

// ============================================
// Approvals
// ============================================

export const listPendingApprovals = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0

  const approvals = await orchestrationService.listPendingApprovals(
    req.organizationId!,
    { limit, offset },
  )

  return res.json({
    approvals,
    total: approvals.length,
    hasMore: approvals.length === limit,
  })
}

export const getApproval = async (
  req: AuthRequest<ApprovalIdParam>,
  res: Response,
) => {
  const approval = await agentApprovalRepo.findByIdWithDetails(
    req.params.approvalId,
  )
  if (!approval || approval.organizationId !== req.organizationId) {
    return res.status(404).json({ error: 'Approval not found' })
  }
  return res.json(approval)
}

export const respondToApproval = async (
  req: AuthRequest<RespondToApprovalRequest & ApprovalIdParam>,
  res: Response,
) => {
  const approval = await orchestrationService.respondToApproval(
    req.params.approvalId,
    req.organizationId!,
    req.user.id,
    req.validated.response,
    {
      note: req.validated.note,
      modifications: req.validated.modifications,
    },
  )
  return res.json(approval)
}

export const batchRespondToApprovals = async (
  req: AuthRequest<BatchRespondToApprovalsRequest>,
  res: Response,
) => {
  await orchestrationService.batchRespondToApprovals(
    req.organizationId!,
    req.user.id,
    req.validated.approvalIds,
    req.validated.response,
    req.validated.note,
  )
  return res.json({ success: true, count: req.validated.approvalIds.length })
}

// ============================================
// Tools
// ============================================

export const listTools = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const tools = await agentToolRepo.findAllForOrganization(req.organizationId!)
  return res.json({
    tools: tools.map((t) => ({
      ...t,
      parameters:
        typeof t.parameters === 'string'
          ? JSON.parse(t.parameters)
          : t.parameters,
    })),
    total: tools.length,
  })
}

export const listToolsByCategory = async (
  req: AuthRequest<{ category: string }>,
  res: Response,
) => {
  const category = req.params.category as
    | 'email'
    | 'sms'
    | 'research'
    | 'crm'
    | 'analytics'
    | 'campaign'
    | 'orchestrator'
  const tools = await agentToolRepo.findByCategory(
    category,
    req.organizationId!,
  )
  return res.json({
    tools: tools.map((t) => ({
      ...t,
      parameters:
        typeof t.parameters === 'string'
          ? JSON.parse(t.parameters)
          : t.parameters,
    })),
    total: tools.length,
  })
}

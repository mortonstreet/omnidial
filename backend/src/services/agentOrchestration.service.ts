/**
 * Agent Orchestration Service
 *
 * Manages the execution of specialized AI agents through a prompt-driven interface.
 * Each agent (email, SMS, research, etc.) is called as a tool by the orchestrator.
 */

import Anthropic from '@anthropic-ai/sdk'
import { config } from '@/config'
import * as agentDefinitionRepo from '@/repositories/agentDefinition.repository'
import * as agentExecutionRepo from '@/repositories/agentExecution.repository'
import * as agentApprovalRepo from '@/repositories/agentApproval.repository'
import * as agentToolRepo from '@/repositories/agentTool.repository'
import logger from '@/lib/logger'
import type {
  AgentDefinitionType,
  CreateAgentDefinitionInput,
  UpdateAgentDefinitionInput,
} from '@/repositories/agentDefinition.repository'
import type { ApprovalType } from '@/repositories/agentApproval.repository'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Model mapping
const MODEL_MAP: Record<string, string> = {
  'claude-haiku': 'claude-3-5-haiku-20241022',
  'claude-sonnet': 'claude-sonnet-4-20250514',
  'claude-opus': 'claude-opus-4-20250514',
}

// Token pricing (per 1M tokens)
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku': { input: 0.25, output: 1.25 },
  'claude-sonnet': { input: 3.0, output: 15.0 },
  'claude-opus': { input: 15.0, output: 75.0 },
}

// Types
export interface InvokeAgentRequest {
  prompt: string
  context?: Record<string, unknown>
  leadId?: string
  campaignId?: string
  parentExecutionId?: string
}

export interface InvokeAgentResponse {
  executionId: string
  status: 'completed' | 'awaiting_approval' | 'failed'
  response?: string
  toolCalls?: ToolCallResult[]
  pendingApprovals?: PendingApproval[]
  error?: string
  metrics: {
    tokensInput: number
    tokensOutput: number
    durationMs: number
    estimatedCost: number
  }
}

export interface ToolCallResult {
  toolName: string
  input: unknown
  output: unknown
  requiresApproval: boolean
  approvalId?: string
}

export interface PendingApproval {
  id: string
  type: ApprovalType
  summary: string
  details: unknown
}

// ============================================
// Agent Definition Management
// ============================================

export async function createAgentDefinition(
  organizationId: string,
  data: Omit<CreateAgentDefinitionInput, 'organizationId'>,
) {
  const definition = await agentDefinitionRepo.create({
    ...data,
    organizationId,
  })

  logger.info(
    { agentDefinitionId: definition.id, type: data.type },
    'Created agent definition',
  )

  return transformDefinition(definition)
}

export async function getAgentDefinition(id: string, organizationId: string) {
  const definition = await agentDefinitionRepo.findById(id)
  if (!definition || definition.organizationId !== organizationId) {
    return null
  }
  return transformDefinition(definition)
}

export async function listAgentDefinitions(
  organizationId: string,
  filters?: { type?: AgentDefinitionType; isActive?: boolean },
) {
  const definitions = await agentDefinitionRepo.findByOrganizationId(
    organizationId,
    filters,
  )
  return definitions.map(transformDefinition)
}

export async function updateAgentDefinition(
  id: string,
  organizationId: string,
  data: UpdateAgentDefinitionInput,
) {
  const existing = await agentDefinitionRepo.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent definition not found')
  }

  // Don't allow modifying system agents
  if (existing.isSystem && !data.isActive) {
    throw new Error('Cannot modify system agent definitions')
  }

  const updated = await agentDefinitionRepo.update(id, data)
  return transformDefinition(updated)
}

export async function deleteAgentDefinition(
  id: string,
  organizationId: string,
) {
  const existing = await agentDefinitionRepo.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent definition not found')
  }

  if (existing.isSystem) {
    throw new Error('Cannot delete system agent definitions')
  }

  await agentDefinitionRepo.deleteById(id)
}

// ============================================
// Agent Invocation
// ============================================

export async function invokeAgent(
  organizationId: string,
  agentDefinitionId: string,
  request: InvokeAgentRequest,
): Promise<InvokeAgentResponse> {
  const startTime = Date.now()

  // Get agent definition
  const definition = await agentDefinitionRepo.findById(agentDefinitionId)
  if (!definition || definition.organizationId !== organizationId) {
    throw new Error('Agent definition not found')
  }

  if (!definition.isActive) {
    throw new Error('Agent is not active')
  }

  // Create execution record
  const execution = await agentExecutionRepo.create({
    organizationId,
    agentDefinitionId,
    triggerType: request.parentExecutionId ? 'orchestrator' : 'user',
    triggerContext: request.context,
    parentExecutionId: request.parentExecutionId,
    inputPrompt: request.prompt,
    inputContext: request.context,
    leadId: request.leadId,
    campaignId: request.campaignId,
  })

  try {
    // Build system prompt with context
    const systemPrompt = interpolatePrompt(definition.systemPrompt, {
      ...request.context,
      organizationId,
    })

    // Get tools for this agent
    const tools = parseTools(definition.tools)
    const anthropicTools = await buildAnthropicTools(tools, organizationId)

    // Call Claude
    const modelId = MODEL_MAP[definition.model] || MODEL_MAP['claude-sonnet']
    const response = await anthropic.messages.create({
      model: modelId,
      max_tokens: definition.maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: request.prompt }],
      tools: anthropicTools.length > 0 ? anthropicTools : undefined,
    })

    // Process response
    const toolCalls: ToolCallResult[] = []
    const pendingApprovals: PendingApproval[] = []
    let textResponse = ''

    for (const content of response.content) {
      if (content.type === 'text') {
        textResponse += content.text
      } else if (content.type === 'tool_use') {
        const toolResult = await executeToolCall(
          organizationId,
          execution.id,
          content.name,
          content.input,
          request,
        )
        toolCalls.push(toolResult)

        if (toolResult.requiresApproval && toolResult.approvalId) {
          const approval = await agentApprovalRepo.findById(
            toolResult.approvalId,
          )
          if (approval) {
            pendingApprovals.push({
              id: approval.id,
              type: approval.approvalType as ApprovalType,
              summary: approval.actionSummary,
              details: JSON.parse(approval.actionDetails as string),
            })
          }
        }
      }
    }

    // Calculate metrics
    const durationMs = Date.now() - startTime
    const tokensInput = response.usage.input_tokens
    const tokensOutput = response.usage.output_tokens
    const pricing =
      TOKEN_PRICING[definition.model] || TOKEN_PRICING['claude-sonnet']
    const estimatedCost =
      (tokensInput * pricing.input + tokensOutput * pricing.output) / 1_000_000

    // Determine final status
    const status =
      pendingApprovals.length > 0 ? 'awaiting_approval' : 'completed'

    // Update execution record
    await agentExecutionRepo.update(execution.id, {
      status,
      outputResponse: textResponse,
      outputToolCalls: toolCalls,
      tokensInput,
      tokensOutput,
      durationMs,
      estimatedCost,
      completedAt: status === 'completed' ? new Date() : undefined,
    })

    logger.info(
      {
        executionId: execution.id,
        agentType: definition.type,
        status,
        tokensInput,
        tokensOutput,
        durationMs,
      },
      'Agent execution completed',
    )

    return {
      executionId: execution.id,
      status,
      response: textResponse,
      toolCalls,
      pendingApprovals:
        pendingApprovals.length > 0 ? pendingApprovals : undefined,
      metrics: {
        tokensInput,
        tokensOutput,
        durationMs,
        estimatedCost,
      },
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    await agentExecutionRepo.markFailed(execution.id, errorMessage)

    logger.error(
      { executionId: execution.id, error: errorMessage },
      'Agent execution failed',
    )

    return {
      executionId: execution.id,
      status: 'failed',
      error: errorMessage,
      metrics: {
        tokensInput: 0,
        tokensOutput: 0,
        durationMs: Date.now() - startTime,
        estimatedCost: 0,
      },
    }
  }
}

// ============================================
// Orchestrator-Specific Functions
// ============================================

export async function invokeOrchestrator(
  organizationId: string,
  request: InvokeAgentRequest,
): Promise<InvokeAgentResponse> {
  // Find the orchestrator agent for this organization
  const orchestrator = await agentDefinitionRepo.findByType(
    organizationId,
    'orchestrator',
  )

  if (!orchestrator) {
    throw new Error('No orchestrator configured for this organization')
  }

  return invokeAgent(organizationId, orchestrator.id, request)
}

export async function callSpecializedAgent(
  organizationId: string,
  agentType: AgentDefinitionType,
  request: InvokeAgentRequest,
): Promise<InvokeAgentResponse> {
  const agent = await agentDefinitionRepo.findByType(organizationId, agentType)

  if (!agent) {
    throw new Error(`No ${agentType} agent configured for this organization`)
  }

  return invokeAgent(organizationId, agent.id, request)
}

// ============================================
// Execution Management
// ============================================

export async function getExecution(
  executionId: string,
  organizationId: string,
) {
  const execution = await agentExecutionRepo.findByIdWithDefinition(executionId)
  if (!execution || execution.organizationId !== organizationId) {
    return null
  }
  return execution
}

export async function listExecutions(
  organizationId: string,
  filters?: {
    status?: 'running' | 'awaiting_approval' | 'completed' | 'failed'
    agentDefinitionId?: string
  },
  pagination?: { limit: number; offset: number },
) {
  const dbPagination = pagination
    ? {
        page: Math.floor(pagination.offset / pagination.limit) + 1,
        limit: pagination.limit,
        offset: pagination.offset,
      }
    : undefined
  return agentExecutionRepo.findByOrganizationId(
    organizationId,
    filters,
    dbPagination,
  )
}

export async function getChildExecutions(executionId: string) {
  return agentExecutionRepo.findChildExecutions(executionId)
}

// ============================================
// Approval Management
// ============================================

export async function listPendingApprovals(
  organizationId: string,
  pagination?: { limit: number; offset: number },
) {
  const dbPagination = pagination
    ? {
        page: Math.floor(pagination.offset / pagination.limit) + 1,
        limit: pagination.limit,
        offset: pagination.offset,
      }
    : undefined
  return agentApprovalRepo.findPendingByOrganization(
    organizationId,
    dbPagination,
  )
}

export async function respondToApproval(
  approvalId: string,
  organizationId: string,
  userId: string,
  response: 'approved' | 'rejected' | 'modified',
  options?: {
    note?: string
    modifications?: unknown
  },
) {
  const approval = await agentApprovalRepo.findById(approvalId)
  if (!approval || approval.organizationId !== organizationId) {
    throw new Error('Approval not found')
  }

  if (approval.status !== 'pending') {
    throw new Error('Approval has already been processed')
  }

  const updated = await agentApprovalRepo.respond(approvalId, {
    respondedById: userId,
    response,
    responseNote: options?.note,
    modifications: options?.modifications,
  })

  // If approved, resume the execution
  if (response === 'approved' || response === 'modified') {
    await resumeExecutionAfterApproval(
      approval.executionId,
      response === 'modified' ? options?.modifications : undefined,
    )
  }

  // Update the parent execution status
  const execution = await agentExecutionRepo.findById(approval.executionId)
  if (execution && response === 'rejected') {
    await agentExecutionRepo.update(approval.executionId, {
      status: 'cancelled',
      completedAt: new Date(),
    })
  }

  logger.info(
    { approvalId, executionId: approval.executionId, response },
    'Approval responded',
  )

  return updated
}

export async function batchRespondToApprovals(
  organizationId: string,
  userId: string,
  approvalIds: string[],
  response: 'approved' | 'rejected',
  note?: string,
) {
  // Verify all approvals belong to the organization
  for (const id of approvalIds) {
    const approval = await agentApprovalRepo.findById(id)
    if (!approval || approval.organizationId !== organizationId) {
      throw new Error(`Approval ${id} not found`)
    }
  }

  await agentApprovalRepo.batchRespond(approvalIds, {
    respondedById: userId,
    response,
    responseNote: note,
  })

  // Resume executions for approved items
  if (response === 'approved') {
    for (const id of approvalIds) {
      const approval = await agentApprovalRepo.findById(id)
      if (approval) {
        await resumeExecutionAfterApproval(approval.executionId)
      }
    }
  }

  logger.info(
    { approvalIds, response, count: approvalIds.length },
    'Batch approval responded',
  )
}

// ============================================
// Helper Functions
// ============================================

async function executeToolCall(
  organizationId: string,
  executionId: string,
  toolName: string,
  input: unknown,
  context: InvokeAgentRequest,
): Promise<ToolCallResult> {
  // Get tool definition
  const tool = await agentToolRepo.findByName(toolName, organizationId)

  if (!tool) {
    return {
      toolName,
      input,
      output: { error: `Unknown tool: ${toolName}` },
      requiresApproval: false,
    }
  }

  // Check if approval is required
  if (tool.requiresApproval) {
    const approval = await agentApprovalRepo.create({
      organizationId,
      executionId,
      approvalType: getApprovalType(toolName),
      actionSummary: `${toolName} requested`,
      actionDetails: input,
      leadId: context.leadId,
      campaignId: context.campaignId,
    })

    return {
      toolName,
      input,
      output: { status: 'pending_approval', approvalId: approval.id },
      requiresApproval: true,
      approvalId: approval.id,
    }
  }

  // Execute the tool
  try {
    const output = await executeToolHandler(tool.handler, input, {
      organizationId,
      executionId,
      leadId: context.leadId,
      campaignId: context.campaignId,
    })

    return {
      toolName,
      input,
      output,
      requiresApproval: false,
    }
  } catch (error) {
    return {
      toolName,
      input,
      output: {
        error: error instanceof Error ? error.message : 'Tool execution failed',
      },
      requiresApproval: false,
    }
  }
}

async function executeToolHandler(
  handler: string,
  input: unknown,
  context: {
    organizationId: string
    executionId: string
    leadId?: string
    campaignId?: string
  },
): Promise<unknown> {
  // Handler format: "serviceName.methodName" (e.g., "agentTools.draftEmail")
  const [serviceName, methodName] = handler.split('.')

  // Build tool context
  const toolContext = {
    organizationId: context.organizationId,
    agentId: context.executionId, // Use execution ID as agent context
    sessionId: context.executionId,
  }

  if (serviceName === 'agentTools') {
    const { toolHandlers } = await import('@/services/agentTools.service')

    // Try both camelCase and the exact method name
    const handlerFn = toolHandlers[methodName]
    if (handlerFn) {
      return handlerFn(toolContext, input)
    }

    throw new Error(`Tool handler not found: ${handler}`)
  }

  if (serviceName === 'agentOrchestration') {
    // Handle orchestration-specific tools
    if (methodName === 'callSpecializedAgent') {
      const agentInput = input as {
        agentType: AgentDefinitionType
        prompt: string
        context?: Record<string, unknown>
        leadId?: string
        campaignId?: string
      }
      return callSpecializedAgent(
        context.organizationId,
        agentInput.agentType,
        {
          prompt: agentInput.prompt,
          context: agentInput.context,
          leadId: agentInput.leadId || context.leadId,
          campaignId: agentInput.campaignId || context.campaignId,
          parentExecutionId: context.executionId,
        },
      )
    }

    if (methodName === 'requestApproval') {
      // Create an approval request
      const approvalInput = input as {
        approvalType: ApprovalType
        summary: string
        details: unknown
        leadId?: string
        campaignId?: string
      }

      const approval = await agentApprovalRepo.create({
        organizationId: context.organizationId,
        executionId: context.executionId,
        approvalType: approvalInput.approvalType,
        actionSummary: approvalInput.summary,
        actionDetails: approvalInput.details,
        leadId: approvalInput.leadId || context.leadId,
        campaignId: approvalInput.campaignId || context.campaignId,
      })

      return { approvalId: approval.id, status: 'pending_approval' }
    }

    throw new Error(`Orchestration handler not found: ${methodName}`)
  }

  throw new Error(`Unknown service: ${serviceName}`)
}

async function buildAnthropicTools(
  toolNames: string[],
  organizationId: string,
): Promise<Anthropic.Tool[]> {
  const tools: Anthropic.Tool[] = []

  for (const name of toolNames) {
    const tool = await agentToolRepo.findByName(name, organizationId)
    if (tool) {
      const parameters =
        typeof tool.parameters === 'string'
          ? JSON.parse(tool.parameters)
          : tool.parameters

      tools.push({
        name: tool.name,
        description: tool.description,
        input_schema: parameters,
      })
    }
  }

  return tools
}

function parseTools(tools: unknown): string[] {
  if (typeof tools === 'string') {
    try {
      return JSON.parse(tools)
    } catch {
      return []
    }
  }
  if (Array.isArray(tools)) {
    return tools
  }
  return []
}

function interpolatePrompt(
  template: string,
  context: Record<string, unknown>,
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const keys = path.split('.')
    let value: unknown = context

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = (value as Record<string, unknown>)[key]
      } else {
        return match // Keep original if not found
      }
    }

    return String(value ?? match)
  })
}

function getApprovalType(toolName: string): ApprovalType {
  if (toolName.includes('email')) return 'send_email'
  if (toolName.includes('sms')) return 'send_sms'
  if (toolName.includes('campaign')) return 'create_campaign'
  return 'bulk_action'
}

async function resumeExecutionAfterApproval(
  executionId: string,
  modifications?: unknown,
) {
  // TODO: Implement execution resumption
  // This would re-invoke the agent with the approved context
  logger.info(
    { executionId, hasModifications: !!modifications },
    'Resuming execution after approval',
  )
}

function transformDefinition(
  definition: Awaited<ReturnType<typeof agentDefinitionRepo.findById>>,
) {
  if (!definition) return null

  return {
    id: definition.id,
    organizationId: definition.organizationId,
    name: definition.name,
    type: definition.type,
    description: definition.description,
    systemPrompt: definition.systemPrompt,
    tools: parseTools(definition.tools),
    guardrails:
      typeof definition.guardrails === 'string'
        ? JSON.parse(definition.guardrails)
        : definition.guardrails,
    model: definition.model,
    maxTokens: definition.maxTokens,
    temperature: Number(definition.temperature),
    isActive: definition.isActive,
    isSystem: definition.isSystem,
    createdAt: definition.createdAt.toISOString(),
    updatedAt: definition.updatedAt.toISOString(),
  }
}

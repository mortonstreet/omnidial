/**
 * Agent Workflow Service
 * Manages workflow definitions and execution for AI SDR agents
 */

import * as agentRepo from '@/repositories/agent.repository'
import * as agentWorkflowRepo from '@/repositories/agentWorkflow.repository'
import * as leadQualificationService from './leadQualification.service'
import * as agentEmailService from './agentEmail.service'
import * as agentSmsService from './agentSms.service'
import type {
  CreateAgentWorkflowRequest,
  UpdateAgentWorkflowRequest,
  AgentWorkflowResponse,
} from '@shared/types/src/requests/leadAgent'
import { db } from '@/lib/db'

/**
 * Create a new workflow
 */
export async function createWorkflow(
  agentId: string,
  organizationId: string,
  data: CreateAgentWorkflowRequest,
): Promise<AgentWorkflowResponse> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const workflow = await agentWorkflowRepo.create({
    agentId,
    name: data.name,
    triggerType: data.triggerType,
    triggerConfig: data.triggerConfig as Record<string, unknown>,
    actionType: data.actionType,
    actionConfig: data.actionConfig as Record<string, unknown>,
    targetType: data.targetType,
    targetId: data.targetId || null,
    targetFilters: data.targetFilters,
    isActive: data.isActive,
  })

  return transformWorkflow(workflow)
}

/**
 * Get a workflow by ID
 */
export async function getWorkflowById(
  workflowId: string,
  agentId: string,
  organizationId: string,
): Promise<AgentWorkflowResponse | null> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const workflow = await agentWorkflowRepo.findById(workflowId)
  if (!workflow || workflow.agentId !== agentId) {
    return null
  }

  return transformWorkflow(workflow)
}

/**
 * List workflows for an agent
 */
export async function listWorkflows(
  agentId: string,
  organizationId: string,
  filters?: { isActive?: boolean },
): Promise<AgentWorkflowResponse[]> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  let workflows: Awaited<ReturnType<typeof agentWorkflowRepo.findByAgentId>>

  if (filters?.isActive === true) {
    workflows = await agentWorkflowRepo.findActiveByAgentId(agentId)
  } else {
    workflows = await agentWorkflowRepo.findByAgentId(agentId)
    if (filters?.isActive === false) {
      workflows = workflows.filter((w) => !w.isActive)
    }
  }

  return workflows.map(transformWorkflow)
}

/**
 * Update a workflow
 */
export async function updateWorkflow(
  workflowId: string,
  agentId: string,
  organizationId: string,
  data: UpdateAgentWorkflowRequest,
): Promise<AgentWorkflowResponse> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const existing = await agentWorkflowRepo.findById(workflowId)
  if (!existing || existing.agentId !== agentId) {
    throw new Error('Workflow not found')
  }

  const updated = await agentWorkflowRepo.update(workflowId, {
    name: data.name,
    triggerType: data.triggerType,
    triggerConfig: data.triggerConfig as Record<string, unknown> | undefined,
    actionType: data.actionType,
    actionConfig: data.actionConfig as Record<string, unknown> | undefined,
    targetType: data.targetType,
    targetId: data.targetId,
    targetFilters: data.targetFilters,
    isActive: data.isActive,
  })

  return transformWorkflow(updated)
}

/**
 * Activate a workflow
 */
export async function activateWorkflow(
  workflowId: string,
  agentId: string,
  organizationId: string,
): Promise<AgentWorkflowResponse> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const existing = await agentWorkflowRepo.findById(workflowId)
  if (!existing || existing.agentId !== agentId) {
    throw new Error('Workflow not found')
  }

  const updated = await agentWorkflowRepo.activate(workflowId)
  return transformWorkflow(updated)
}

/**
 * Deactivate a workflow
 */
export async function deactivateWorkflow(
  workflowId: string,
  agentId: string,
  organizationId: string,
): Promise<AgentWorkflowResponse> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const existing = await agentWorkflowRepo.findById(workflowId)
  if (!existing || existing.agentId !== agentId) {
    throw new Error('Workflow not found')
  }

  const updated = await agentWorkflowRepo.deactivate(workflowId)
  return transformWorkflow(updated)
}

/**
 * Delete a workflow
 */
export async function deleteWorkflow(
  workflowId: string,
  agentId: string,
  organizationId: string,
): Promise<void> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const existing = await agentWorkflowRepo.findById(workflowId)
  if (!existing || existing.agentId !== agentId) {
    throw new Error('Workflow not found')
  }

  await agentWorkflowRepo.deleteById(workflowId)
}

/**
 * Manually execute a workflow
 */
export async function executeWorkflow(
  workflowId: string,
  agentId: string,
  organizationId: string,
): Promise<{
  success: boolean
  processed: number
  errors: string[]
}> {
  const agent = await agentRepo.findById(agentId)
  if (!agent || agent.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const workflow = await agentWorkflowRepo.findById(workflowId)
  if (!workflow || workflow.agentId !== agentId) {
    throw new Error('Workflow not found')
  }

  // Get target leads
  const leads = await getWorkflowTargetLeads(
    organizationId,
    workflow.targetType,
    workflow.targetId,
    workflow.targetFilters ? JSON.parse(workflow.targetFilters as string) : {},
  )

  const errors: string[] = []
  let processed = 0

  // Process each lead
  for (const lead of leads) {
    try {
      await executeWorkflowForLead(agent, workflow, lead, organizationId)
      processed++
    } catch (error) {
      errors.push(
        `Lead ${lead.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  // Update execution count
  await agentWorkflowRepo.incrementExecutionCount(workflowId)

  return {
    success: errors.length === 0,
    processed,
    errors,
  }
}

/**
 * Handle workflow trigger event
 */
export async function handleWorkflowTrigger(
  eventType: string,
  payload: {
    organizationId: string
    leadId?: string
    qualificationId?: string
  },
): Promise<void> {
  // Find all active workflows that match this trigger
  const agents = await agentRepo.findActiveByOrganizationId(
    payload.organizationId,
  )

  for (const agent of agents) {
    const workflows = await agentWorkflowRepo.findActiveByAgentId(agent.id)

    for (const workflow of workflows) {
      const triggerConfig = JSON.parse(workflow.triggerConfig as string)

      // Check if this workflow should trigger
      if (
        workflow.triggerType === 'event' &&
        triggerConfig.type === 'event' &&
        triggerConfig.eventType === eventType
      ) {
        try {
          // Get the lead
          const lead = payload.leadId
            ? await db
                .selectFrom('lead')
                .where('id', '=', payload.leadId)
                .where('organizationId', '=', payload.organizationId)
                .where('deletedAt', 'is', null)
                .selectAll()
                .executeTakeFirst()
            : null

          if (lead) {
            await executeWorkflowForLead(
              agent,
              workflow,
              lead,
              payload.organizationId,
            )
            await agentWorkflowRepo.incrementExecutionCount(workflow.id)
          }
        } catch (error) {
          console.error(`Workflow ${workflow.id} execution failed:`, error)
        }
      }
    }
  }
}

// Helper functions

async function getWorkflowTargetLeads(
  organizationId: string,
  targetType: string,
  targetId: string | null,
  targetFilters: Record<string, unknown>,
): Promise<
  Array<{
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    company: string | null
  }>
> {
  let query = db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .select(['id', 'firstName', 'lastName', 'email', 'phone', 'company'])

  switch (targetType) {
    case 'campaign':
      if (!targetId) break
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom('campaign_lead')
            .whereRef('campaign_lead.leadId', '=', 'lead.id')
            .where('campaign_lead.campaignId', '=', targetId),
        ),
      )
      break

    case 'list':
      if (!targetId) break
      query = query.where((eb) =>
        eb.exists(
          eb
            .selectFrom('lead_list_entry')
            .whereRef('lead_list_entry.leadId', '=', 'lead.id')
            .where('lead_list_entry.listId', '=', targetId)
            .where('lead_list_entry.removedAt', 'is', null),
        ),
      )
      break

    case 'lead':
      if (!targetId) break
      query = query.where('id', '=', targetId)
      break
  }

  // Apply additional filters
  if (targetFilters.hasEmail) {
    query = query.where('email', 'is not', null)
  }
  if (targetFilters.hasPhone) {
    query = query.where('phone', 'is not', null)
  }

  return query.limit(100).execute() // Limit for safety
}

async function executeWorkflowForLead(
  agent: NonNullable<Awaited<ReturnType<typeof agentRepo.findById>>>,
  workflow: NonNullable<Awaited<ReturnType<typeof agentWorkflowRepo.findById>>>,
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    company: string | null
  },
  organizationId: string,
): Promise<void> {
  const actionConfig = JSON.parse(workflow.actionConfig as string)

  // Apply delay if configured
  if (actionConfig.delayMinutes && actionConfig.delayMinutes > 0) {
    // In a real implementation, this would schedule the action
    // For now, we execute immediately
  }

  switch (workflow.actionType) {
    case 'send_email':
      if (!lead.email) {
        throw new Error('Lead has no email')
      }
      await agentEmailService.sendEmail(agent.id, organizationId, {
        leadId: lead.id,
        subject: actionConfig.emailTemplate?.subject || 'Hello',
        bodyHtml: actionConfig.emailTemplate?.body || '<p>Hello</p>',
        workflowId: workflow.id,
      })
      break

    case 'send_sms':
      if (!lead.phone) {
        throw new Error('Lead has no phone')
      }
      await agentSmsService.sendSms(agent.id, organizationId, {
        leadId: lead.id,
        body: actionConfig.smsTemplate || 'Hello!',
        workflowId: workflow.id,
      })
      break

    case 'send_both':
      const promises: Promise<unknown>[] = []
      if (lead.email && actionConfig.emailTemplate) {
        promises.push(
          agentEmailService.sendEmail(agent.id, organizationId, {
            leadId: lead.id,
            subject: actionConfig.emailTemplate.subject,
            bodyHtml: actionConfig.emailTemplate.body,
            workflowId: workflow.id,
          }),
        )
      }
      if (lead.phone && actionConfig.smsTemplate) {
        promises.push(
          agentSmsService.sendSms(agent.id, organizationId, {
            leadId: lead.id,
            body: actionConfig.smsTemplate,
            workflowId: workflow.id,
          }),
        )
      }
      await Promise.all(promises)
      break
  }
}

function transformWorkflow(
  workflow: NonNullable<Awaited<ReturnType<typeof agentWorkflowRepo.findById>>>,
): AgentWorkflowResponse {
  return {
    id: workflow.id,
    agentId: workflow.agentId,
    name: workflow.name,
    triggerType: workflow.triggerType,
    triggerConfig: JSON.parse(workflow.triggerConfig as string),
    actionType: workflow.actionType,
    actionConfig: JSON.parse(workflow.actionConfig as string),
    targetType: workflow.targetType,
    targetId: workflow.targetId,
    targetFilters: JSON.parse(workflow.targetFilters as string),
    isActive: workflow.isActive,
    executionCount: workflow.executionCount,
    lastExecutedAt: workflow.lastExecutedAt?.toISOString() || null,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  }
}

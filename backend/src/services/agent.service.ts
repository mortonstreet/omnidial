/**
 * Agent Service
 * Manages AI SDR agent CRUD operations and lifecycle
 */

import { v4 as uuidv4 } from 'uuid'
import { db } from '@/lib/db'
import * as agentRepo from '@/repositories/agent.repository'
import * as agentEmailConfigRepo from '@/repositories/agentEmailConfig.repository'
import * as agentSmsConfigRepo from '@/repositories/agentSmsConfig.repository'
import * as agentWorkflowRepo from '@/repositories/agentWorkflow.repository'
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
  AgentResponse,
  AgentListResponse,
} from '@shared/types/src/requests/leadAgent'

/**
 * Create a new AI SDR agent
 */
export async function createAgent(
  organizationId: string,
  createdById: string,
  data: CreateAgentRequest,
): Promise<AgentResponse> {
  // Create a member account for the agent
  // This allows the agent to appear in the system like a user
  const memberId = uuidv4()

  // Create the agent
  const agent = await agentRepo.create({
    organizationId,
    memberId,
    name: data.name,
    description: data.description || null,
    systemPrompt: data.systemPrompt,
    status: 'inactive',
    emailEnabled: data.emailEnabled,
    smsEnabled: data.smsEnabled,
    dailyEmailLimit: data.dailyEmailLimit,
    dailySmsLimit: data.dailySmsLimit,
    createdById,
  })

  return transformAgent(agent, undefined, undefined)
}

/**
 * Get an agent by ID
 */
export async function getAgentById(
  agentId: string,
  organizationId?: string,
): Promise<AgentResponse | null> {
  const agent = await agentRepo.findById(agentId)
  if (!agent) return null

  // Verify organization if provided
  if (organizationId && agent.organizationId !== organizationId) {
    return null
  }

  // Fetch email and SMS configs
  const [emailConfig, smsConfig] = await Promise.all([
    agentEmailConfigRepo.findByAgentId(agentId),
    agentSmsConfigRepo.findByAgentId(agentId),
  ])

  return transformAgent(agent, emailConfig, smsConfig)
}

/**
 * List all agents for an organization
 */
export async function listAgents(
  organizationId: string,
  filters?: { status?: string },
): Promise<AgentListResponse> {
  let agents: Awaited<ReturnType<typeof agentRepo.findByOrganizationId>>

  if (filters?.status === 'active') {
    agents = await agentRepo.findActiveByOrganizationId(organizationId)
  } else {
    agents = await agentRepo.findByOrganizationId(organizationId)
    if (filters?.status) {
      agents = agents.filter((a) => a.status === filters.status)
    }
  }

  // Fetch configs for all agents
  const agentIds = agents.map((a) => a.id)
  const [emailConfigs, smsConfigs] = await Promise.all([
    Promise.all(agentIds.map((id) => agentEmailConfigRepo.findByAgentId(id))),
    Promise.all(agentIds.map((id) => agentSmsConfigRepo.findByAgentId(id))),
  ])

  const emailConfigMap = new Map(
    emailConfigs.filter(Boolean).map((c) => [c!.agentId, c]),
  )
  const smsConfigMap = new Map(
    smsConfigs.filter(Boolean).map((c) => [c!.agentId, c]),
  )

  return {
    agents: agents.map((agent) =>
      transformAgent(
        agent,
        emailConfigMap.get(agent.id) || undefined,
        smsConfigMap.get(agent.id) || undefined,
      ),
    ),
    total: agents.length,
  }
}

/**
 * Update an agent
 */
export async function updateAgent(
  agentId: string,
  organizationId: string,
  data: UpdateAgentRequest,
): Promise<AgentResponse> {
  // Verify agent belongs to organization
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const updated = await agentRepo.update(agentId, {
    name: data.name,
    description: data.description,
    systemPrompt: data.systemPrompt,
    emailEnabled: data.emailEnabled,
    smsEnabled: data.smsEnabled,
    dailyEmailLimit: data.dailyEmailLimit,
    dailySmsLimit: data.dailySmsLimit,
  })

  const [emailConfig, smsConfig] = await Promise.all([
    agentEmailConfigRepo.findByAgentId(agentId),
    agentSmsConfigRepo.findByAgentId(agentId),
  ])

  return transformAgent(updated, emailConfig, smsConfig)
}

/**
 * Activate an agent
 */
export async function activateAgent(
  agentId: string,
  organizationId: string,
): Promise<AgentResponse> {
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  // Check if agent has required configurations
  const [emailConfig, smsConfig] = await Promise.all([
    agentEmailConfigRepo.findByAgentId(agentId),
    agentSmsConfigRepo.findByAgentId(agentId),
  ])

  if (existing.emailEnabled && !emailConfig?.isVerified) {
    throw new Error('Email configuration must be verified before activating')
  }

  if (existing.smsEnabled && !smsConfig?.isActive) {
    throw new Error('SMS configuration must be active before activating')
  }

  const updated = await agentRepo.activate(agentId)
  return transformAgent(updated, emailConfig, smsConfig)
}

/**
 * Deactivate an agent
 */
export async function deactivateAgent(
  agentId: string,
  organizationId: string,
): Promise<AgentResponse> {
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const updated = await agentRepo.deactivate(agentId)

  const [emailConfig, smsConfig] = await Promise.all([
    agentEmailConfigRepo.findByAgentId(agentId),
    agentSmsConfigRepo.findByAgentId(agentId),
  ])

  return transformAgent(updated, emailConfig, smsConfig)
}

/**
 * Pause an agent
 */
export async function pauseAgent(
  agentId: string,
  organizationId: string,
): Promise<AgentResponse> {
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const updated = await agentRepo.pause(agentId)

  const [emailConfig, smsConfig] = await Promise.all([
    agentEmailConfigRepo.findByAgentId(agentId),
    agentSmsConfigRepo.findByAgentId(agentId),
  ])

  return transformAgent(updated, emailConfig, smsConfig)
}

/**
 * Delete an agent
 */
export async function deleteAgent(
  agentId: string,
  organizationId: string,
): Promise<void> {
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  // Delete related configs and workflows
  await Promise.all([
    agentEmailConfigRepo.deleteByAgentId(agentId),
    agentSmsConfigRepo.deleteByAgentId(agentId),
    agentWorkflowRepo.deleteByAgentId(agentId),
  ])

  // Delete the agent
  await agentRepo.deleteById(agentId)
}

/**
 * Get agent stats
 */
export async function getAgentStats(
  agentId: string,
  organizationId: string,
): Promise<{
  messagesTotal: number
  messagesSentToday: number
  emailsSentToday: number
  smsSentToday: number
  workflowsActive: number
  qualificationsTotal: number
}> {
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [
    messagesTotal,
    emailsSentToday,
    smsSentToday,
    workflows,
    qualifications,
  ] = await Promise.all([
    db
      .selectFrom('agent_message')
      .where('agentId', '=', agentId)
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst(),
    db
      .selectFrom('agent_message')
      .where('agentId', '=', agentId)
      .where('messageType', '=', 'email')
      .where('createdAt', '>=', today)
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst(),
    db
      .selectFrom('agent_message')
      .where('agentId', '=', agentId)
      .where('messageType', '=', 'sms')
      .where('createdAt', '>=', today)
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst(),
    agentWorkflowRepo.findActiveByAgentId(agentId),
    db
      .selectFrom('lead_qualification')
      .where('agentId', '=', agentId)
      .select((eb) => eb.fn.countAll<number>().as('count'))
      .executeTakeFirst(),
  ])

  return {
    messagesTotal: Number(messagesTotal?.count ?? 0),
    messagesSentToday:
      Number(emailsSentToday?.count ?? 0) + Number(smsSentToday?.count ?? 0),
    emailsSentToday: Number(emailsSentToday?.count ?? 0),
    smsSentToday: Number(smsSentToday?.count ?? 0),
    workflowsActive: workflows.length,
    qualificationsTotal: Number(qualifications?.count ?? 0),
  }
}

/**
 * Get agent conversations (messages with lead info)
 */
export async function getAgentConversations(
  agentId: string,
  organizationId: string,
  options: { leadId?: string; limit?: number } = {},
): Promise<{
  messages: Array<{
    id: string
    agentId: string
    workflowId: string | null
    leadId: string
    campaignId: string | null
    messageType: string
    status: string
    emailSubject: string | null
    emailBodyHtml: string | null
    toEmail: string | null
    smsBody: string | null
    toPhone: string | null
    direction: string
    fromPhone: string | null
    deliveredAt: string | null
    openedAt: string | null
    clickedAt: string | null
    failureReason: string | null
    createdAt: string
    lead?: {
      id: string
      firstName: string | null
      lastName: string | null
      email: string | null
      phone: string | null
    }
  }>
  total: number
}> {
  const existing = await agentRepo.findById(agentId)
  if (!existing || existing.organizationId !== organizationId) {
    throw new Error('Agent not found')
  }

  const limit = options.limit || 100

  let messagesQuery = db
    .selectFrom('agent_message')
    .leftJoin('lead', 'lead.id', 'agent_message.leadId')
    .where('agent_message.agentId', '=', agentId)
    .select([
      'agent_message.id',
      'agent_message.agentId',
      'agent_message.workflowId',
      'agent_message.leadId',
      'agent_message.campaignId',
      'agent_message.messageType',
      'agent_message.status',
      'agent_message.emailSubject',
      'agent_message.emailBodyHtml',
      'agent_message.toEmail',
      'agent_message.smsBody',
      'agent_message.toPhone',
      'agent_message.direction',
      'agent_message.fromPhone',
      'agent_message.deliveredAt',
      'agent_message.openedAt',
      'agent_message.clickedAt',
      'agent_message.failureReason',
      'agent_message.createdAt',
      'lead.id as lead_id',
      'lead.firstName as lead_firstName',
      'lead.lastName as lead_lastName',
      'lead.email as lead_email',
      'lead.phone as lead_phone',
    ])
    .orderBy('agent_message.createdAt', 'desc')
    .limit(limit)

  if (options.leadId) {
    messagesQuery = messagesQuery.where(
      'agent_message.leadId',
      '=',
      options.leadId,
    )
  }

  const messages = await messagesQuery.execute()

  // Get total count
  let countQuery = db
    .selectFrom('agent_message')
    .where('agentId', '=', agentId)
    .select((eb) => eb.fn.countAll<number>().as('count'))

  if (options.leadId) {
    countQuery = countQuery.where('leadId', '=', options.leadId)
  }

  const totalResult = await countQuery.executeTakeFirst()

  return {
    messages: messages.map((msg) => ({
      id: msg.id,
      agentId: msg.agentId,
      workflowId: msg.workflowId,
      leadId: msg.leadId,
      campaignId: msg.campaignId,
      messageType: msg.messageType,
      status: msg.status,
      emailSubject: msg.emailSubject,
      emailBodyHtml: msg.emailBodyHtml,
      toEmail: msg.toEmail,
      smsBody: msg.smsBody,
      toPhone: msg.toPhone,
      direction: msg.direction || 'outbound',
      fromPhone: msg.fromPhone,
      deliveredAt: msg.deliveredAt?.toISOString() || null,
      openedAt: msg.openedAt?.toISOString() || null,
      clickedAt: msg.clickedAt?.toISOString() || null,
      failureReason: msg.failureReason,
      createdAt: msg.createdAt.toISOString(),
      lead: msg.lead_id
        ? {
            id: msg.lead_id,
            firstName: msg.lead_firstName,
            lastName: msg.lead_lastName,
            email: msg.lead_email,
            phone: msg.lead_phone,
          }
        : undefined,
    })),
    total: Number(totalResult?.count ?? 0),
  }
}

// Helper function to transform DB record to response type
function transformAgent(
  agent: Awaited<ReturnType<typeof agentRepo.findById>>,
  emailConfig: Awaited<ReturnType<typeof agentEmailConfigRepo.findByAgentId>>,
  smsConfig: Awaited<ReturnType<typeof agentSmsConfigRepo.findByAgentId>>,
): AgentResponse {
  if (!agent) {
    throw new Error('Agent not found')
  }

  return {
    id: agent.id,
    organizationId: agent.organizationId,
    memberId: agent.memberId,
    name: agent.name,
    description: agent.description,
    status: agent.status,
    emailEnabled: agent.emailEnabled,
    smsEnabled: agent.smsEnabled,
    dailyEmailLimit: agent.dailyEmailLimit,
    dailySmsLimit: agent.dailySmsLimit,
    createdById: agent.createdById,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
    emailConfig: emailConfig
      ? {
          id: emailConfig.id,
          agentId: emailConfig.agentId,
          provider: emailConfig.provider,
          fromEmail: emailConfig.fromEmail,
          fromName: emailConfig.fromName,
          isVerified: emailConfig.isVerified,
          createdAt: emailConfig.createdAt.toISOString(),
          updatedAt: emailConfig.updatedAt.toISOString(),
        }
      : null,
    smsConfig: smsConfig
      ? {
          id: smsConfig.id,
          agentId: smsConfig.agentId,
          twilioPhoneNumber: smsConfig.twilioPhoneNumber,
          a2pStatus: smsConfig.a2pStatus,
          aiModel: smsConfig.aiModel,
          aiMaxTokens: smsConfig.aiMaxTokens,
          aiTemperature: smsConfig.aiTemperature,
          isActive: smsConfig.isActive,
          createdAt: smsConfig.createdAt.toISOString(),
          updatedAt: smsConfig.updatedAt.toISOString(),
        }
      : null,
  }
}

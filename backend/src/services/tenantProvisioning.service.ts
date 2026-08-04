/**
 * Tenant Provisioning Service
 *
 * Handles automatic provisioning of OpenClaw agents and resources
 * for new customers. Abstracts infrastructure so customers just
 * configure their agents through the OmniDial UI.
 *
 * Scaling Phases:
 * 1. Single OpenClaw instance with tenant isolation (organizationId)
 * 2. Per-tenant namespaces in Kubernetes
 * 3. Dedicated instances for enterprise customers
 */

import {
  openclawClient,
  AgentConfig,
  AgentInstance,
} from '@/clients/openclaw.client'
import { db } from '@/lib/db'
import { withId, withTimestamps } from '@/repositories/utils'
import { config } from '@/config'

// ============================================
// Types
// ============================================

export interface TenantConfig {
  organizationId: string
  organizationName: string
  plan: 'starter' | 'growth' | 'enterprise'
  settings: {
    maxAgents: number
    maxSessions: number
    memoryEnabled: boolean
    customToolsEnabled: boolean
  }
}

export interface ProvisionedAgent {
  id: string
  organizationId: string
  openclawAgentId: string
  name: string
  type: AgentType
  status: 'provisioning' | 'active' | 'paused' | 'error'
  config: AgentConfig
  createdAt: Date
  updatedAt: Date
}

export type AgentType =
  | 'lead_qualifier'
  | 'sms_responder'
  | 'email_drafter'
  | 'research_assistant'
  | 'call_analyzer'
  | 'custom'

// ============================================
// Plan Limits
// ============================================

const PLAN_LIMITS = {
  starter: {
    maxAgents: 2,
    maxSessions: 100,
    maxMemoryMb: 256,
    memoryEnabled: true,
    customToolsEnabled: false,
  },
  growth: {
    maxAgents: 10,
    maxSessions: 1000,
    maxMemoryMb: 1024,
    memoryEnabled: true,
    customToolsEnabled: true,
  },
  enterprise: {
    maxAgents: -1, // unlimited
    maxSessions: -1,
    maxMemoryMb: -1,
    memoryEnabled: true,
    customToolsEnabled: true,
  },
}

// ============================================
// Agent Templates
// ============================================

const AGENT_TEMPLATES: Record<AgentType, Omit<AgentConfig, 'name'>> = {
  lead_qualifier: {
    systemPrompt: `You are a lead qualification specialist for a B2B sales team.
Your job is to research leads, analyze their fit with our Ideal Customer Profile (ICP),
and provide qualification scores with reasoning.

When qualifying a lead:
1. Research the company's size, industry, and tech stack
2. Look for buying signals (job postings, funding, growth indicators)
3. Score the lead from 0-100 based on ICP fit
4. Provide clear reasoning for your score
5. Suggest personalized outreach angles

Be concise and data-driven in your analysis.`,
    model: 'claude-3-5-sonnet',
    tools: [],
    maxTokens: 4096,
    temperature: 0.7,
    memoryEnabled: true,
  },

  sms_responder: {
    systemPrompt: `You are an SMS response agent for a sales team.
Your job is to respond to inbound SMS messages from leads in a helpful,
conversational way that moves them toward a meeting.

Guidelines:
- Keep responses under 160 characters when possible
- Be friendly and professional
- Answer questions directly
- If they want to schedule, provide available times
- If they're not interested, thank them politely
- Escalate to human if the conversation gets complex

Never be pushy. Build rapport and trust.`,
    model: 'claude-3-5-sonnet',
    tools: [],
    maxTokens: 160,
    temperature: 0.7,
    memoryEnabled: true,
  },

  email_drafter: {
    systemPrompt: `You are an email drafting assistant for B2B sales.
Your job is to write personalized, compelling outreach emails
that get responses.

When drafting emails:
1. Research the recipient and their company
2. Find a relevant personalization hook
3. Keep the email concise (under 150 words)
4. Include a clear, low-friction CTA
5. Avoid spam trigger words

Write like a human, not a marketer. Be genuinely helpful.`,
    model: 'claude-3-5-sonnet',
    tools: [],
    maxTokens: 2048,
    temperature: 0.8,
    memoryEnabled: true,
  },

  research_assistant: {
    systemPrompt: `You are a sales research assistant.
Your job is to gather intelligence on companies and contacts
to help sales reps prepare for calls and personalize outreach.

Research areas:
- Company background, size, funding, growth
- Recent news and announcements
- Tech stack and tools they use
- Key decision makers and org structure
- Potential pain points based on industry
- Competitors and market position

Provide actionable insights, not just data dumps.`,
    model: 'claude-3-5-sonnet',
    tools: [],
    maxTokens: 4096,
    temperature: 0.5,
    memoryEnabled: true,
  },

  call_analyzer: {
    systemPrompt: `You are a sales call analyzer and coach.
Your job is to analyze call transcripts and provide
actionable feedback to help reps improve.

Analyze calls for:
- Talk ratio (rep vs prospect)
- Discovery questions asked
- Objection handling
- Next steps clarity
- Missed opportunities
- What went well

Provide specific, constructive feedback with examples
from the transcript. Be encouraging but honest.`,
    model: 'claude-3-5-sonnet',
    tools: [],
    maxTokens: 4096,
    temperature: 0.6,
    memoryEnabled: true,
  },

  custom: {
    systemPrompt: 'You are a helpful AI assistant.',
    model: 'claude-3-5-sonnet',
    tools: [],
    maxTokens: 4096,
    temperature: 0.7,
    memoryEnabled: true,
  },
}

// ============================================
// Service Functions
// ============================================

/**
 * Provision a new organization with default agents
 */
export async function provisionOrganization(
  organizationId: string,
  organizationName: string,
  plan: TenantConfig['plan'] = 'starter',
): Promise<void> {
  const limits = PLAN_LIMITS[plan]

  console.log(`[Provisioning] Setting up org ${organizationId} on ${plan} plan`)

  // Store tenant config (in your database)
  // This would be in an organization_settings table
  // For now, we'll use the existing organization table

  // Provision default agents based on plan
  const defaultAgents: AgentType[] =
    plan === 'starter'
      ? ['lead_qualifier', 'sms_responder']
      : [
          'lead_qualifier',
          'sms_responder',
          'email_drafter',
          'research_assistant',
        ]

  for (const agentType of defaultAgents) {
    try {
      await provisionAgent(
        organizationId,
        agentType,
        `${organizationName} ${agentType.replace('_', ' ')}`,
      )
    } catch (error) {
      console.error(
        `[Provisioning] Failed to provision ${agentType} for ${organizationId}:`,
        error,
      )
    }
  }

  console.log(`[Provisioning] Completed setup for org ${organizationId}`)
}

/**
 * Provision a new agent for an organization
 */
export async function provisionAgent(
  organizationId: string,
  type: AgentType,
  name: string,
  customConfig?: Partial<AgentConfig>,
): Promise<ProvisionedAgent> {
  console.log(
    `[Provisioning] Creating ${type} agent "${name}" for org ${organizationId}`,
  )

  // Check limits
  const agentCount = await getAgentCount(organizationId)
  const limits = await getOrganizationLimits(organizationId)

  if (limits.maxAgents !== -1 && agentCount >= limits.maxAgents) {
    throw new Error(
      `Agent limit reached (${limits.maxAgents}). Upgrade your plan for more agents.`,
    )
  }

  // Get template and merge with custom config
  const template = AGENT_TEMPLATES[type]
  const agentConfig: AgentConfig = {
    ...template,
    name,
    ...customConfig,
    memoryEnabled:
      limits.memoryEnabled &&
      (customConfig?.memoryEnabled ?? template.memoryEnabled),
  }

  // Create agent in OpenClaw
  let openclawAgent: AgentInstance
  try {
    openclawAgent = await openclawClient.createAgent(agentConfig)
    await openclawClient.startAgent(openclawAgent.id)
  } catch (error) {
    console.error(`[Provisioning] OpenClaw agent creation failed:`, error)
    throw new Error('Failed to provision agent. Please try again.')
  }

  // Store in our database for tracking
  const provisionedAgent: ProvisionedAgent = {
    id: crypto.randomUUID(),
    organizationId,
    openclawAgentId: openclawAgent.id,
    name,
    type,
    status: 'active',
    config: agentConfig,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // Save to database (you'd have an agent_instances table)
  // For now, we'll use the existing agent table structure
  // await db.insertInto('agent_instance').values(...)

  console.log(
    `[Provisioning] Agent ${name} provisioned with OpenClaw ID: ${openclawAgent.id}`,
  )

  return provisionedAgent
}

/**
 * Deprovision (delete) an agent
 */
export async function deprovisionAgent(
  organizationId: string,
  agentId: string,
): Promise<void> {
  console.log(
    `[Provisioning] Deprovisioning agent ${agentId} for org ${organizationId}`,
  )

  // Get agent from database
  // const agent = await db.selectFrom('agent_instance')...

  // Delete from OpenClaw
  try {
    // await openclawClient.stopAgent(agent.openclawAgentId)
    // await openclawClient.deleteAgent(agent.openclawAgentId)
  } catch (error) {
    console.error(`[Provisioning] OpenClaw agent deletion failed:`, error)
  }

  // Mark as deleted in our database
  // await db.updateTable('agent_instance').set({ status: 'deleted' })...
}

/**
 * Update agent configuration
 */
export async function updateAgentConfig(
  organizationId: string,
  agentId: string,
  updates: Partial<AgentConfig>,
): Promise<ProvisionedAgent> {
  console.log(
    `[Provisioning] Updating agent ${agentId} for org ${organizationId}`,
  )

  // Get agent from database
  // const agent = await db.selectFrom('agent_instance')...

  // Update in OpenClaw
  // await openclawClient.updateAgent(agent.openclawAgentId, updates)

  // Update in our database
  // await db.updateTable('agent_instance').set(...)

  // Return updated agent
  return {} as ProvisionedAgent // placeholder
}

/**
 * Get agent count for an organization
 */
async function getAgentCount(organizationId: string): Promise<number> {
  // const result = await db.selectFrom('agent_instance')
  //   .where('organizationId', '=', organizationId)
  //   .where('status', '!=', 'deleted')
  //   .select(db.fn.count('id').as('count'))
  //   .executeTakeFirstOrThrow()
  // return Number(result.count)
  return 0 // placeholder
}

/**
 * Get organization limits based on plan
 */
async function getOrganizationLimits(
  organizationId: string,
): Promise<typeof PLAN_LIMITS.starter> {
  // const org = await db.selectFrom('organization')
  //   .where('id', '=', organizationId)
  //   .select(['plan'])
  //   .executeTakeFirst()
  // return PLAN_LIMITS[org?.plan || 'starter']
  return PLAN_LIMITS.starter // placeholder
}

/**
 * Scale resources for an organization (enterprise feature)
 */
export async function scaleOrganization(
  organizationId: string,
  options: {
    dedicatedInstance?: boolean
    additionalMemory?: number
    priorityQueue?: boolean
  },
): Promise<void> {
  console.log(`[Provisioning] Scaling org ${organizationId}:`, options)

  // This would:
  // 1. Provision dedicated Kubernetes namespace if dedicatedInstance
  // 2. Allocate additional memory limits
  // 3. Configure priority queue access

  // For now, just log
  console.log(
    `[Provisioning] Scale operation would be handled by Kubernetes operator`,
  )
}

// ============================================
// Kubernetes Scaling (Phase 3)
// ============================================

/**
 * Provision dedicated Kubernetes namespace for enterprise tenant
 * This would be called by the scale operation
 */
export async function provisionKubernetesNamespace(
  organizationId: string,
  organizationName: string,
): Promise<{ namespace: string; endpoint: string }> {
  const namespace = `tenant-${organizationId.slice(0, 8)}`

  console.log(`[K8s] Would create namespace: ${namespace}`)

  // This would use the Kubernetes API to:
  // 1. Create namespace
  // 2. Deploy OpenClaw pod
  // 3. Deploy worker pods
  // 4. Create service and ingress
  // 5. Configure network policies for isolation

  // Pseudo-code for K8s deployment:
  /*
  const k8sClient = new KubernetesClient()

  await k8sClient.createNamespace({
    metadata: { name: namespace, labels: { tenant: organizationId } }
  })

  await k8sClient.createDeployment(namespace, {
    metadata: { name: 'openclaw' },
    spec: {
      replicas: 1,
      template: {
        spec: {
          containers: [{
            name: 'openclaw',
            image: 'openclaw/openclaw:latest',
            resources: {
              requests: { memory: '512Mi', cpu: '500m' },
              limits: { memory: '2Gi', cpu: '2000m' }
            }
          }]
        }
      }
    }
  })

  await k8sClient.createService(namespace, { ... })
  await k8sClient.createIngress(namespace, { ... })
  */

  return {
    namespace,
    endpoint: `https://${namespace}.agents.omnidial.io`,
  }
}

// ============================================
// Usage Tracking
// ============================================

export interface UsageMetrics {
  organizationId: string
  period: string // YYYY-MM
  agentCount: number
  sessionCount: number
  messageCount: number
  toolCallCount: number
  memoryUsageMb: number
}

/**
 * Get usage metrics for billing
 */
export async function getUsageMetrics(
  organizationId: string,
  period: string,
): Promise<UsageMetrics> {
  // Aggregate from OpenClaw metrics API and our database

  // const sessions = await openclawClient.listSessions(agentId, { ... })
  // const metrics = await openclawClient.getAgentMetrics(agentId)

  return {
    organizationId,
    period,
    agentCount: 0,
    sessionCount: 0,
    messageCount: 0,
    toolCallCount: 0,
    memoryUsageMb: 0,
  }
}

/**
 * Workflow Engine Service
 * Advanced workflow execution with scheduling, multi-step sequences, and event handling
 *
 * This service extends the basic workflow functionality with:
 * - Cron-based scheduling
 * - Multi-step workflow sequences
 * - Conditional branching
 * - Event-driven triggers
 * - Rate limiting and throttling
 * - Retry policies
 */

import { db } from '@/lib/db'
import * as agentWorkflowRepo from '@/repositories/agentWorkflow.repository'
import * as agentOrchestrator from './agentOrchestrator.service'
import * as agentWorkflowService from './agentWorkflow.service'
import * as agentTools from './agentTools.service'
import type { ToolContext } from './agentTools.service'

// Types

export interface ScheduledJob {
  id: string
  workflowId: string
  cronExpression: string
  nextRunAt: Date
  lastRunAt?: Date
  status: 'active' | 'paused' | 'completed'
  runCount: number
  maxRuns?: number
}

export interface WorkflowStep {
  id: string
  name: string
  type: 'action' | 'condition' | 'delay' | 'loop'
  config: Record<string, unknown>
  nextSteps: { condition?: string; stepId: string }[]
}

export interface WorkflowSequence {
  id: string
  workflowId: string
  steps: WorkflowStep[]
  variables: Record<string, unknown>
}

export interface WorkflowExecutionContext {
  organizationId: string
  agentId: string
  workflowId: string
  leadId?: string
  variables: Record<string, unknown>
  stepResults: Record<string, unknown>
}

// In-memory job scheduler (in production, use a proper job queue like BullMQ)
const scheduledJobs = new Map<string, NodeJS.Timeout>()

// ============================================
// Cron Scheduling
// ============================================

/**
 * Schedule a workflow to run on a cron schedule
 */
export async function scheduleWorkflow(
  workflowId: string,
  cronExpression: string,
  maxRuns?: number,
): Promise<ScheduledJob> {
  const workflow = await agentWorkflowRepo.findById(workflowId)
  if (!workflow) throw new Error('Workflow not found')

  const nextRun = getNextCronRun(cronExpression)

  // Store scheduled job
  const job: ScheduledJob = {
    id: `job_${workflowId}_${Date.now()}`,
    workflowId,
    cronExpression,
    nextRunAt: nextRun,
    status: 'active',
    runCount: 0,
    maxRuns,
  }

  // Schedule the job
  scheduleNextRun(job)

  return job
}

/**
 * Unschedule a workflow
 */
export function unscheduleWorkflow(jobId: string): void {
  const timeout = scheduledJobs.get(jobId)
  if (timeout) {
    clearTimeout(timeout)
    scheduledJobs.delete(jobId)
  }
}

/**
 * Get all scheduled jobs
 */
export function getScheduledJobs(): ScheduledJob[] {
  // In a real implementation, this would read from a database
  return []
}

// Internal scheduling helper
function scheduleNextRun(job: ScheduledJob): void {
  const now = new Date()
  const delay = job.nextRunAt.getTime() - now.getTime()

  if (delay <= 0) {
    // Run immediately
    executeScheduledJob(job)
    return
  }

  const timeout = setTimeout(() => {
    executeScheduledJob(job)
  }, delay)

  scheduledJobs.set(job.id, timeout)
}

async function executeScheduledJob(job: ScheduledJob): Promise<void> {
  try {
    const workflow = await agentWorkflowRepo.findById(job.workflowId)
    if (!workflow) return

    const agent = await db
      .selectFrom('agent')
      .where('id', '=', workflow.agentId)
      .select(['id', 'organizationId'])
      .executeTakeFirst()

    if (!agent) return

    // Execute the workflow via orchestrator for parallel processing
    await agentOrchestrator.createJob(agent.organizationId, agent.id, {
      name: `Scheduled: ${workflow.name}`,
      jobType: 'outreach',
      targetType: workflow.targetType as 'leads' | 'campaign' | 'list',
      targetId: workflow.targetId || undefined,
      targetFilters: workflow.targetFilters as Record<string, unknown>,
      maxParallel: 5,
    })

    job.runCount++
    job.lastRunAt = new Date()

    // Check if max runs reached
    if (job.maxRuns && job.runCount >= job.maxRuns) {
      job.status = 'completed'
      scheduledJobs.delete(job.id)
      return
    }

    // Schedule next run
    job.nextRunAt = getNextCronRun(job.cronExpression)
    scheduleNextRun(job)
  } catch (error) {
    console.error(`Scheduled job ${job.id} failed:`, error)
    // Reschedule anyway
    job.nextRunAt = getNextCronRun(job.cronExpression)
    scheduleNextRun(job)
  }
}

// ============================================
// Multi-Step Workflow Execution
// ============================================

/**
 * Execute a multi-step workflow sequence
 */
export async function executeSequence(
  sequence: WorkflowSequence,
  context: WorkflowExecutionContext,
): Promise<{ success: boolean; results: Record<string, unknown> }> {
  const stepResults: Record<string, unknown> = {}
  let currentStep: WorkflowStep | undefined = sequence.steps[0]

  while (currentStep !== undefined) {
    const step = currentStep // Capture for closure
    try {
      const result = await executeStep(step, context, stepResults)
      stepResults[step.id] = result

      // Find next step
      currentStep = findNextStep(step, result, sequence.steps)
    } catch (error) {
      console.error(`Step ${step.id} failed:`, error)
      return {
        success: false,
        results: {
          ...stepResults,
          error: error instanceof Error ? error.message : 'Unknown error',
          failedStep: step.id,
        },
      }
    }
  }

  return { success: true, results: stepResults }
}

/**
 * Execute a single workflow step
 */
async function executeStep(
  step: WorkflowStep,
  context: WorkflowExecutionContext,
  previousResults: Record<string, unknown>,
): Promise<unknown> {
  const toolContext: ToolContext = {
    organizationId: context.organizationId,
    agentId: context.agentId,
    sessionId: `workflow_${context.workflowId}`,
  }

  switch (step.type) {
    case 'action':
      return executeActionStep(step, toolContext, context, previousResults)

    case 'condition':
      return evaluateCondition(step, context, previousResults)

    case 'delay':
      return executeDelayStep(step)

    case 'loop':
      return executeLoopStep(step, toolContext, context, previousResults)

    default:
      throw new Error(`Unknown step type: ${step.type}`)
  }
}

async function executeActionStep(
  step: WorkflowStep,
  toolContext: ToolContext,
  context: WorkflowExecutionContext,
  previousResults: Record<string, unknown>,
): Promise<unknown> {
  const config = step.config as {
    tool: string
    input: Record<string, unknown>
  }

  // Interpolate variables in input
  const interpolatedInput = interpolateVariables(config.input, {
    ...context.variables,
    ...previousResults,
    leadId: context.leadId,
  })

  // Execute the tool
  const result = await agentTools.executeTool(
    config.tool,
    toolContext,
    interpolatedInput,
  )

  if (!result.success) {
    throw new Error(result.error || 'Action failed')
  }

  return result.data
}

function evaluateCondition(
  step: WorkflowStep,
  context: WorkflowExecutionContext,
  previousResults: Record<string, unknown>,
): boolean {
  const config = step.config as {
    field: string
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists'
    value?: unknown
  }

  // Get field value from context or previous results
  const fieldValue = getNestedValue(
    { ...context.variables, ...previousResults },
    config.field,
  )

  switch (config.operator) {
    case 'eq':
      return fieldValue === config.value
    case 'neq':
      return fieldValue !== config.value
    case 'gt':
      return (fieldValue as number) > (config.value as number)
    case 'lt':
      return (fieldValue as number) < (config.value as number)
    case 'gte':
      return (fieldValue as number) >= (config.value as number)
    case 'lte':
      return (fieldValue as number) <= (config.value as number)
    case 'contains':
      return String(fieldValue).includes(String(config.value))
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null
    default:
      return false
  }
}

async function executeDelayStep(step: WorkflowStep): Promise<void> {
  const config = step.config as { delayMs: number }
  await sleep(config.delayMs)
}

async function executeLoopStep(
  step: WorkflowStep,
  toolContext: ToolContext,
  context: WorkflowExecutionContext,
  previousResults: Record<string, unknown>,
): Promise<unknown[]> {
  const config = step.config as {
    items: string // Path to array in context
    maxIterations?: number
    innerSteps: WorkflowStep[]
  }

  const items = getNestedValue(
    { ...context.variables, ...previousResults },
    config.items,
  ) as unknown[]

  if (!Array.isArray(items)) {
    throw new Error(`Loop items at ${config.items} is not an array`)
  }

  const results: unknown[] = []
  const maxIterations = config.maxIterations || items.length

  for (let i = 0; i < Math.min(items.length, maxIterations); i++) {
    const item = items[i]
    const loopContext = {
      ...context,
      variables: {
        ...context.variables,
        loopItem: item,
        loopIndex: i,
      },
    }

    // Execute inner steps
    for (const innerStep of config.innerSteps) {
      const result = await executeStep(innerStep, loopContext, previousResults)
      results.push(result)
    }
  }

  return results
}

function findNextStep(
  currentStep: WorkflowStep,
  result: unknown,
  allSteps: WorkflowStep[],
): WorkflowStep | undefined {
  for (const next of currentStep.nextSteps) {
    if (!next.condition) {
      // Unconditional next step
      return allSteps.find((s) => s.id === next.stepId)
    }

    // Evaluate condition
    if (next.condition === 'true' && result === true) {
      return allSteps.find((s) => s.id === next.stepId)
    }
    if (next.condition === 'false' && result === false) {
      return allSteps.find((s) => s.id === next.stepId)
    }
  }

  return undefined
}

// ============================================
// Event Handling
// ============================================

/**
 * Handle an event and trigger matching workflows
 */
export async function handleEvent(
  eventType: string,
  payload: {
    organizationId: string
    leadId?: string
    data?: Record<string, unknown>
  },
): Promise<void> {
  // Delegate to existing workflow service
  await agentWorkflowService.handleWorkflowTrigger(eventType, payload)
}

/**
 * Register a webhook trigger for a workflow
 */
export function registerWebhookTrigger(
  workflowId: string,
  webhookUrl: string,
): { webhookId: string; secret: string } {
  const webhookId = `wh_${workflowId}_${Date.now()}`
  const secret = crypto.randomUUID()

  // In a real implementation, store this mapping
  return { webhookId, secret }
}

// ============================================
// Rate Limiting
// ============================================

const rateLimiters = new Map<
  string,
  { count: number; resetAt: number; limit: number }
>()

/**
 * Check if action is rate limited
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  const limiter = rateLimiters.get(key)

  if (!limiter || now > limiter.resetAt) {
    rateLimiters.set(key, {
      count: 1,
      resetAt: now + windowMs,
      limit,
    })
    return true
  }

  if (limiter.count >= limiter.limit) {
    return false
  }

  limiter.count++
  return true
}

/**
 * Create a rate-limited wrapper for a workflow action
 */
export function withRateLimit<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, key: string, limit: number, windowMs: number): T {
  return (async (...args: unknown[]) => {
    if (!checkRateLimit(key, limit, windowMs)) {
      throw new Error(`Rate limit exceeded for ${key}`)
    }
    return fn(...args)
  }) as T
}

// ============================================
// Workflow Templates
// ============================================

/**
 * Pre-built workflow templates
 */
export const workflowTemplates = {
  /**
   * New lead qualification workflow
   */
  newLeadQualification: {
    name: 'New Lead Qualification',
    description: 'Automatically qualify new leads and draft outreach',
    steps: [
      {
        id: 'research',
        name: 'Research Company',
        type: 'action' as const,
        config: {
          tool: 'research_company',
          input: { companyName: '{{lead.company}}' },
        },
        nextSteps: [{ stepId: 'qualify' }],
      },
      {
        id: 'qualify',
        name: 'Qualify Lead',
        type: 'action' as const,
        config: {
          tool: 'qualify_lead',
          input: {
            leadId: '{{leadId}}',
            // Score will be determined by AI
          },
        },
        nextSteps: [
          { condition: 'true', stepId: 'draft_email' },
          { condition: 'false', stepId: 'archive' },
        ],
      },
      {
        id: 'draft_email',
        name: 'Draft Email',
        type: 'action' as const,
        config: {
          tool: 'draft_email',
          input: { leadId: '{{leadId}}' },
        },
        nextSteps: [{ stepId: 'queue_email' }],
      },
      {
        id: 'queue_email',
        name: 'Queue for Review',
        type: 'action' as const,
        config: {
          tool: 'queue_email',
          input: {
            leadId: '{{leadId}}',
            subject: '{{draft_email.subject}}',
            body: '{{draft_email.body}}',
          },
        },
        nextSteps: [],
      },
      {
        id: 'archive',
        name: 'Add Note',
        type: 'action' as const,
        config: {
          tool: 'add_note',
          input: {
            leadId: '{{leadId}}',
            content:
              'Lead disqualified by AI agent. Reason: {{qualify.reasoning}}',
          },
        },
        nextSteps: [],
      },
    ],
  },

  /**
   * Follow-up sequence after no response
   */
  followUpSequence: {
    name: 'Follow-up Sequence',
    description: 'Multi-touch follow-up after initial outreach',
    steps: [
      {
        id: 'wait_3_days',
        name: 'Wait 3 Days',
        type: 'delay' as const,
        config: { delayMs: 3 * 24 * 60 * 60 * 1000 },
        nextSteps: [{ stepId: 'check_response' }],
      },
      {
        id: 'check_response',
        name: 'Check for Response',
        type: 'condition' as const,
        config: {
          field: 'lead.hasReplied',
          operator: 'eq',
          value: false,
        },
        nextSteps: [
          { condition: 'true', stepId: 'send_followup_1' },
          { condition: 'false', stepId: 'end' },
        ],
      },
      {
        id: 'send_followup_1',
        name: 'Send Follow-up 1',
        type: 'action' as const,
        config: {
          tool: 'queue_email',
          input: {
            leadId: '{{leadId}}',
            subject: 'Following up - {{lead.company}}',
            body: 'Just wanted to follow up on my previous email...',
          },
        },
        nextSteps: [{ stepId: 'wait_5_days' }],
      },
      {
        id: 'wait_5_days',
        name: 'Wait 5 Days',
        type: 'delay' as const,
        config: { delayMs: 5 * 24 * 60 * 60 * 1000 },
        nextSteps: [{ stepId: 'send_followup_2' }],
      },
      {
        id: 'send_followup_2',
        name: 'Send Follow-up 2 (SMS)',
        type: 'action' as const,
        config: {
          tool: 'queue_sms',
          input: {
            leadId: '{{leadId}}',
            message:
              'Hi {{lead.firstName}}, tried reaching you by email. Would love to connect briefly. - OmniDial',
          },
        },
        nextSteps: [],
      },
      {
        id: 'end',
        name: 'End',
        type: 'action' as const,
        config: {
          tool: 'add_note',
          input: {
            leadId: '{{leadId}}',
            content: 'Lead responded - exiting follow-up sequence',
          },
        },
        nextSteps: [],
      },
    ],
  },
}

// ============================================
// Utility Functions
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getNextCronRun(cronExpression: string): Date {
  // Simplified cron parsing - in production use a library like node-cron
  // This is a placeholder that returns next hour
  const next = new Date()
  next.setHours(next.getHours() + 1)
  next.setMinutes(0)
  next.setSeconds(0)
  next.setMilliseconds(0)
  return next
}

function interpolateVariables(
  obj: Record<string, unknown>,
  variables: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
        const resolved = getNestedValue(variables, path.trim())
        return resolved !== undefined ? String(resolved) : `{{${path}}}`
      })
    } else if (typeof value === 'object' && value !== null) {
      result[key] = interpolateVariables(
        value as Record<string, unknown>,
        variables,
      )
    } else {
      result[key] = value
    }
  }

  return result
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }

  return current
}

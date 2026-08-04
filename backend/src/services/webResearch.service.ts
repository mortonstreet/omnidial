/**
 * Web Research Service
 *
 * Orchestrates web research tasks using Firecrawl.
 * Creates tasks, executes crawls, maps extracted data to custom fields,
 * and creates approval records for user review.
 */

import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { decrypt } from '@/lib/encryption'
import logger from '@/lib/logger'
import * as firecrawlClient from '@/clients/firecrawl.client'
import type {
  ResearchTaskResponse,
  ResearchTaskDetailResponse,
  ResearchTaskStatus,
  BulkResearchTasksResponse,
} from '@shared/types/src/requests/research'

// === Task Management ===

export async function createTask(
  organizationId: string,
  createdById: string,
  data: {
    leadId: string
    templateId?: string
    customPrompt?: string
    targetUrls?: string[]
    priority?: number
  },
): Promise<ResearchTaskResponse> {
  // Verify lead exists
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', data.leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  // If template provided, fetch it
  let template: any = null
  if (data.templateId) {
    template = await db
      .selectFrom('research_template')
      .where('id', '=', data.templateId)
      .where((eb) =>
        eb.or([
          eb('organizationId', '=', organizationId),
          eb('isSystemTemplate', '=', true),
        ]),
      )
      .where('isActive', '=', true)
      .selectAll()
      .executeTakeFirst()

    if (!template) {
      throw new Error('Template not found or not accessible')
    }
  }

  // Resolve target URLs from template patterns and lead data
  const resolvedUrls = resolveTargetUrls(
    data.targetUrls ?? template?.targetUrls ?? [],
    lead,
  )

  const task = await db
    .insertInto('research_task')
    .values({
      id: uuidv4(),
      organizationId,
      leadId: data.leadId,
      templateId: data.templateId ?? null,
      customPrompt: data.customPrompt ?? null,
      targetUrls: resolvedUrls,
      status: 'pending',
      priority: data.priority ?? 0,
      retryCount: 0,
      maxRetries: 3,
      creditsUsed: 0,
      crawlCount: 0,
      createdById,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // Record history
  await recordHistory(
    organizationId,
    lead.id,
    task.id,
    'task_created',
    {
      templateId: data.templateId,
      targetUrls: resolvedUrls,
      priority: data.priority,
    },
    createdById,
  )

  return transformTask(task, lead, template)
}

export async function createBulkTasks(
  organizationId: string,
  createdById: string,
  data: {
    leadIds: string[]
    templateId?: string
    customPrompt?: string
    targetUrls?: string[]
    priority?: number
  },
): Promise<BulkResearchTasksResponse> {
  const taskIds: string[] = []
  const errors: Array<{ leadId: string; error: string }> = []

  for (const leadId of data.leadIds) {
    try {
      const task = await createTask(organizationId, createdById, {
        leadId,
        templateId: data.templateId,
        customPrompt: data.customPrompt,
        targetUrls: data.targetUrls,
        priority: data.priority,
      })
      taskIds.push(task.id)
    } catch (error) {
      errors.push({
        leadId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    totalRequested: data.leadIds.length,
    totalCreated: taskIds.length,
    taskIds,
    errors,
  }
}

export async function getTask(
  taskId: string,
  organizationId: string,
): Promise<ResearchTaskDetailResponse> {
  const task = await db
    .selectFrom('research_task as rt')
    .leftJoin('lead as l', 'l.id', 'rt.leadId')
    .leftJoin('research_template as t', 't.id', 'rt.templateId')
    .where('rt.id', '=', taskId)
    .where('rt.organizationId', '=', organizationId)
    .select([
      'rt.id',
      'rt.organizationId',
      'rt.leadId',
      'rt.templateId',
      'rt.customPrompt',
      'rt.targetUrls',
      'rt.status',
      'rt.priority',
      'rt.startedAt',
      'rt.completedAt',
      'rt.errorMessage',
      'rt.retryCount',
      'rt.maxRetries',
      'rt.rawResults',
      'rt.extractedData',
      'rt.creditsUsed',
      'rt.crawlCount',
      'rt.createdById',
      'rt.createdAt',
      'rt.updatedAt',
      'l.firstName as leadFirstName',
      'l.lastName as leadLastName',
      't.name as templateName',
    ])
    .executeTakeFirst()

  if (!task) {
    throw new Error('Task not found')
  }

  // Get approvals
  const approvals = await db
    .selectFrom('research_approval as ra')
    .leftJoin('custom_field_schema as cfs', 'cfs.id', 'ra.fieldSchemaId')
    .leftJoin('user as u', 'u.id', 'ra.reviewedById')
    .where('ra.researchTaskId', '=', taskId)
    .select([
      'ra.id',
      'ra.researchTaskId',
      'ra.leadId',
      'ra.fieldSchemaId',
      'ra.fieldName',
      'ra.fieldType',
      'ra.currentValue',
      'ra.proposedValue',
      'ra.source',
      'ra.confidence',
      'ra.status',
      'ra.reviewedById',
      'ra.reviewedAt',
      'ra.modifiedValue',
      'ra.rejectionReason',
      'ra.createdAt',
      'ra.updatedAt',
      'cfs.label as fieldLabel',
      'u.name as reviewedByName',
    ])
    .execute()

  const pendingApprovalCount = approvals.filter(
    (a) => a.status === 'pending',
  ).length

  return {
    id: task.id,
    organizationId: task.organizationId,
    leadId: task.leadId,
    leadName:
      task.leadFirstName || task.leadLastName
        ? `${task.leadFirstName || ''} ${task.leadLastName || ''}`.trim()
        : null,
    templateId: task.templateId,
    templateName: task.templateName,
    customPrompt: task.customPrompt,
    targetUrls: task.targetUrls ?? [],
    status: task.status as ResearchTaskStatus,
    priority: task.priority,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    creditsUsed: task.creditsUsed,
    crawlCount: task.crawlCount,
    pendingApprovalCount,
    createdById: task.createdById,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    rawResults: task.rawResults,
    extractedData: task.extractedData,
    approvals: approvals.map((a) => ({
      id: a.id,
      researchTaskId: a.researchTaskId,
      leadId: a.leadId,
      fieldSchemaId: a.fieldSchemaId,
      fieldName: a.fieldName,
      fieldLabel: a.fieldLabel,
      fieldType: a.fieldType,
      currentValue: a.currentValue,
      proposedValue: a.proposedValue,
      source: a.source,
      confidence: a.confidence ? Number(a.confidence) : null,
      status: a.status as any,
      reviewedById: a.reviewedById,
      reviewedByName: a.reviewedByName,
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      modifiedValue: a.modifiedValue,
      rejectionReason: a.rejectionReason,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
  }
}

export async function listTasks(
  organizationId: string,
  filters: {
    leadId?: string
    status?: ResearchTaskStatus
  },
  pagination: { page: number; limit: number },
): Promise<{
  data: ResearchTaskResponse[]
  total: number
  page: number
  limit: number
}> {
  let query = db
    .selectFrom('research_task as rt')
    .leftJoin('lead as l', 'l.id', 'rt.leadId')
    .leftJoin('research_template as t', 't.id', 'rt.templateId')
    .where('rt.organizationId', '=', organizationId)

  if (filters.leadId) {
    query = query.where('rt.leadId', '=', filters.leadId)
  }
  if (filters.status) {
    query = query.where('rt.status', '=', filters.status)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const tasks = await query
    .select([
      'rt.id',
      'rt.organizationId',
      'rt.leadId',
      'rt.templateId',
      'rt.customPrompt',
      'rt.targetUrls',
      'rt.status',
      'rt.priority',
      'rt.startedAt',
      'rt.completedAt',
      'rt.errorMessage',
      'rt.retryCount',
      'rt.maxRetries',
      'rt.creditsUsed',
      'rt.crawlCount',
      'rt.createdById',
      'rt.createdAt',
      'rt.updatedAt',
      'l.firstName as leadFirstName',
      'l.lastName as leadLastName',
      't.name as templateName',
    ])
    .orderBy('rt.createdAt', 'desc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  // Get pending approval counts for each task
  const taskIds = tasks.map((t) => t.id)
  let approvalCounts: Record<string, number> = {}
  if (taskIds.length > 0) {
    const counts = await db
      .selectFrom('research_approval')
      .where('researchTaskId', 'in', taskIds)
      .where('status', '=', 'pending')
      .groupBy('researchTaskId')
      .select(['researchTaskId', (eb) => eb.fn.countAll().as('count')])
      .execute()
    approvalCounts = counts.reduce(
      (acc, c) => ({ ...acc, [c.researchTaskId]: Number(c.count) }),
      {},
    )
  }

  return {
    data: tasks.map((task) => ({
      id: task.id,
      organizationId: task.organizationId,
      leadId: task.leadId,
      leadName:
        task.leadFirstName || task.leadLastName
          ? `${task.leadFirstName || ''} ${task.leadLastName || ''}`.trim()
          : null,
      templateId: task.templateId,
      templateName: task.templateName,
      customPrompt: task.customPrompt,
      targetUrls: task.targetUrls ?? [],
      status: task.status as ResearchTaskStatus,
      priority: task.priority,
      startedAt: task.startedAt?.toISOString() ?? null,
      completedAt: task.completedAt?.toISOString() ?? null,
      errorMessage: task.errorMessage,
      retryCount: task.retryCount,
      maxRetries: task.maxRetries,
      creditsUsed: task.creditsUsed,
      crawlCount: task.crawlCount,
      pendingApprovalCount: approvalCounts[task.id] ?? 0,
      createdById: task.createdById,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    })),
    total: Number(countResult.count),
    page: pagination.page,
    limit: pagination.limit,
  }
}

export async function cancelTask(
  taskId: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  const task = await db
    .selectFrom('research_task')
    .where('id', '=', taskId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  if (!task) {
    throw new Error('Task not found')
  }

  if (task.status === 'completed' || task.status === 'failed') {
    throw new Error('Cannot cancel a completed or failed task')
  }

  await db
    .updateTable('research_task')
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where('id', '=', taskId)
    .execute()

  await recordHistory(
    organizationId,
    task.leadId,
    taskId,
    'task_cancelled',
    {
      previousStatus: task.status,
    },
    userId,
  )
}

export async function retryTask(
  taskId: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  const task = await db
    .selectFrom('research_task')
    .where('id', '=', taskId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  if (!task) {
    throw new Error('Task not found')
  }

  if (task.status !== 'failed' && task.status !== 'cancelled') {
    throw new Error('Can only retry failed or cancelled tasks')
  }

  if (task.retryCount >= task.maxRetries) {
    throw new Error('Maximum retry count reached')
  }

  await db
    .updateTable('research_task')
    .set({
      status: 'pending',
      errorMessage: null,
      retryCount: task.retryCount + 1,
      updatedAt: new Date(),
    })
    .where('id', '=', taskId)
    .execute()

  await recordHistory(
    organizationId,
    task.leadId,
    taskId,
    'task_retried',
    {
      retryCount: task.retryCount + 1,
    },
    userId,
  )
}

// === Task Execution (called by worker) ===

export async function executeTask(taskId: string): Promise<void> {
  const task = await db
    .selectFrom('research_task as rt')
    .leftJoin('research_template as t', 't.id', 'rt.templateId')
    .where('rt.id', '=', taskId)
    .select([
      'rt.id',
      'rt.organizationId',
      'rt.leadId',
      'rt.templateId',
      'rt.customPrompt',
      'rt.targetUrls',
      't.prompt as templatePrompt',
      't.extractionSchema',
      't.fieldMappings',
    ])
    .executeTakeFirst()

  if (!task) {
    throw new Error('Task not found')
  }

  // Mark as running
  await db
    .updateTable('research_task')
    .set({
      status: 'running',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', taskId)
    .execute()

  await recordHistory(
    task.organizationId,
    task.leadId,
    taskId,
    'task_started',
    {},
    null,
  )

  try {
    const connection = await db
      .selectFrom('data_vendor_connection')
      .where('organizationId', '=', task.organizationId)
      .where('provider', '=', 'firecrawl')
      .where('isActive', '=', true)
      .selectAll()
      .executeTakeFirst()

    if (!connection) {
      throw new Error('Firecrawl not configured')
    }

    const apiKey = decrypt(connection.apiKeyEncrypted)

    // Get lead data for URL resolution
    const lead = await db
      .selectFrom('lead')
      .where('id', '=', task.leadId)
      .selectAll()
      .executeTakeFirst()

    if (!lead) {
      throw new Error('Lead not found')
    }

    const prompt = task.customPrompt ?? task.templatePrompt ?? ''
    const extractionSchema = (task.extractionSchema ?? {}) as any
    const fieldMappings = (task.fieldMappings ?? {}) as Record<string, string>
    const targetUrls = task.targetUrls ?? []

    const rawResults: any[] = []
    const extractedData: Record<string, unknown> = {}
    let crawlCount = 0

    // Build extraction schema for Firecrawl
    const schema: firecrawlClient.ExtractionSchema = {
      name: 'lead_research',
      description:
        prompt || 'Extract relevant information about the person/company',
      fields: Object.keys(extractionSchema).map((key) => ({
        name: key,
        description: extractionSchema[key]?.description ?? key,
        type: extractionSchema[key]?.type ?? 'string',
        required: extractionSchema[key]?.required ?? false,
      })),
    }

    // If no specific fields defined, use generic company research schema
    if (schema.fields.length === 0) {
      schema.fields = [
        {
          name: 'company_name',
          description: 'The company name',
          type: 'string',
        },
        {
          name: 'company_description',
          description: 'Brief company description',
          type: 'string',
        },
        {
          name: 'funding_info',
          description: 'Funding information',
          type: 'string',
        },
        {
          name: 'employee_count',
          description: 'Number of employees',
          type: 'string',
        },
        { name: 'industry', description: 'Industry or sector', type: 'string' },
        {
          name: 'recent_news',
          description: 'Recent news or updates',
          type: 'string',
        },
      ]
    }

    // Execute crawls for each target URL
    for (const url of targetUrls) {
      try {
        const result = await firecrawlClient.extract(apiKey, url, schema, {
          prompt,
          timeout: 60000,
        })

        rawResults.push({
          url,
          success: result.success,
          extractedData: result.extractedData,
          markdown: result.markdown,
          error: result.errorMessage,
        })

        if (result.success) {
          // Merge extracted data
          Object.assign(extractedData, result.extractedData)
          crawlCount++
        }
      } catch (error) {
        logger.error({ error, url, taskId }, 'Crawl failed')
        rawResults.push({
          url,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    // Update last sync timestamp
    await db
      .updateTable('data_vendor_connection')
      .set({
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', connection.id)
      .execute()

    // Create approval records for extracted data
    for (const [extractedField, value] of Object.entries(extractedData)) {
      if (value === null || value === undefined || value === '') continue

      // Find the target custom field from mappings
      const targetField = fieldMappings[extractedField] ?? extractedField

      // Get current value from lead's customFields
      const customFields = (lead.customFields ?? {}) as Record<string, unknown>
      const currentValue = customFields[targetField] ?? null

      // Create approval record
      await db
        .insertInto('research_approval')
        .values({
          id: uuidv4(),
          researchTaskId: taskId,
          leadId: task.leadId,
          fieldSchemaId: null, // Would link to custom_field_schema if exists
          fieldName: targetField,
          fieldType: typeof value === 'number' ? 'number' : 'text',
          currentValue: currentValue ? String(currentValue) : null,
          proposedValue: String(value),
          source: targetUrls.join(', '),
          confidence: null,
          status: 'pending',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute()
    }

    // Mark task as completed
    await db
      .updateTable('research_task')
      .set({
        status: 'completed',
        completedAt: new Date(),
        rawResults: JSON.stringify(rawResults),
        extractedData: JSON.stringify(extractedData),
        creditsUsed: 0,
        crawlCount,
        updatedAt: new Date(),
      })
      .where('id', '=', taskId)
      .execute()

    await recordHistory(
      task.organizationId,
      task.leadId,
      taskId,
      'task_completed',
      {
        crawlCount,
        fieldsExtracted: Object.keys(extractedData),
      },
      null,
    )
  } catch (error) {
    logger.error({ error, taskId }, 'Task execution failed')

    await db
      .updateTable('research_task')
      .set({
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        updatedAt: new Date(),
      })
      .where('id', '=', taskId)
      .execute()

    await recordHistory(
      task.organizationId,
      task.leadId,
      taskId,
      'task_failed',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      null,
    )

    throw error
  }
}

// === Helper Functions ===

function resolveTargetUrls(urlPatterns: string[], lead: any): string[] {
  return urlPatterns
    .map((pattern) => {
      let resolved = pattern

      // Replace placeholders with lead data
      resolved = resolved.replace('{company_website}', lead.website ?? '')
      resolved = resolved.replace(
        '{company}',
        encodeURIComponent(lead.company ?? ''),
      )
      resolved = resolved.replace('{linkedin_url}', lead.linkedInUrl ?? '')
      resolved = resolved.replace(
        '{first_name}',
        encodeURIComponent(lead.firstName ?? ''),
      )
      resolved = resolved.replace(
        '{last_name}',
        encodeURIComponent(lead.lastName ?? ''),
      )
      resolved = resolved.replace(
        '{email}',
        encodeURIComponent(lead.email ?? ''),
      )

      return resolved
    })
    .filter((url) => url && url.startsWith('http'))
}

function transformTask(
  task: any,
  lead: any,
  template: any,
): ResearchTaskResponse {
  return {
    id: task.id,
    organizationId: task.organizationId,
    leadId: task.leadId,
    leadName:
      lead.firstName || lead.lastName
        ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
        : null,
    templateId: task.templateId,
    templateName: template?.name ?? null,
    customPrompt: task.customPrompt,
    targetUrls: task.targetUrls ?? [],
    status: task.status,
    priority: task.priority,
    startedAt: task.startedAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    errorMessage: task.errorMessage,
    retryCount: task.retryCount,
    maxRetries: task.maxRetries,
    creditsUsed: task.creditsUsed,
    crawlCount: task.crawlCount,
    pendingApprovalCount: 0,
    createdById: task.createdById,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }
}

async function recordHistory(
  organizationId: string,
  leadId: string | null,
  taskId: string | null,
  action: string,
  details: Record<string, unknown>,
  performedById: string | null,
): Promise<void> {
  await db
    .insertInto('research_history')
    .values({
      id: uuidv4(),
      organizationId,
      leadId,
      taskId,
      action,
      details: JSON.stringify(details),
      performedById,
      createdAt: new Date(),
    })
    .execute()
}

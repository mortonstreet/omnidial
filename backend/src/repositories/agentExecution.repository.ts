import { db } from '@/lib/db'
import { withId, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export type ExecutionStatus =
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TriggerType =
  | 'user'
  | 'orchestrator'
  | 'schedule'
  | 'webhook'
  | 'inbound_sms'

export interface CreateAgentExecutionInput {
  organizationId: string
  agentDefinitionId: string
  triggerType: TriggerType
  triggerContext?: unknown
  parentExecutionId?: string | null
  inputPrompt: string
  inputContext?: unknown
  leadId?: string | null
  campaignId?: string | null
}

export interface UpdateAgentExecutionInput {
  status?: ExecutionStatus
  outputResponse?: string | null
  outputToolCalls?: unknown
  error?: string | null
  tokensInput?: number
  tokensOutput?: number
  durationMs?: number
  estimatedCost?: number
  completedAt?: Date
}

export const create = async (data: CreateAgentExecutionInput) => {
  const record = {
    ...withId(data),
    triggerContext: data.triggerContext
      ? JSON.stringify(data.triggerContext)
      : null,
    inputContext: data.inputContext ? JSON.stringify(data.inputContext) : null,
    status: 'running' as ExecutionStatus,
    createdAt: new Date(),
  }
  return db
    .insertInto('agent_execution')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_execution')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByIdWithDefinition = async (id: string) => {
  return db
    .selectFrom('agent_execution')
    .innerJoin(
      'agent_definition',
      'agent_definition.id',
      'agent_execution.agentDefinitionId',
    )
    .select([
      'agent_execution.id',
      'agent_execution.organizationId',
      'agent_execution.agentDefinitionId',
      'agent_execution.triggerType',
      'agent_execution.triggerContext',
      'agent_execution.parentExecutionId',
      'agent_execution.inputPrompt',
      'agent_execution.inputContext',
      'agent_execution.outputResponse',
      'agent_execution.outputToolCalls',
      'agent_execution.status',
      'agent_execution.error',
      'agent_execution.leadId',
      'agent_execution.campaignId',
      'agent_execution.tokensInput',
      'agent_execution.tokensOutput',
      'agent_execution.durationMs',
      'agent_execution.estimatedCost',
      'agent_execution.createdAt',
      'agent_execution.completedAt',
      'agent_definition.name as agentName',
      'agent_definition.type as agentType',
    ])
    .where('agent_execution.id', '=', id)
    .executeTakeFirst()
}

export const findByOrganizationId = async (
  organizationId: string,
  filters?: {
    status?: ExecutionStatus
    agentDefinitionId?: string
    parentExecutionId?: string
  },
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('agent_execution')
    .selectAll()
    .where('organizationId', '=', organizationId)

  if (filters?.status) {
    query = query.where('status', '=', filters.status)
  }

  if (filters?.agentDefinitionId) {
    query = query.where('agentDefinitionId', '=', filters.agentDefinitionId)
  }

  if (filters?.parentExecutionId) {
    query = query.where('parentExecutionId', '=', filters.parentExecutionId)
  }

  query = query.orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findChildExecutions = async (parentExecutionId: string) => {
  return db
    .selectFrom('agent_execution')
    .selectAll()
    .where('parentExecutionId', '=', parentExecutionId)
    .orderBy('createdAt', 'asc')
    .execute()
}

export const findRunning = async (organizationId: string) => {
  return db
    .selectFrom('agent_execution')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('status', '=', 'running')
    .orderBy('createdAt', 'desc')
    .execute()
}

export const update = async (id: string, data: UpdateAgentExecutionInput) => {
  const updateData: Record<string, unknown> = {}

  if (data.status !== undefined) updateData.status = data.status
  if (data.outputResponse !== undefined)
    updateData.outputResponse = data.outputResponse
  if (data.outputToolCalls !== undefined) {
    updateData.outputToolCalls = JSON.stringify(data.outputToolCalls)
  }
  if (data.error !== undefined) updateData.error = data.error
  if (data.tokensInput !== undefined) updateData.tokensInput = data.tokensInput
  if (data.tokensOutput !== undefined)
    updateData.tokensOutput = data.tokensOutput
  if (data.durationMs !== undefined) updateData.durationMs = data.durationMs
  if (data.estimatedCost !== undefined)
    updateData.estimatedCost = data.estimatedCost.toString()
  if (data.completedAt !== undefined) updateData.completedAt = data.completedAt

  return db
    .updateTable('agent_execution')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const markCompleted = async (
  id: string,
  result: {
    outputResponse?: string
    outputToolCalls?: unknown
    tokensInput?: number
    tokensOutput?: number
    durationMs?: number
    estimatedCost?: number
  },
) => {
  return update(id, {
    status: 'completed',
    completedAt: new Date(),
    ...result,
  })
}

export const markFailed = async (id: string, error: string) => {
  return update(id, {
    status: 'failed',
    error,
    completedAt: new Date(),
  })
}

export const markAwaitingApproval = async (id: string) => {
  return update(id, { status: 'awaiting_approval' })
}

export const countByOrganizationToday = async (organizationId: string) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db
    .selectFrom('agent_execution')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .where('createdAt', '>=', today)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countByAgentToday = async (
  organizationId: string,
  agentDefinitionId: string,
) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const result = await db
    .selectFrom('agent_execution')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .where('agentDefinitionId', '=', agentDefinitionId)
    .where('createdAt', '>=', today)
    .executeTakeFirst()
  return result?.count ?? 0
}

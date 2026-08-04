import { db } from '@/lib/db'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export type AgentDefinitionType =
  | 'orchestrator'
  | 'email'
  | 'sms'
  | 'research'
  | 'qualify'
  | 'analytics'
  | 'campaign'

export interface CreateAgentDefinitionInput {
  organizationId: string
  name: string
  type: AgentDefinitionType
  description?: string | null
  systemPrompt: string
  tools?: unknown[]
  guardrails?: Record<string, unknown>
  model?: string
  maxTokens?: number
  temperature?: number
  isSystem?: boolean
}

export interface UpdateAgentDefinitionInput {
  name?: string
  description?: string | null
  systemPrompt?: string
  tools?: unknown[]
  guardrails?: Record<string, unknown>
  model?: string
  maxTokens?: number
  temperature?: number
  isActive?: boolean
}

export const create = async (data: CreateAgentDefinitionInput) => {
  const record = {
    ...withId(data),
    tools: JSON.stringify(data.tools || []),
    guardrails: JSON.stringify(data.guardrails || {}),
    model: data.model || 'claude-sonnet',
    maxTokens: data.maxTokens || 2048,
    temperature: data.temperature?.toString() || '0.5',
    isSystem: data.isSystem || false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return db
    .insertInto('agent_definition')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_definition')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByOrganizationId = async (
  organizationId: string,
  filters?: { type?: AgentDefinitionType; isActive?: boolean },
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('agent_definition')
    .selectAll()
    .where('organizationId', '=', organizationId)

  if (filters?.type) {
    query = query.where('type', '=', filters.type)
  }

  if (filters?.isActive !== undefined) {
    query = query.where('isActive', '=', filters.isActive)
  }

  query = query.orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByType = async (
  organizationId: string,
  type: AgentDefinitionType,
) => {
  return db
    .selectFrom('agent_definition')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('type', '=', type)
    .where('isActive', '=', true)
    .executeTakeFirst()
}

export const findActiveByOrganization = async (organizationId: string) => {
  return db
    .selectFrom('agent_definition')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .orderBy('type', 'asc')
    .execute()
}

export const update = async (id: string, data: UpdateAgentDefinitionInput) => {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.systemPrompt !== undefined)
    updateData.systemPrompt = data.systemPrompt
  if (data.tools !== undefined) updateData.tools = JSON.stringify(data.tools)
  if (data.guardrails !== undefined)
    updateData.guardrails = JSON.stringify(data.guardrails)
  if (data.model !== undefined) updateData.model = data.model
  if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens
  if (data.temperature !== undefined)
    updateData.temperature = data.temperature.toString()
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  return db
    .updateTable('agent_definition')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent_definition').where('id', '=', id).execute()
}

export const countByOrganization = async (organizationId: string) => {
  const result = await db
    .selectFrom('agent_definition')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return result?.count ?? 0
}

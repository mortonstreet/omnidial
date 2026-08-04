import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateAgentWorkflowInput {
  agentId: string
  name: string
  triggerType: string
  triggerConfig: Record<string, unknown>
  actionType: string
  actionConfig: Record<string, unknown>
  targetType: string
  targetId?: string | null
  targetFilters?: Record<string, unknown>
  isActive?: boolean
}

export interface UpdateAgentWorkflowInput {
  name?: string
  triggerType?: string
  triggerConfig?: Record<string, unknown>
  actionType?: string
  actionConfig?: Record<string, unknown>
  targetType?: string
  targetId?: string | null
  targetFilters?: Record<string, unknown>
  isActive?: boolean
  executionCount?: number
  lastExecutedAt?: Date | null
}

export const create = async (data: CreateAgentWorkflowInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('agent_workflow')
    .values({
      ...record,
      triggerConfig: JSON.stringify(data.triggerConfig),
      actionConfig: JSON.stringify(data.actionConfig),
      targetFilters: JSON.stringify(data.targetFilters || {}),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_workflow')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByAgentId = async (agentId: string) => {
  return db
    .selectFrom('agent_workflow')
    .selectAll()
    .where('agentId', '=', agentId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findActiveByAgentId = async (agentId: string) => {
  return db
    .selectFrom('agent_workflow')
    .selectAll()
    .where('agentId', '=', agentId)
    .where('isActive', '=', true)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const update = async (id: string, data: UpdateAgentWorkflowInput) => {
  const updateData: Record<string, unknown> = { ...withTimestamps(data) }
  if (data.triggerConfig) {
    updateData.triggerConfig = JSON.stringify(data.triggerConfig)
  }
  if (data.actionConfig) {
    updateData.actionConfig = JSON.stringify(data.actionConfig)
  }
  if (data.targetFilters) {
    updateData.targetFilters = JSON.stringify(data.targetFilters)
  }
  return db
    .updateTable('agent_workflow')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const activate = async (id: string) => {
  return db
    .updateTable('agent_workflow')
    .set({
      isActive: true,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deactivate = async (id: string) => {
  return db
    .updateTable('agent_workflow')
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const incrementExecutionCount = async (id: string) => {
  const workflow = await findById(id)
  if (!workflow) return null

  return db
    .updateTable('agent_workflow')
    .set({
      executionCount: (workflow.executionCount || 0) + 1,
      lastExecutedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent_workflow').where('id', '=', id).execute()
}

export const deleteByAgentId = async (agentId: string) => {
  return db
    .deleteFrom('agent_workflow')
    .where('agentId', '=', agentId)
    .execute()
}

import { db } from '@/lib/db'
import { withId } from './utils'

export type ToolCategory =
  | 'email'
  | 'sms'
  | 'research'
  | 'crm'
  | 'analytics'
  | 'campaign'
  | 'orchestrator'

export interface CreateAgentToolInput {
  organizationId?: string | null // NULL for system tools
  name: string
  description: string
  category: ToolCategory
  parameters: unknown // JSON Schema
  handler: string
  requiresApproval?: boolean
  isSystem?: boolean
}

export interface UpdateAgentToolInput {
  name?: string
  description?: string
  parameters?: unknown
  handler?: string
  requiresApproval?: boolean
  isActive?: boolean
}

export const create = async (data: CreateAgentToolInput) => {
  const record = {
    ...withId(data),
    parameters: JSON.stringify(data.parameters),
    requiresApproval: data.requiresApproval || false,
    isSystem: data.isSystem ?? true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  return db
    .insertInto('agent_tool')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_tool')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByName = async (
  name: string,
  organizationId?: string | null,
) => {
  let query = db
    .selectFrom('agent_tool')
    .selectAll()
    .where('name', '=', name)
    .where('isActive', '=', true)

  if (organizationId) {
    // Find org-specific or system tool
    query = query.where((eb) =>
      eb.or([
        eb('organizationId', '=', organizationId),
        eb('organizationId', 'is', null),
      ]),
    )
  } else {
    // Only system tools
    query = query.where('organizationId', 'is', null)
  }

  return query.executeTakeFirst()
}

export const findByCategory = async (
  category: ToolCategory,
  organizationId?: string | null,
) => {
  let query = db
    .selectFrom('agent_tool')
    .selectAll()
    .where('category', '=', category)
    .where('isActive', '=', true)

  if (organizationId) {
    query = query.where((eb) =>
      eb.or([
        eb('organizationId', '=', organizationId),
        eb('organizationId', 'is', null),
      ]),
    )
  } else {
    query = query.where('organizationId', 'is', null)
  }

  return query.orderBy('name', 'asc').execute()
}

export const findAllForOrganization = async (organizationId: string) => {
  return db
    .selectFrom('agent_tool')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('organizationId', '=', organizationId),
        eb('organizationId', 'is', null),
      ]),
    )
    .where('isActive', '=', true)
    .orderBy('category', 'asc')
    .orderBy('name', 'asc')
    .execute()
}

export const findSystemTools = async () => {
  return db
    .selectFrom('agent_tool')
    .selectAll()
    .where('isSystem', '=', true)
    .where('isActive', '=', true)
    .orderBy('category', 'asc')
    .orderBy('name', 'asc')
    .execute()
}

export const update = async (id: string, data: UpdateAgentToolInput) => {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  }

  if (data.name !== undefined) updateData.name = data.name
  if (data.description !== undefined) updateData.description = data.description
  if (data.parameters !== undefined) {
    updateData.parameters = JSON.stringify(data.parameters)
  }
  if (data.handler !== undefined) updateData.handler = data.handler
  if (data.requiresApproval !== undefined) {
    updateData.requiresApproval = data.requiresApproval
  }
  if (data.isActive !== undefined) updateData.isActive = data.isActive

  return db
    .updateTable('agent_tool')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('agent_tool').where('id', '=', id).execute()
}

// Bulk upsert for seeding system tools
export const upsertSystemTool = async (data: CreateAgentToolInput) => {
  const existing = await findByName(data.name, null)

  if (existing) {
    return update(existing.id, {
      description: data.description,
      parameters: data.parameters,
      handler: data.handler,
      requiresApproval: data.requiresApproval,
    })
  }

  return create({ ...data, isSystem: true, organizationId: null })
}

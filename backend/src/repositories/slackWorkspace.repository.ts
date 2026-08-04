import { db } from '@/lib/db'
import { withId, withTimestamps } from './utils'

export interface CreateSlackWorkspaceInput {
  organizationId?: string | null // Nullable for App Directory flow
  teamId: string
  teamName: string
  teamDomain?: string | null
  botToken: string
  botUserId: string
  appId: string
  enterpriseId?: string | null
  enterpriseName?: string | null
  installedById?: string | null
  installedBySlackId?: string | null
  defaultChannelId?: string | null
  settings?: Record<string, unknown>
  isPending?: boolean // True when installed from App Directory but not linked
}

export interface UpdateSlackWorkspaceInput {
  organizationId?: string | null
  teamName?: string
  teamDomain?: string | null
  botToken?: string
  defaultChannelId?: string | null
  settings?: Record<string, unknown>
  isActive?: boolean
  isPending?: boolean
  installedById?: string | null
  lastActivityAt?: Date
}

export const create = async (data: CreateSlackWorkspaceInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('slack_workspace')
    .values({
      ...record,
      settings: JSON.stringify(data.settings || {}),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('slack_workspace')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByTeamId = async (teamId: string) => {
  return db
    .selectFrom('slack_workspace')
    .selectAll()
    .where('teamId', '=', teamId)
    .executeTakeFirst()
}

export const findByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('slack_workspace')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .execute()
}

export const findActiveByOrganizationId = async (organizationId: string) => {
  return db
    .selectFrom('slack_workspace')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .executeTakeFirst()
}

export const update = async (id: string, data: UpdateSlackWorkspaceInput) => {
  const updateData: Record<string, unknown> = { ...withTimestamps(data) }
  if (data.settings) {
    updateData.settings = JSON.stringify(data.settings)
  }
  return db
    .updateTable('slack_workspace')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const updateLastActivity = async (id: string) => {
  return db
    .updateTable('slack_workspace')
    .set({
      lastActivityAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const deactivate = async (id: string) => {
  return db
    .updateTable('slack_workspace')
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('slack_workspace').where('id', '=', id).execute()
}

export const findAll = async () => {
  return db
    .selectFrom('slack_workspace')
    .selectAll()
    .where('isActive', '=', true)
    .execute()
}

/**
 * Find all pending workspaces (installed but not linked to an organization)
 */
export const findPending = async () => {
  return db
    .selectFrom('slack_workspace')
    .selectAll()
    .where('isPending', '=', true)
    .where('isActive', '=', true)
    .execute()
}

/**
 * Link a pending workspace to an organization
 */
export const linkToOrganization = async (
  id: string,
  organizationId: string,
  installedById?: string,
) => {
  return db
    .updateTable('slack_workspace')
    .set({
      organizationId,
      isPending: false,
      installedById,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

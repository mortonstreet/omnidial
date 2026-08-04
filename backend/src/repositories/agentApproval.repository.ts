import { db } from '@/lib/db'
import { withId, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'expired'

export type ApprovalType =
  | 'send_email'
  | 'send_sms'
  | 'create_campaign'
  | 'bulk_action'
  | 'modify_lead'

export interface CreateAgentApprovalInput {
  organizationId: string
  executionId: string
  approvalType: ApprovalType
  actionSummary: string
  actionDetails: unknown
  leadId?: string | null
  campaignId?: string | null
  slackMessageTs?: string | null
  slackChannelId?: string | null
  expiresAt?: Date | null
}

export interface RespondToApprovalInput {
  respondedById: string
  response: 'approved' | 'rejected' | 'modified'
  responseNote?: string | null
  modifications?: unknown
}

export const create = async (data: CreateAgentApprovalInput) => {
  const record = {
    ...withId(data),
    actionDetails: JSON.stringify(data.actionDetails),
    status: 'pending' as ApprovalStatus,
    createdAt: new Date(),
  }
  return db
    .insertInto('agent_approval')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('agent_approval')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByIdWithDetails = async (id: string) => {
  return db
    .selectFrom('agent_approval')
    .leftJoin('lead', 'lead.id', 'agent_approval.leadId')
    .leftJoin('campaign', 'campaign.id', 'agent_approval.campaignId')
    .leftJoin(
      'agent_execution',
      'agent_execution.id',
      'agent_approval.executionId',
    )
    .leftJoin(
      'agent_definition',
      'agent_definition.id',
      'agent_execution.agentDefinitionId',
    )
    .select([
      'agent_approval.id',
      'agent_approval.organizationId',
      'agent_approval.executionId',
      'agent_approval.approvalType',
      'agent_approval.actionSummary',
      'agent_approval.actionDetails',
      'agent_approval.leadId',
      'agent_approval.campaignId',
      'agent_approval.status',
      'agent_approval.respondedById',
      'agent_approval.response',
      'agent_approval.responseNote',
      'agent_approval.modifications',
      'agent_approval.slackMessageTs',
      'agent_approval.slackChannelId',
      'agent_approval.expiresAt',
      'agent_approval.createdAt',
      'agent_approval.respondedAt',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.email as leadEmail',
      'lead.company as leadCompany',
      'campaign.name as campaignName',
      'agent_definition.name as agentName',
      'agent_definition.type as agentType',
    ])
    .where('agent_approval.id', '=', id)
    .executeTakeFirst()
}

export const findByExecutionId = async (executionId: string) => {
  return db
    .selectFrom('agent_approval')
    .selectAll()
    .where('executionId', '=', executionId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findPendingByOrganization = async (
  organizationId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('agent_approval')
    .leftJoin('lead', 'lead.id', 'agent_approval.leadId')
    .leftJoin('campaign', 'campaign.id', 'agent_approval.campaignId')
    .leftJoin(
      'agent_execution',
      'agent_execution.id',
      'agent_approval.executionId',
    )
    .leftJoin(
      'agent_definition',
      'agent_definition.id',
      'agent_execution.agentDefinitionId',
    )
    .select([
      'agent_approval.id',
      'agent_approval.organizationId',
      'agent_approval.executionId',
      'agent_approval.approvalType',
      'agent_approval.actionSummary',
      'agent_approval.actionDetails',
      'agent_approval.leadId',
      'agent_approval.campaignId',
      'agent_approval.status',
      'agent_approval.expiresAt',
      'agent_approval.createdAt',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.company as leadCompany',
      'campaign.name as campaignName',
      'agent_definition.name as agentName',
      'agent_definition.type as agentType',
    ])
    .where('agent_approval.organizationId', '=', organizationId)
    .where('agent_approval.status', '=', 'pending')
    .orderBy('agent_approval.createdAt', 'asc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findBySlackMessageTs = async (slackMessageTs: string) => {
  return db
    .selectFrom('agent_approval')
    .selectAll()
    .where('slackMessageTs', '=', slackMessageTs)
    .executeTakeFirst()
}

export const respond = async (id: string, data: RespondToApprovalInput) => {
  const updateData: Record<string, unknown> = {
    respondedById: data.respondedById,
    response: data.response,
    status: data.response,
    respondedAt: new Date(),
  }

  if (data.responseNote !== undefined) {
    updateData.responseNote = data.responseNote
  }

  if (data.modifications !== undefined) {
    updateData.modifications = JSON.stringify(data.modifications)
  }

  return db
    .updateTable('agent_approval')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const expirePending = async () => {
  const now = new Date()

  return db
    .updateTable('agent_approval')
    .set({ status: 'expired' })
    .where('status', '=', 'pending')
    .where('expiresAt', '<=', now)
    .execute()
}

export const countPendingByOrganization = async (organizationId: string) => {
  const result = await db
    .selectFrom('agent_approval')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .where('status', '=', 'pending')
    .executeTakeFirst()
  return result?.count ?? 0
}

export const batchRespond = async (
  ids: string[],
  data: RespondToApprovalInput,
) => {
  const updateData: Record<string, unknown> = {
    respondedById: data.respondedById,
    response: data.response,
    status: data.response,
    respondedAt: new Date(),
  }

  if (data.responseNote !== undefined) {
    updateData.responseNote = data.responseNote
  }

  return db
    .updateTable('agent_approval')
    .set(updateData)
    .where('id', 'in', ids)
    .where('status', '=', 'pending')
    .execute()
}

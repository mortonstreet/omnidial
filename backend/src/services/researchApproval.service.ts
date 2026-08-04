/**
 * Research Approval Service
 *
 * Manages the approval workflow for extracted research data.
 * Handles approve/reject/modify actions and applies approved data to leads.
 */

import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import type {
  ResearchApprovalResponse,
  ResearchApprovalStatus,
  BulkApprovalActionResponse,
} from '@shared/types/src/requests/research'

// === Approval Listing ===

export async function listApprovals(
  organizationId: string,
  filters: {
    leadId?: string
    taskId?: string
    status?: ResearchApprovalStatus
  },
  pagination: { page: number; limit: number },
): Promise<{
  data: ResearchApprovalResponse[]
  total: number
  page: number
  limit: number
}> {
  let query = db
    .selectFrom('research_approval as ra')
    .innerJoin('research_task as rt', 'rt.id', 'ra.researchTaskId')
    .leftJoin('custom_field_schema as cfs', 'cfs.id', 'ra.fieldSchemaId')
    .leftJoin('user as u', 'u.id', 'ra.reviewedById')
    .where('rt.organizationId', '=', organizationId)

  if (filters.leadId) {
    query = query.where('ra.leadId', '=', filters.leadId)
  }
  if (filters.taskId) {
    query = query.where('ra.researchTaskId', '=', filters.taskId)
  }
  if (filters.status) {
    query = query.where('ra.status', '=', filters.status)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const approvals = await query
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
    .orderBy('ra.createdAt', 'desc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  return {
    data: approvals.map((a) => ({
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
      status: a.status as ResearchApprovalStatus,
      reviewedById: a.reviewedById,
      reviewedByName: a.reviewedByName,
      reviewedAt: a.reviewedAt?.toISOString() ?? null,
      modifiedValue: a.modifiedValue,
      rejectionReason: a.rejectionReason,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    total: Number(countResult.count),
    page: pagination.page,
    limit: pagination.limit,
  }
}

// === Single Approval Actions ===

export async function approveApproval(
  approvalId: string,
  organizationId: string,
  userId: string,
): Promise<ResearchApprovalResponse> {
  const approval = await getApprovalWithOrgCheck(approvalId, organizationId)

  if (approval.status !== 'pending') {
    throw new Error('Approval is not in pending status')
  }

  // Update approval status
  const updated = await db
    .updateTable('research_approval')
    .set({
      status: 'approved',
      reviewedById: userId,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', approvalId)
    .returningAll()
    .executeTakeFirstOrThrow()

  // Apply the value to the lead's customFields
  await applyValueToLead(
    approval.leadId,
    approval.fieldName,
    approval.proposedValue,
  )

  // Record history
  await recordHistory(
    organizationId,
    approval.leadId,
    approval.researchTaskId,
    'approval_approved',
    { fieldName: approval.fieldName, value: approval.proposedValue },
    userId,
  )

  return transformApproval(updated, null, null)
}

export async function rejectApproval(
  approvalId: string,
  organizationId: string,
  userId: string,
  reason?: string,
): Promise<ResearchApprovalResponse> {
  const approval = await getApprovalWithOrgCheck(approvalId, organizationId)

  if (approval.status !== 'pending') {
    throw new Error('Approval is not in pending status')
  }

  const updated = await db
    .updateTable('research_approval')
    .set({
      status: 'rejected',
      reviewedById: userId,
      reviewedAt: new Date(),
      rejectionReason: reason ?? null,
      updatedAt: new Date(),
    })
    .where('id', '=', approvalId)
    .returningAll()
    .executeTakeFirstOrThrow()

  await recordHistory(
    organizationId,
    approval.leadId,
    approval.researchTaskId,
    'approval_rejected',
    { fieldName: approval.fieldName, reason },
    userId,
  )

  return transformApproval(updated, null, null)
}

export async function modifyApproval(
  approvalId: string,
  organizationId: string,
  userId: string,
  modifiedValue: string,
): Promise<ResearchApprovalResponse> {
  const approval = await getApprovalWithOrgCheck(approvalId, organizationId)

  if (approval.status !== 'pending') {
    throw new Error('Approval is not in pending status')
  }

  const updated = await db
    .updateTable('research_approval')
    .set({
      status: 'modified',
      reviewedById: userId,
      reviewedAt: new Date(),
      modifiedValue,
      updatedAt: new Date(),
    })
    .where('id', '=', approvalId)
    .returningAll()
    .executeTakeFirstOrThrow()

  // Apply the modified value to the lead's customFields
  await applyValueToLead(approval.leadId, approval.fieldName, modifiedValue)

  await recordHistory(
    organizationId,
    approval.leadId,
    approval.researchTaskId,
    'approval_modified',
    {
      fieldName: approval.fieldName,
      originalValue: approval.proposedValue,
      modifiedValue,
    },
    userId,
  )

  return transformApproval(updated, null, null)
}

// === Bulk Actions ===

export async function bulkApprove(
  approvalIds: string[],
  organizationId: string,
  userId: string,
): Promise<BulkApprovalActionResponse> {
  const errors: Array<{ id: string; error: string }> = []
  let processed = 0

  for (const id of approvalIds) {
    try {
      await approveApproval(id, organizationId, userId)
      processed++
    } catch (error) {
      errors.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    totalRequested: approvalIds.length,
    totalProcessed: processed,
    errors,
  }
}

export async function bulkReject(
  approvalIds: string[],
  organizationId: string,
  userId: string,
  reason?: string,
): Promise<BulkApprovalActionResponse> {
  const errors: Array<{ id: string; error: string }> = []
  let processed = 0

  for (const id of approvalIds) {
    try {
      await rejectApproval(id, organizationId, userId, reason)
      processed++
    } catch (error) {
      errors.push({
        id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return {
    totalRequested: approvalIds.length,
    totalProcessed: processed,
    errors,
  }
}

// === Helper Functions ===

async function getApprovalWithOrgCheck(
  approvalId: string,
  organizationId: string,
): Promise<{
  id: string
  researchTaskId: string
  leadId: string
  fieldName: string
  proposedValue: string
  status: string
}> {
  const approval = await db
    .selectFrom('research_approval as ra')
    .innerJoin('research_task as rt', 'rt.id', 'ra.researchTaskId')
    .where('ra.id', '=', approvalId)
    .where('rt.organizationId', '=', organizationId)
    .select([
      'ra.id',
      'ra.researchTaskId',
      'ra.leadId',
      'ra.fieldName',
      'ra.proposedValue',
      'ra.status',
    ])
    .executeTakeFirst()

  if (!approval) {
    throw new Error('Approval not found')
  }

  return approval
}

async function applyValueToLead(
  leadId: string,
  fieldName: string,
  value: string,
): Promise<void> {
  // Get current lead
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .select(['customFields'])
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  // Merge the new value into customFields
  const currentFields = (lead.customFields ?? {}) as Record<string, unknown>
  const updatedFields = {
    ...currentFields,
    [fieldName]: value,
  }

  // Update lead
  await db
    .updateTable('lead')
    .set({
      customFields: JSON.stringify(updatedFields),
      updatedAt: new Date(),
    })
    .where('id', '=', leadId)
    .execute()
}

function transformApproval(
  approval: any,
  fieldLabel: string | null,
  reviewedByName: string | null,
): ResearchApprovalResponse {
  return {
    id: approval.id,
    researchTaskId: approval.researchTaskId,
    leadId: approval.leadId,
    fieldSchemaId: approval.fieldSchemaId,
    fieldName: approval.fieldName,
    fieldLabel,
    fieldType: approval.fieldType,
    currentValue: approval.currentValue,
    proposedValue: approval.proposedValue,
    source: approval.source,
    confidence: approval.confidence ? Number(approval.confidence) : null,
    status: approval.status as ResearchApprovalStatus,
    reviewedById: approval.reviewedById,
    reviewedByName,
    reviewedAt: approval.reviewedAt?.toISOString() ?? null,
    modifiedValue: approval.modifiedValue,
    rejectionReason: approval.rejectionReason,
    createdAt: approval.createdAt.toISOString(),
    updatedAt: approval.updatedAt.toISOString(),
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

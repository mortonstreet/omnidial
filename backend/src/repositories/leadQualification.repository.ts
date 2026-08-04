import { db } from '@/lib/db'
import { withId, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateLeadQualificationInput {
  organizationId: string
  leadId: string
  agentId?: string | null
  category: string
  score: number
  reasoning: string
  companyResearch?: Record<string, unknown> | null
  linkedInData?: Record<string, unknown> | null
  intentSignals?: Record<string, unknown> | null
  generatedEmail?: Record<string, unknown> | null
  generatedSms?: string | null
  reviewStatus?: string
}

export interface UpdateLeadQualificationInput {
  category?: string
  score?: number
  reasoning?: string
  companyResearch?: Record<string, unknown> | null
  linkedInData?: Record<string, unknown> | null
  intentSignals?: Record<string, unknown> | null
  generatedEmail?: Record<string, unknown> | null
  generatedSms?: string | null
  reviewStatus?: string
  reviewedById?: string | null
  reviewedAt?: Date | null
  reviewNotes?: string | null
  emailSentAt?: Date | null
  smsSentAt?: Date | null
}

export const create = async (data: CreateLeadQualificationInput) => {
  const record = withId(withTimestamps(data, true))
  return db
    .insertInto('lead_qualification')
    .values({
      ...record,
      companyResearch: data.companyResearch
        ? JSON.stringify(data.companyResearch)
        : null,
      linkedInData: data.linkedInData
        ? JSON.stringify(data.linkedInData)
        : null,
      intentSignals: data.intentSignals
        ? JSON.stringify(data.intentSignals)
        : null,
      generatedEmail: data.generatedEmail
        ? JSON.stringify(data.generatedEmail)
        : null,
    })
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst()
}

export const findByLeadId = async (leadId: string) => {
  return db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('leadId', '=', leadId)
    .orderBy('createdAt', 'desc')
    .executeTakeFirst()
}

export const findAllByLeadId = async (leadId: string) => {
  return db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('leadId', '=', leadId)
    .orderBy('createdAt', 'desc')
    .execute()
}

export const findByOrganizationId = async (
  organizationId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByOrganizationIdAndCategory = async (
  organizationId: string,
  category: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('category', '=', category)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findPendingReview = async (
  organizationId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('reviewStatus', '=', 'pending')
    .orderBy('score', 'desc') // Higher score = higher priority
    .orderBy('createdAt', 'asc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const findByAgentId = async (
  agentId: string,
  pagination?: DBPagination,
) => {
  let query = db
    .selectFrom('lead_qualification')
    .selectAll()
    .where('agentId', '=', agentId)
    .orderBy('createdAt', 'desc')

  if (pagination) {
    query = withPagination(pagination, query)
  }

  return query.execute()
}

export const update = async (
  id: string,
  data: UpdateLeadQualificationInput,
) => {
  const updateData: Record<string, unknown> = { ...withTimestamps(data) }
  if (data.companyResearch !== undefined) {
    updateData.companyResearch = data.companyResearch
      ? JSON.stringify(data.companyResearch)
      : null
  }
  if (data.linkedInData !== undefined) {
    updateData.linkedInData = data.linkedInData
      ? JSON.stringify(data.linkedInData)
      : null
  }
  if (data.intentSignals !== undefined) {
    updateData.intentSignals = data.intentSignals
      ? JSON.stringify(data.intentSignals)
      : null
  }
  if (data.generatedEmail !== undefined) {
    updateData.generatedEmail = data.generatedEmail
      ? JSON.stringify(data.generatedEmail)
      : null
  }

  return db
    .updateTable('lead_qualification')
    .set(updateData)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const approve = async (
  id: string,
  reviewedById: string,
  reviewNotes?: string,
) => {
  return db
    .updateTable('lead_qualification')
    .set({
      reviewStatus: 'approved',
      reviewedById,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const reject = async (
  id: string,
  reviewedById: string,
  reviewNotes?: string,
) => {
  return db
    .updateTable('lead_qualification')
    .set({
      reviewStatus: 'rejected',
      reviewedById,
      reviewedAt: new Date(),
      reviewNotes: reviewNotes || null,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const markEmailSent = async (id: string) => {
  return db
    .updateTable('lead_qualification')
    .set({
      emailSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const markSmsSent = async (id: string) => {
  return db
    .updateTable('lead_qualification')
    .set({
      smsSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .execute()
}

export const deleteById = async (id: string) => {
  return db.deleteFrom('lead_qualification').where('id', '=', id).execute()
}

export const countByOrganizationId = async (organizationId: string) => {
  const result = await db
    .selectFrom('lead_qualification')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countByOrganizationIdAndCategory = async (
  organizationId: string,
  category: string,
) => {
  const result = await db
    .selectFrom('lead_qualification')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .where('category', '=', category)
    .executeTakeFirst()
  return result?.count ?? 0
}

export const countPendingReview = async (organizationId: string) => {
  const result = await db
    .selectFrom('lead_qualification')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .where('organizationId', '=', organizationId)
    .where('reviewStatus', '=', 'pending')
    .executeTakeFirst()
  return result?.count ?? 0
}

export const getQualificationStats = async (organizationId: string) => {
  const [total, highIntent, medium, lowIntent, disqualified, pending] =
    await Promise.all([
      countByOrganizationId(organizationId),
      countByOrganizationIdAndCategory(organizationId, 'high_intent'),
      countByOrganizationIdAndCategory(organizationId, 'medium'),
      countByOrganizationIdAndCategory(organizationId, 'low_intent'),
      countByOrganizationIdAndCategory(organizationId, 'disqualified'),
      countPendingReview(organizationId),
    ])

  return {
    total,
    highIntent,
    medium,
    lowIntent,
    disqualified,
    pendingReview: pending,
  }
}

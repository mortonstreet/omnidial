/**
 * Lead Qualification Service
 * AI-powered lead qualification using Groq for fast inference
 */

import { GroqClient, createGroqClient } from '@/clients/groq.client'
import * as leadQualificationRepo from '@/repositories/leadQualification.repository'
import * as leadResearchService from './leadResearch.service'
import type {
  LeadQualificationResponse,
  QualificationStatsResponse,
} from '@shared/types/src/requests/leadAgent'
import { db } from '@/lib/db'

export type QualificationCategory =
  | 'high_intent'
  | 'medium'
  | 'low_intent'
  | 'disqualified'

export interface QualificationResult {
  category: QualificationCategory
  score: number
  reasoning: string
  intentSignals: string[]
  companyResearch: Record<string, unknown> | null
  linkedInData: Record<string, unknown> | null
}

export interface GeneratedOutreach {
  email: {
    subject: string
    body: string
  } | null
  sms: string | null
}

let groqClient: GroqClient | null = null

function getGroqClient(): GroqClient {
  if (!groqClient) {
    groqClient = createGroqClient()
  }
  return groqClient
}

/**
 * Qualify a lead with AI
 */
export async function qualifyLead(
  organizationId: string,
  leadId: string,
  icpCriteria: string,
  agentId?: string,
): Promise<QualificationResult> {
  // Fetch the lead
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  // Perform research
  const { companyResearch, personResearch, researchSummary } =
    await leadResearchService.researchLead({
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      linkedInUrl: lead.linkedInUrl,
      website: lead.website,
    })

  // Qualify with AI
  const client = getGroqClient()
  const qualification = await client.qualifyLead(
    {
      name:
        `${lead.firstName || ''} ${lead.lastName || ''}`.trim() || undefined,
      email: lead.email || undefined,
      company: lead.company || undefined,
      title: lead.title || undefined,
      website: lead.website || undefined,
      linkedInUrl: lead.linkedInUrl || undefined,
    },
    researchSummary,
    icpCriteria,
  )

  return {
    category: qualification.category,
    score: qualification.score,
    reasoning: qualification.reasoning,
    intentSignals: qualification.intentSignals,
    companyResearch: companyResearch?.raw || null,
    linkedInData: personResearch?.raw || null,
  }
}

/**
 * Generate outreach content for a qualified lead
 */
export async function generateOutreach(
  lead: {
    firstName?: string | null
    lastName?: string | null
    company?: string | null
    title?: string | null
  },
  companyContext: string,
  valueProposition: string,
  options?: {
    includeEmail?: boolean
    includeSms?: boolean
    emailTone?: 'professional' | 'casual' | 'direct'
  },
): Promise<GeneratedOutreach> {
  const client = getGroqClient()
  const result: GeneratedOutreach = { email: null, sms: null }

  const tasks: Promise<void>[] = []

  // Generate email if requested
  if (options?.includeEmail !== false) {
    tasks.push(
      client
        .generateEmail(
          {
            firstName: lead.firstName || undefined,
            lastName: lead.lastName || undefined,
            company: lead.company || undefined,
            title: lead.title || undefined,
          },
          companyContext,
          valueProposition,
          options?.emailTone || 'professional',
        )
        .then((emailResult) => {
          result.email = {
            subject: emailResult.subject,
            body: emailResult.body,
          }
        })
        .catch((error) => {
          console.error('Email generation failed:', error)
        }),
    )
  }

  // Generate SMS if requested
  if (options?.includeSms === true) {
    tasks.push(
      client
        .generateSms(
          {
            firstName: lead.firstName || undefined,
            company: lead.company || undefined,
          },
          `${companyContext}\n\nValue prop: ${valueProposition}`,
        )
        .then((smsResult) => {
          result.sms = smsResult.message
        })
        .catch((error) => {
          console.error('SMS generation failed:', error)
        }),
    )
  }

  await Promise.all(tasks)
  return result
}

/**
 * Full qualification workflow: research, qualify, generate outreach, save
 */
export async function runQualificationWorkflow(
  organizationId: string,
  leadId: string,
  options: {
    agentId?: string
    icpCriteria: string
    valueProposition?: string
    generateOutreach?: boolean
  },
): Promise<LeadQualificationResponse> {
  // Fetch the lead
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  // Step 1: Qualify
  const qualification = await qualifyLead(
    organizationId,
    leadId,
    options.icpCriteria,
    options.agentId,
  )

  // Step 2: Generate outreach if requested and qualified
  let outreach: GeneratedOutreach = { email: null, sms: null }
  if (
    options.generateOutreach &&
    options.valueProposition &&
    qualification.category !== 'disqualified'
  ) {
    const companyContext =
      qualification.companyResearch?.summary ||
      `${lead.company || 'Unknown company'}`
    outreach = await generateOutreach(
      lead,
      String(companyContext),
      options.valueProposition,
      {
        includeEmail: true,
        includeSms: qualification.category === 'high_intent',
      },
    )
  }

  // Step 3: Save qualification
  const saved = await leadQualificationRepo.create({
    organizationId,
    leadId,
    agentId: options.agentId || null,
    category: qualification.category,
    score: qualification.score,
    reasoning: qualification.reasoning,
    companyResearch: qualification.companyResearch,
    linkedInData: qualification.linkedInData,
    intentSignals: { signals: qualification.intentSignals },
    generatedEmail: outreach.email
      ? { subject: outreach.email.subject, body: outreach.email.body }
      : null,
    generatedSms: outreach.sms,
    reviewStatus: 'pending',
  })

  return transformQualification(saved, lead)
}

/**
 * Review and approve/reject a qualification
 */
export async function reviewQualification(
  qualificationId: string,
  reviewedById: string,
  action: 'approve' | 'reject' | 'edit',
  options?: {
    reviewNotes?: string
    editedEmail?: { subject: string; body: string }
    editedSms?: string
  },
): Promise<LeadQualificationResponse> {
  const qualification = await leadQualificationRepo.findById(qualificationId)
  if (!qualification) {
    throw new Error('Qualification not found')
  }

  let updated
  if (action === 'approve') {
    updated = await leadQualificationRepo.approve(
      qualificationId,
      reviewedById,
      options?.reviewNotes,
    )
  } else if (action === 'reject') {
    updated = await leadQualificationRepo.reject(
      qualificationId,
      reviewedById,
      options?.reviewNotes,
    )
  } else {
    // Edit case - update the outreach content and approve
    const updateData: leadQualificationRepo.UpdateLeadQualificationInput = {
      reviewStatus: 'edited',
      reviewedById,
      reviewedAt: new Date(),
      reviewNotes: options?.reviewNotes,
    }

    if (options?.editedEmail) {
      updateData.generatedEmail = {
        subject: options.editedEmail.subject,
        body: options.editedEmail.body,
        approved: true,
      }
    }

    if (options?.editedSms) {
      updateData.generatedSms = options.editedSms
    }

    updated = await leadQualificationRepo.update(qualificationId, updateData)
  }

  // Fetch lead for response
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', updated.leadId)
    .select(['id', 'firstName', 'lastName', 'email', 'company'])
    .executeTakeFirst()

  return transformQualification(updated, lead)
}

/**
 * Get pending qualifications for review
 */
export async function getPendingReviews(
  organizationId: string,
  pagination?: { page: number; limit: number },
): Promise<{ qualifications: LeadQualificationResponse[]; total: number }> {
  const dbPagination = pagination
    ? { page: pagination.page, limit: pagination.limit, offset: 0 }
    : undefined

  const qualifications = await leadQualificationRepo.findPendingReview(
    organizationId,
    dbPagination,
  )

  // Fetch leads for all qualifications
  const leadIds = qualifications.map((q) => q.leadId)
  const leads =
    leadIds.length > 0
      ? await db
          .selectFrom('lead')
          .where('id', 'in', leadIds)
          .select(['id', 'firstName', 'lastName', 'email', 'company'])
          .execute()
      : []

  const leadMap = new Map(leads.map((l) => [l.id, l]))

  const total = await leadQualificationRepo.countPendingReview(organizationId)

  return {
    qualifications: qualifications.map((q) =>
      transformQualification(q, leadMap.get(q.leadId)),
    ),
    total,
  }
}

/**
 * Get qualification statistics
 */
export async function getQualificationStats(
  organizationId: string,
): Promise<QualificationStatsResponse> {
  return leadQualificationRepo.getQualificationStats(organizationId)
}

/**
 * Get a single qualification by ID
 */
export async function getQualificationById(
  qualificationId: string,
): Promise<LeadQualificationResponse | null> {
  const qualification = await leadQualificationRepo.findById(qualificationId)
  if (!qualification) {
    return null
  }

  const lead = await db
    .selectFrom('lead')
    .where('id', '=', qualification.leadId)
    .select(['id', 'firstName', 'lastName', 'email', 'company'])
    .executeTakeFirst()

  return transformQualification(qualification, lead)
}

/**
 * Get qualifications for a specific lead
 */
export async function getQualificationsForLead(
  leadId: string,
): Promise<LeadQualificationResponse[]> {
  const qualifications = await leadQualificationRepo.findAllByLeadId(leadId)

  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .select(['id', 'firstName', 'lastName', 'email', 'company'])
    .executeTakeFirst()

  return qualifications.map((q) => transformQualification(q, lead))
}

// Helper function to transform DB record to response type
function transformQualification(
  record: Awaited<ReturnType<typeof leadQualificationRepo.findById>>,
  lead?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    company: string | null
  } | null,
): LeadQualificationResponse {
  if (!record) {
    throw new Error('Qualification not found')
  }

  return {
    id: record.id,
    organizationId: record.organizationId,
    leadId: record.leadId,
    agentId: record.agentId,
    category: record.category as QualificationCategory,
    score: record.score,
    reasoning: record.reasoning,
    companyResearch: record.companyResearch
      ? (JSON.parse(record.companyResearch as string) as Record<
          string,
          unknown
        >)
      : null,
    linkedInData: record.linkedInData
      ? (JSON.parse(record.linkedInData as string) as Record<string, unknown>)
      : null,
    intentSignals: record.intentSignals
      ? (JSON.parse(record.intentSignals as string) as Record<string, unknown>)
      : null,
    generatedEmail: record.generatedEmail
      ? (JSON.parse(record.generatedEmail as string) as {
          subject: string
          body: string
          approved?: boolean
        })
      : null,
    generatedSms: record.generatedSms,
    reviewStatus:
      record.reviewStatus as LeadQualificationResponse['reviewStatus'],
    reviewedById: record.reviewedById,
    reviewedAt: record.reviewedAt?.toISOString() || null,
    reviewNotes: record.reviewNotes,
    emailSentAt: record.emailSentAt?.toISOString() || null,
    smsSentAt: record.smsSentAt?.toISOString() || null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    lead: lead
      ? {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          company: lead.company,
        }
      : undefined,
  }
}

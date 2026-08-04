/**
 * SMS Campaign Service
 * Business logic for SMS campaign CRUD, steps, lists, and enrollments
 */

import * as smsCampaignRepo from '@/repositories/smsCampaign.repository'
import * as smsCampaignStepRepo from '@/repositories/smsCampaignStep.repository'
import * as smsCampaignListRepo from '@/repositories/smsCampaignList.repository'
import * as smsCampaignEnrollmentRepo from '@/repositories/smsCampaignEnrollment.repository'
import * as leadListEntryRepo from '@/repositories/leadListEntry.repository'
import { db } from '@/lib/db'
import type {
  SmsCampaignResponse,
  SmsCampaignStepResponse,
  SmsCampaignListResponse,
  SmsCampaignEnrollmentResponse,
  SmsCampaignEnrollmentListResponse,
  SmsCampaignStatsResponse,
  EnrollLeadsResponse,
} from '@shared/types/src/requests/smsCampaign'

// ============================================
// Campaign CRUD
// ============================================

export interface CreateCampaignParams {
  organizationId: string
  createdById: string
  name: string
  description?: string | null
  sendWindowStart?: string
  sendWindowEnd?: string
  sendDays?: number[]
  defaultTimezone?: string
  aiEnabled?: boolean
  aiModel?: string | null
  aiSystemPrompt?: string | null
  valueProposition?: string | null
  dailySendLimit?: number
}

export async function createCampaign(
  params: CreateCampaignParams,
): Promise<SmsCampaignResponse> {
  const campaign = await smsCampaignRepo.create(params)
  return transformCampaign(campaign)
}

export async function getCampaignById(
  id: string,
  organizationId: string,
): Promise<SmsCampaignResponse> {
  const campaign = await smsCampaignRepo.findByIdWithSteps(id, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }
  return transformCampaignWithSteps(campaign)
}

export interface ListCampaignsParams {
  organizationId: string
  status?: string
  search?: string
  pagination: {
    page: number
    limit: number
    offset: number
  }
}

export async function listCampaigns(
  params: ListCampaignsParams,
): Promise<SmsCampaignListResponse> {
  const { pagination, ...rest } = params
  const result = await smsCampaignRepo.list({ ...rest, pagination })

  return {
    data: result.data.map(transformCampaign),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      hasNextPage: pagination.page * pagination.limit < result.total,
      hasPrevPage: pagination.page > 1,
    },
  }
}

export interface UpdateCampaignParams {
  id: string
  organizationId: string
  name?: string
  description?: string | null
  sendWindowStart?: string
  sendWindowEnd?: string
  sendDays?: number[]
  defaultTimezone?: string
  aiEnabled?: boolean
  aiModel?: string | null
  aiSystemPrompt?: string | null
  valueProposition?: string | null
  dailySendLimit?: number
}

export async function updateCampaign(
  params: UpdateCampaignParams,
): Promise<SmsCampaignResponse> {
  const { id, organizationId, ...data } = params

  // Verify campaign exists
  const existing = await smsCampaignRepo.findById(id, organizationId)
  if (!existing) {
    throw new Error('Campaign not found')
  }

  // Can only update draft or paused campaigns
  if (existing.status !== 'draft' && existing.status !== 'paused') {
    throw new Error('Can only update draft or paused campaigns')
  }

  const campaign = await smsCampaignRepo.update(id, organizationId, data)
  return transformCampaign(campaign)
}

export async function deleteCampaign(
  id: string,
  organizationId: string,
): Promise<void> {
  const existing = await smsCampaignRepo.findById(id, organizationId)
  if (!existing) {
    throw new Error('Campaign not found')
  }

  // Can only delete draft campaigns
  if (existing.status !== 'draft') {
    throw new Error('Can only delete draft campaigns')
  }

  await smsCampaignRepo.deleteById(id, organizationId)
}

// ============================================
// Campaign Actions
// ============================================

export async function activateCampaign(
  id: string,
  organizationId: string,
): Promise<SmsCampaignResponse> {
  const campaign = await smsCampaignRepo.findByIdWithSteps(id, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    throw new Error('Can only activate draft or paused campaigns')
  }

  // Verify campaign has at least one step
  if (!campaign.steps || campaign.steps.length === 0) {
    throw new Error('Campaign must have at least one step before activation')
  }

  // Verify campaign has enrollments
  const enrollmentCount = await smsCampaignEnrollmentRepo.countByCampaignId(id)
  if (enrollmentCount === 0) {
    throw new Error(
      'Campaign must have at least one enrolled lead before activation',
    )
  }

  const updated = await smsCampaignRepo.activate(id, organizationId)
  return transformCampaign(updated)
}

export async function pauseCampaign(
  id: string,
  organizationId: string,
): Promise<SmsCampaignResponse> {
  const campaign = await smsCampaignRepo.findById(id, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'active') {
    throw new Error('Can only pause active campaigns')
  }

  const updated = await smsCampaignRepo.pause(id, organizationId)
  return transformCampaign(updated)
}

// ============================================
// Campaign Steps
// ============================================

export interface AddStepParams {
  campaignId: string
  organizationId: string
  stepNumber: number
  dayOffset: number
  messageTemplate: string
  aiEnabled?: boolean | null
  aiPromptOverride?: string | null
  skipIfReplied?: boolean
}

export async function addStep(
  params: AddStepParams,
): Promise<SmsCampaignStepResponse> {
  const { campaignId, organizationId, ...stepData } = params

  // Verify campaign exists and is editable
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    throw new Error('Can only add steps to draft or paused campaigns')
  }

  // Check for duplicate step number
  const existing = await smsCampaignStepRepo.findByCampaignIdAndStepNumber(
    campaignId,
    stepData.stepNumber,
  )
  if (existing) {
    throw new Error(`Step number ${stepData.stepNumber} already exists`)
  }

  const step = await smsCampaignStepRepo.create({
    campaignId,
    ...stepData,
  })

  return transformStep(step)
}

export interface UpdateStepParams {
  stepId: string
  campaignId: string
  organizationId: string
  stepNumber?: number
  dayOffset?: number
  messageTemplate?: string
  aiEnabled?: boolean | null
  aiPromptOverride?: string | null
  skipIfReplied?: boolean
}

export async function updateStep(
  params: UpdateStepParams,
): Promise<SmsCampaignStepResponse> {
  const { stepId, campaignId, organizationId, ...stepData } = params

  // Verify campaign exists and is editable
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'draft' && campaign.status !== 'paused') {
    throw new Error('Can only update steps in draft or paused campaigns')
  }

  // Verify step exists and belongs to campaign
  const existing = await smsCampaignStepRepo.findById(stepId)
  if (!existing || existing.campaignId !== campaignId) {
    throw new Error('Step not found')
  }

  // Check for duplicate step number if changing
  if (stepData.stepNumber && stepData.stepNumber !== existing.stepNumber) {
    const duplicate = await smsCampaignStepRepo.findByCampaignIdAndStepNumber(
      campaignId,
      stepData.stepNumber,
    )
    if (duplicate) {
      throw new Error(`Step number ${stepData.stepNumber} already exists`)
    }
  }

  const step = await smsCampaignStepRepo.update(stepId, stepData)
  return transformStep(step)
}

export async function deleteStep(
  stepId: string,
  campaignId: string,
  organizationId: string,
): Promise<void> {
  // Verify campaign exists and is editable
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (campaign.status !== 'draft') {
    throw new Error('Can only delete steps from draft campaigns')
  }

  // Verify step exists and belongs to campaign
  const existing = await smsCampaignStepRepo.findById(stepId)
  if (!existing || existing.campaignId !== campaignId) {
    throw new Error('Step not found')
  }

  await smsCampaignStepRepo.deleteById(stepId)
}

// ============================================
// Campaign Lists
// ============================================

export async function attachList(
  campaignId: string,
  organizationId: string,
  listId: string,
): Promise<void> {
  // Verify campaign exists
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Verify list exists and belongs to org
  const list = await db
    .selectFrom('lead_list')
    .where('id', '=', listId)
    .where('organizationId', '=', organizationId)
    .select(['id'])
    .executeTakeFirst()

  if (!list) {
    throw new Error('List not found')
  }

  // Check if already attached
  const existing = await smsCampaignListRepo.findByCampaignAndList(
    campaignId,
    listId,
  )
  if (existing) {
    throw new Error('List already attached to campaign')
  }

  await smsCampaignListRepo.create({ campaignId, listId })
}

export async function detachList(
  campaignId: string,
  organizationId: string,
  listId: string,
): Promise<void> {
  // Verify campaign exists
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  await smsCampaignListRepo.deleteByCampaignAndList(campaignId, listId)
}

// ============================================
// Enrollments
// ============================================

export interface ListEnrollmentsParams {
  campaignId: string
  organizationId: string
  status?: string
  pagination: {
    page: number
    limit: number
    offset: number
  }
}

export async function listEnrollments(
  params: ListEnrollmentsParams,
): Promise<SmsCampaignEnrollmentListResponse> {
  const { campaignId, organizationId, status, pagination } = params

  // Verify campaign exists
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  const result = await smsCampaignEnrollmentRepo.listByCampaignIdWithLead({
    campaignId,
    status,
    pagination,
  })

  return {
    data: result.data.map(transformEnrollmentWithLead),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / pagination.limit),
      hasNextPage: pagination.page * pagination.limit < result.total,
      hasPrevPage: pagination.page > 1,
    },
  }
}

export async function enrollLeads(
  campaignId: string,
  organizationId: string,
  leadIds: string[],
): Promise<EnrollLeadsResponse> {
  // Verify campaign exists
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Get first step for calculating nextSendAt
  const steps = await smsCampaignStepRepo.findByCampaignId(campaignId)
  const firstStep = steps[0]

  const result: EnrollLeadsResponse = {
    enrolled: 0,
    skipped: 0,
    errors: [],
  }

  // Get lead info including timezone
  const leads = await db
    .selectFrom('lead')
    .select(['id', 'phone', 'normalizedPhone', 'timezone'])
    .where('id', 'in', leadIds)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .execute()

  const leadMap = new Map(leads.map((l) => [l.id, l]))

  const toEnroll: Array<{
    campaignId: string
    leadId: string
    timezone?: string | null
  }> = []

  for (const leadId of leadIds) {
    const lead = leadMap.get(leadId)

    if (!lead) {
      result.errors.push({ leadId, reason: 'Lead not found' })
      result.skipped++
      continue
    }

    if (!lead.normalizedPhone && !lead.phone) {
      result.errors.push({ leadId, reason: 'Lead has no phone number' })
      result.skipped++
      continue
    }

    // Check if already enrolled
    const existing = await smsCampaignEnrollmentRepo.findByCampaignAndLead(
      campaignId,
      leadId,
    )
    if (existing) {
      result.errors.push({ leadId, reason: 'Lead already enrolled' })
      result.skipped++
      continue
    }

    toEnroll.push({
      campaignId,
      leadId,
      timezone: lead.timezone,
    })
  }

  if (toEnroll.length > 0) {
    result.enrolled = await smsCampaignEnrollmentRepo.createMany(toEnroll)

    // Update total enrolled stat
    await smsCampaignRepo.incrementStat(
      campaignId,
      'totalEnrolled',
      result.enrolled,
    )

    // Calculate nextSendAt for each enrollment if campaign is active
    if (campaign.status === 'active' && firstStep) {
      // Schedule initial send based on first step's dayOffset
      // This will be recalculated by the worker based on send window
      const enrollments = await smsCampaignEnrollmentRepo.listByCampaignId({
        campaignId,
        status: 'active',
        pagination: { page: 1, limit: 10000, offset: 0 },
      })

      const baseDate = new Date()
      for (const enrollment of enrollments.data) {
        if (!enrollment.nextSendAt) {
          const nextSendAt = new Date(baseDate)
          nextSendAt.setDate(nextSendAt.getDate() + firstStep.dayOffset)
          await smsCampaignEnrollmentRepo.update(enrollment.id, { nextSendAt })
        }
      }
    }
  }

  return result
}

export async function enrollFromList(
  campaignId: string,
  organizationId: string,
  listId: string,
): Promise<EnrollLeadsResponse> {
  // Verify campaign exists
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Verify list exists
  const list = await db
    .selectFrom('lead_list')
    .where('id', '=', listId)
    .where('organizationId', '=', organizationId)
    .select(['id'])
    .executeTakeFirst()

  if (!list) {
    throw new Error('List not found')
  }

  // Get all leads from the list
  const entries = await leadListEntryRepo.findByListId(listId, organizationId)
  const leadIds = entries.filter((e) => !e.removedAt).map((e) => e.leadId)

  if (leadIds.length === 0) {
    return { enrolled: 0, skipped: 0, errors: [] }
  }

  return enrollLeads(campaignId, organizationId, leadIds)
}

export async function unenrollLead(
  campaignId: string,
  organizationId: string,
  enrollmentId: string,
): Promise<void> {
  // Verify campaign exists
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Verify enrollment exists
  const enrollment = await smsCampaignEnrollmentRepo.findById(enrollmentId)
  if (!enrollment || enrollment.campaignId !== campaignId) {
    throw new Error('Enrollment not found')
  }

  await smsCampaignEnrollmentRepo.deleteById(enrollmentId)
  await smsCampaignRepo.incrementStat(campaignId, 'totalEnrolled', -1)
}

// ============================================
// Stats
// ============================================

export async function getCampaignStats(
  campaignId: string,
  organizationId: string,
): Promise<SmsCampaignStatsResponse> {
  const campaign = await smsCampaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  const enrollmentCounts =
    await smsCampaignEnrollmentRepo.getStatusCounts(campaignId)
  const stepStats = await db
    .selectFrom('sms_campaign_step')
    .select([
      'stepNumber',
      'dayOffset',
      'totalSent',
      'totalDelivered',
      'totalFailed',
    ])
    .where('campaignId', '=', campaignId)
    .orderBy('stepNumber', 'asc')
    .execute()

  const deliveryRate =
    campaign.totalSent > 0 ? campaign.totalDelivered / campaign.totalSent : 0
  const replyRate =
    campaign.totalDelivered > 0
      ? campaign.totalReplied / campaign.totalDelivered
      : 0
  const unsubscribeRate =
    campaign.totalDelivered > 0
      ? campaign.totalUnsubscribed / campaign.totalDelivered
      : 0

  return {
    campaignId,
    totalEnrolled: campaign.totalEnrolled,
    totalSent: campaign.totalSent,
    totalDelivered: campaign.totalDelivered,
    totalReplied: campaign.totalReplied,
    totalUnsubscribed: campaign.totalUnsubscribed,
    deliveryRate,
    replyRate,
    unsubscribeRate,
    stepStats: stepStats.map((s) => ({
      stepNumber: s.stepNumber,
      dayOffset: s.dayOffset,
      totalSent: s.totalSent,
      totalDelivered: s.totalDelivered,
      totalFailed: s.totalFailed,
      deliveryRate: s.totalSent > 0 ? s.totalDelivered / s.totalSent : 0,
    })),
    enrollmentsByStatus: enrollmentCounts as Record<string, number>,
  }
}

// ============================================
// Transformers
// ============================================

function transformCampaign(campaign: any): SmsCampaignResponse {
  return {
    id: campaign.id,
    organizationId: campaign.organizationId,
    name: campaign.name,
    description: campaign.description,
    status: campaign.status,
    sendWindowStart: campaign.sendWindowStart,
    sendWindowEnd: campaign.sendWindowEnd,
    sendDays: campaign.sendDays,
    defaultTimezone: campaign.defaultTimezone,
    aiEnabled: campaign.aiEnabled,
    aiModel: campaign.aiModel,
    aiSystemPrompt: campaign.aiSystemPrompt,
    valueProposition: campaign.valueProposition,
    dailySendLimit: campaign.dailySendLimit,
    totalEnrolled: campaign.totalEnrolled,
    totalSent: campaign.totalSent,
    totalDelivered: campaign.totalDelivered,
    totalReplied: campaign.totalReplied,
    totalUnsubscribed: campaign.totalUnsubscribed,
    createdById: campaign.createdById,
    activatedAt: campaign.activatedAt?.toISOString() ?? null,
    completedAt: campaign.completedAt?.toISOString() ?? null,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  }
}

function transformCampaignWithSteps(campaign: any): SmsCampaignResponse {
  return {
    ...transformCampaign(campaign),
    steps: campaign.steps?.map(transformStep) ?? [],
  }
}

function transformStep(step: any): SmsCampaignStepResponse {
  return {
    id: step.id,
    campaignId: step.campaignId,
    stepNumber: step.stepNumber,
    dayOffset: step.dayOffset,
    messageTemplate: step.messageTemplate,
    aiEnabled: step.aiEnabled,
    aiPromptOverride: step.aiPromptOverride,
    skipIfReplied: step.skipIfReplied,
    totalSent: step.totalSent,
    totalDelivered: step.totalDelivered,
    totalFailed: step.totalFailed,
    createdAt: step.createdAt.toISOString(),
    updatedAt: step.updatedAt.toISOString(),
  }
}

function transformEnrollmentWithLead(
  enrollment: any,
): SmsCampaignEnrollmentResponse {
  return {
    id: enrollment.id,
    campaignId: enrollment.campaignId,
    leadId: enrollment.leadId,
    status: enrollment.status,
    currentStep: enrollment.currentStep,
    nextSendAt: enrollment.nextSendAt?.toISOString() ?? null,
    timezone: enrollment.timezone,
    lastSentAt: enrollment.lastSentAt?.toISOString() ?? null,
    repliedAt: enrollment.repliedAt?.toISOString() ?? null,
    unsubscribedAt: enrollment.unsubscribedAt?.toISOString() ?? null,
    enrolledAt: enrollment.enrolledAt.toISOString(),
    completedAt: enrollment.completedAt?.toISOString() ?? null,
    lead:
      enrollment.firstName !== undefined
        ? {
            id: enrollment.leadId,
            firstName: enrollment.firstName,
            lastName: enrollment.lastName,
            phone: enrollment.normalizedPhone || enrollment.phone,
            company: enrollment.company,
          }
        : undefined,
  }
}

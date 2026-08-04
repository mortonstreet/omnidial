import * as leadRepo from '@/repositories/lead.repository'
import * as campaignLeadRepo from '@/repositories/campaign-lead.repository'
import * as campaignRepo from '@/repositories/campaign.repository'
import * as noteRepo from '@/repositories/note.repository'
import * as taskRepo from '@/repositories/task.repository'
import * as callRepo from '@/repositories/call.repository'
import * as twilioConfigRepo from '@/repositories/twilioConfig.repository'
import * as activityService from '@/services/activity.service'
import { DBPagination } from '@shared/db/src/types'
import { parseSmartQuery } from './smartQuery.service'
import type {
  SmartQueryFilters,
  SmartQueryResponse,
  BulkAddToCampaignResponse,
  BulkAddToPipelineResponse,
  ActivityItem,
} from '@shared/types/src/requests/lead'

export interface CreateLeadParams {
  organizationId: string
  userId?: string
  firstName?: string
  lastName?: string
  email?: string
  phone: string
  company?: string
  title?: string
  linkedInUrl?: string
  customFields?: Record<string, string>
  pipelineStageId?: string
  dealValue?: number
}

export const create = async (params: CreateLeadParams) => {
  const lead = await leadRepo.create(params)

  // Log lead creation activity if userId is available
  if (params.userId) {
    try {
      const leadName =
        [params.firstName, params.lastName].filter(Boolean).join(' ') ||
        params.company ||
        params.phone
      await activityService.logLeadActivity({
        organizationId: params.organizationId,
        userId: params.userId,
        leadId: lead.id,
        action: 'added',
        leadName,
      })
    } catch (error) {
      console.error('Failed to log lead creation activity:', error)
    }
  }

  return lead
}

export const getById = async (id: string, organizationId: string) => {
  const lead = await leadRepo.findByIdWithClient(id, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }
  return lead
}

export interface ListLeadsParams {
  organizationId: string
  search?: string
  campaignId?: string
  clientId?: string
  pipelineStageId?: string
  inPipeline?: boolean
  includeDeleted?: boolean
  includeClient?: boolean
  // Smart query filters
  titleFilter?: leadRepo.SmartFilter
  emailFilter?: leadRepo.SmartFilter
  companyFilter?: leadRepo.SmartFilter
  createdAtFilter?: leadRepo.SmartFilter
  pagination: DBPagination
}

export const list = async (params: ListLeadsParams) => {
  const { pagination, ...filters } = params
  return leadRepo.findMany(filters, pagination)
}

export interface UpdateLeadParams {
  id: string
  organizationId: string
  firstName?: string
  lastName?: string
  email?: string | null
  phone?: string | null
  company?: string | null
  title?: string | null
  linkedInUrl?: string | null
  website?: string | null
  customFields?: Record<string, string>
  pipelineStageId?: string | null
  dealValue?: number | null
  clientId?: string | null
}

export const update = async (params: UpdateLeadParams) => {
  const { id, organizationId, ...data } = params

  const lead = await leadRepo.update(id, organizationId, data)
  if (!lead) {
    throw new Error('Lead not found')
  }
  return lead
}

export const remove = async (id: string, organizationId: string) => {
  const success = await leadRepo.softDelete(id, organizationId)
  if (!success) {
    throw new Error('Lead not found')
  }
  return { success: true }
}

// CRM: Move lead to a different pipeline stage
export const move = async (
  id: string,
  organizationId: string,
  pipelineStageId: string | null,
) => {
  const lead = await leadRepo.update(id, organizationId, { pipelineStageId })
  if (!lead) {
    throw new Error('Lead not found')
  }
  return lead
}

export const lookupByPhone = async (organizationId: string, phone: string) => {
  const lead = await leadRepo.findByPhone(organizationId, phone)
  return lead
}

export interface BulkCreateLeadsParams {
  organizationId: string
  campaignId: string
  leads: {
    firstName?: string
    lastName?: string
    email?: string
    phone: string
    normalizedPhone?: string | null
    company?: string
    title?: string
    linkedInUrl?: string
    customFields?: Record<string, string>
  }[]
}

export const bulkCreate = async (params: BulkCreateLeadsParams) => {
  const { organizationId, campaignId, leads } = params

  // Verify campaign exists
  const campaign = await campaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Create all leads
  const createdLeads = await leadRepo.createMany(organizationId, leads)

  // Get current max dial order
  const maxOrder = await campaignLeadRepo.getMaxDialOrder(campaignId)

  // Add leads to campaign
  const leadIds = createdLeads.map((l) => l.id)
  await campaignLeadRepo.createMany(campaignId, leadIds, maxOrder + 1)

  // Update campaign counts
  await campaignRepo.updateCounts(campaignId, organizationId)

  return {
    created: createdLeads.length,
    leads: createdLeads,
  }
}

// Smart query: Parse natural language and return matching leads
export interface SmartQueryParams {
  organizationId: string
  query: string
  previewOnly?: boolean
}

export const smartQuery = async (
  params: SmartQueryParams,
): Promise<SmartQueryResponse> => {
  const { organizationId, query, previewOnly = true } = params

  // Parse the natural language query
  const parsed = parseSmartQuery(query)

  // Convert smart query filters to repository filters
  const filters: leadRepo.LeadFilters = {
    organizationId,
    titleFilter: parsed.filters.title,
    emailFilter: parsed.filters.email,
    companyFilter: parsed.filters.company,
    createdAtFilter: parsed.filters.createdAt,
  }

  // Get count
  const previewCount = await leadRepo.countByFilters(filters)

  // Build response
  const response: SmartQueryResponse = {
    interpretation: {
      filters: parsed.filters,
      humanReadable: parsed.humanReadable,
    },
    previewCount,
  }

  // If not preview only, fetch actual leads
  if (!previewOnly) {
    const result = await leadRepo.findMany(filters, {
      page: 1,
      limit: 100,
      offset: 0,
    })
    response.leads = result.data.map((lead) => ({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      title: lead.title,
      createdAt: lead.createdAt,
    }))
  }

  return response
}

// Bulk add existing leads to a campaign
export interface BulkAddToCampaignParams {
  organizationId: string
  leadIds: string[]
  campaignId: string
}

export const bulkAddToCampaign = async (
  params: BulkAddToCampaignParams,
): Promise<BulkAddToCampaignResponse> => {
  const { organizationId, leadIds, campaignId } = params

  // Verify campaign exists
  const campaign = await campaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Verify all leads exist
  const existingLeads = await leadRepo.findByIds(leadIds, organizationId)
  const validLeadIds = existingLeads.map((l) => l.id)

  // Check which leads are already in the campaign
  const alreadyInCampaign = await campaignLeadRepo.findExistingLeadIds(
    campaignId,
    validLeadIds,
  )
  const alreadyInCampaignSet = new Set(alreadyInCampaign)

  // Filter to only new leads
  const newLeadIds = validLeadIds.filter((id) => !alreadyInCampaignSet.has(id))

  if (newLeadIds.length > 0) {
    // Get current max dial order
    const maxOrder = await campaignLeadRepo.getMaxDialOrder(campaignId)

    // Add leads to campaign
    await campaignLeadRepo.createMany(campaignId, newLeadIds, maxOrder + 1)

    // Update campaign counts
    await campaignRepo.updateCounts(campaignId, organizationId)
  }

  return {
    success: true,
    added: newLeadIds.length,
    alreadyInCampaign: alreadyInCampaign.length,
  }
}

// Bulk add existing leads to a pipeline stage
export interface BulkAddToPipelineParams {
  organizationId: string
  leadIds: string[]
  pipelineStageId: string
}

export const bulkAddToPipeline = async (
  params: BulkAddToPipelineParams,
): Promise<BulkAddToPipelineResponse> => {
  const { organizationId, leadIds, pipelineStageId } = params

  const result = await leadRepo.bulkUpdatePipelineStage(
    organizationId,
    leadIds,
    pipelineStageId,
  )

  return {
    success: true,
    updated: result.updated,
    alreadyInPipeline: result.alreadyInPipeline,
  }
}

// Get lead activity timeline (notes, tasks, calls combined)
export const getActivity = async (
  leadId: string,
  organizationId: string,
): Promise<ActivityItem[]> => {
  // Verify lead exists
  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // Fetch all activity types in parallel
  const [notesResult, tasks, calls] = await Promise.all([
    noteRepo.findByLeadId({ leadId, page: 1, limit: 100 }),
    taskRepo.findByLeadId(leadId),
    callRepo.findAllByLeadId(leadId),
  ])

  const activity: ActivityItem[] = []

  // Add notes
  for (const note of notesResult.data) {
    activity.push({
      id: note.id,
      type: 'note',
      content: note.content,
      createdAt: note.createdAt.toISOString(),
    })
  }

  // Add tasks
  for (const task of tasks) {
    activity.push({
      id: task.id,
      type: 'task',
      content: task.title,
      createdAt: task.createdAt.toISOString(),
      metadata: {
        completed: !!task.completedAt,
      },
    })
  }

  // Add calls
  for (const call of calls) {
    const content =
      call.direction === 'inbound'
        ? `Inbound call from ${call.fromNumber}`
        : `Outbound call to ${call.toNumber}`

    activity.push({
      id: call.id,
      type: 'call',
      content,
      createdAt: call.startedAt.toISOString(),
      metadata: {
        duration: call.duration,
        recordingUrl: call.recordingUrl,
        status: call.status,
        direction: call.direction,
      },
    })
  }

  // Sort by date descending
  activity.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  return activity
}

// Get lead call history with recordings
export interface GetCallHistoryParams {
  leadId: string
  organizationId: string
  pagination: DBPagination
}

export const getCallHistory = async (params: GetCallHistoryParams) => {
  const { leadId, organizationId, pagination } = params

  // Verify lead exists
  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // Retroactively link any orphaned calls (calls with no leadId) that match
  // this lead's phone number. This catches inbound calls where the webhook
  // failed to match the caller to a lead at the time of the call.
  if (lead.phone) {
    try {
      const twilioConfig =
        await twilioConfigRepo.findByOrganizationId(organizationId)
      if (twilioConfig) {
        await callRepo.linkOrphanedCallsByPhone(
          leadId,
          lead.phone,
          twilioConfig.id,
        )
      }
    } catch (error) {
      console.error('Error linking orphaned calls to lead:', error)
    }
  }

  // Get calls with dispositions
  const result = await callRepo.findByLeadId(leadId, pagination)

  return result
}

// Data cleanup: Find leads with a specific custom field key (for bad imports)
export interface FindLeadsByCustomFieldParams {
  organizationId: string
  customFieldKey: string
}

export const findLeadsByCustomField = async (
  params: FindLeadsByCustomFieldParams,
) => {
  const { organizationId, customFieldKey } = params
  return leadRepo.findByCustomFieldKey(organizationId, customFieldKey)
}

// bulkHardDelete moved to admin.service.ts — SUPERADMIN ONLY

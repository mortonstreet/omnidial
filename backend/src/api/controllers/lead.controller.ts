import * as leadService from '@/services/lead.service'
import * as companySummaryService from '@/services/companySummary.service'
import * as timezoneService from '@/services/timezone.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  ListLeadsRequest,
  GetLeadRequest,
  CreateLeadRequest,
  UpdateLeadRequest,
  DeleteLeadRequest,
  MoveLeadRequest,
  LookupLeadRequest,
  BulkCreateLeadsRequest,
  SmartQueryRequest,
  BulkAddToCampaignRequest,
  BulkAddToPipelineRequest,
  GetLeadActivityRequest,
  GetLeadCallsRequest,
  GenerateCompanySummaryRequest,
} from '@shared/types/src'

export const listLeads: AuthRequestHandler<ListLeadsRequest> = async (
  req,
  res,
) => {
  const {
    organizationId,
    search,
    campaignId,
    clientId,
    pipelineStageId,
    inPipeline,
    includeDeleted,
    includeClient,
    titleFilter,
    emailFilter,
    companyFilter,
    createdAtFilter,
    page,
    limit,
  } = req.validated

  const result = await leadService.list({
    organizationId,
    search,
    campaignId,
    clientId,
    pipelineStageId,
    inPipeline,
    includeDeleted,
    includeClient,
    titleFilter,
    emailFilter,
    companyFilter,
    createdAtFilter,
    pagination: { page, limit, offset: (page - 1) * limit },
  })

  res.json({
    data: result.data,
    pagination: {
      page,
      limit,
      total: result.total,
      totalPages: Math.ceil(result.total / limit),
      hasNextPage: page * limit < result.total,
      hasPrevPage: page > 1,
    },
  })
}

export const getLead: AuthRequestHandler<GetLeadRequest> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    const lead = await leadService.getById(id, organizationId)
    res.json(lead)
  } catch (error) {
    res.status(404).json({ error: 'Lead not found' })
  }
}

export const createLead: AuthRequestHandler<CreateLeadRequest> = async (
  req,
  res,
) => {
  try {
    const lead = await leadService.create({
      ...req.validated,
      userId: req.user.id,
    })
    res.status(201).json(lead)
  } catch (error) {
    console.error('Failed to create lead:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create lead'
    res.status(500).json({ error: message })
  }
}

export const updateLead: AuthRequestHandler<UpdateLeadRequest> = async (
  req,
  res,
) => {
  try {
    const lead = await leadService.update(req.validated)
    res.json(lead)
  } catch (error) {
    res.status(404).json({ error: 'Lead not found' })
  }
}

export const deleteLead: AuthRequestHandler<DeleteLeadRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    await leadService.remove(id, organizationId)
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'Lead not found' })
  }
}

export const moveLead: AuthRequestHandler<MoveLeadRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, pipelineStageId } = req.validated

  try {
    const lead = await leadService.move(id, organizationId, pipelineStageId)
    res.json(lead)
  } catch (error) {
    res.status(404).json({ error: 'Lead not found' })
  }
}

export const lookupLead: AuthRequestHandler<LookupLeadRequest> = async (
  req,
  res,
) => {
  const { organizationId, phone } = req.validated

  const lead = await leadService.lookupByPhone(organizationId, phone)

  if (!lead) {
    res.status(404).json({ error: 'Lead not found' })
    return
  }

  res.json(lead)
}

export const bulkCreateLeads: AuthRequestHandler<
  BulkCreateLeadsRequest
> = async (req, res) => {
  try {
    const result = await leadService.bulkCreate(req.validated)
    res.status(201).json(result)
  } catch (error) {
    if ((error as Error).message === 'Campaign not found') {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }
    throw error
  }
}

// Smart query: Parse natural language and return matching leads
export const smartQuery: AuthRequestHandler<SmartQueryRequest> = async (
  req,
  res,
) => {
  const result = await leadService.smartQuery(req.validated)
  res.json(result)
}

// Bulk add existing leads to a campaign
export const bulkAddToCampaign: AuthRequestHandler<
  BulkAddToCampaignRequest
> = async (req, res) => {
  try {
    const result = await leadService.bulkAddToCampaign(req.validated)
    res.json(result)
  } catch (error) {
    if ((error as Error).message === 'Campaign not found') {
      res.status(404).json({ error: 'Campaign not found' })
      return
    }
    throw error
  }
}

// Bulk add existing leads to a pipeline stage
export const bulkAddToPipeline: AuthRequestHandler<
  BulkAddToPipelineRequest
> = async (req, res) => {
  const result = await leadService.bulkAddToPipeline(req.validated)
  res.json(result)
}

// Get lead activity timeline
export const getLeadActivity: AuthRequestHandler<
  GetLeadActivityRequest
> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    const activity = await leadService.getActivity(id, organizationId)
    res.json({ data: activity })
  } catch (error) {
    res.status(404).json({ error: 'Lead not found' })
  }
}

// Get lead call history with recordings
export const getLeadCalls: AuthRequestHandler<GetLeadCallsRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, page, limit } = req.validated

  try {
    const result = await leadService.getCallHistory({
      leadId: id,
      organizationId,
      pagination: { page, limit, offset: (page - 1) * limit },
    })

    res.json({
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNextPage: page * limit < result.total,
        hasPrevPage: page > 1,
      },
    })
  } catch (error) {
    res.status(404).json({ error: 'Lead not found' })
  }
}

// Generate AI company summary for a lead
export const generateCompanySummary: AuthRequestHandler<
  GenerateCompanySummaryRequest
> = async (req, res) => {
  const { id, organizationId, forceRegenerate } = req.validated

  try {
    const result = await companySummaryService.generateCompanySummary({
      leadId: id,
      organizationId,
      forceRegenerate,
    })
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to generate summary'

    if (message === 'Lead not found') {
      res.status(404).json({ error: message })
      return
    }
    if (message === 'Lead has no company name') {
      res.status(400).json({ error: message })
      return
    }
    if (message === 'OpenRouter API key not configured') {
      res.status(503).json({ error: 'AI service not configured' })
      return
    }

    console.error('Failed to generate company summary:', error)
    res.status(500).json({ error: message })
  }
}

// Enrich lead with company info extracted from website
export const enrichLeadFromWebsite: AuthRequestHandler<
  GenerateCompanySummaryRequest // Reusing same request type (id + organizationId)
> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    const result = await companySummaryService.enrichLeadFromWebsite({
      leadId: id,
      organizationId,
      autoUpdate: false, // Don't auto-update, let frontend confirm
    })
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to extract company info'

    if (message === 'Lead not found') {
      res.status(404).json({ error: message })
      return
    }

    console.error('Failed to enrich lead from website:', error)
    res.status(500).json({ error: message })
  }
}

// Resolve timezone for a lead from LinkedIn location
export const resolveTimezone: AuthRequestHandler<
  GenerateCompanySummaryRequest // Reusing same request type (id + organizationId)
> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    const result = await timezoneService.resolveTimezone({
      leadId: id,
      organizationId,
    })
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to resolve timezone'

    if (message === 'Lead not found') {
      res.status(404).json({ error: message })
      return
    }

    console.error('Failed to resolve timezone:', error)
    res.status(500).json({ error: message })
  }
}

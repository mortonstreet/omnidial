import { AuthRequestHandler } from '@/types/handlers'
import * as smsCampaignService from '@/services/smsCampaign.service'
import type {
  ListSmsCampaignsRequest,
  GetSmsCampaignRequest,
  CreateSmsCampaignRequest,
  UpdateSmsCampaignRequest,
  DeleteSmsCampaignRequest,
  ActivateSmsCampaignRequest,
  PauseSmsCampaignRequest,
  AddSmsCampaignStepRequest,
  UpdateSmsCampaignStepRequest,
  DeleteSmsCampaignStepRequest,
  AttachSmsCampaignListRequest,
  DetachSmsCampaignListRequest,
  ListSmsCampaignEnrollmentsRequest,
  EnrollLeadsRequest,
  EnrollFromListRequest,
  UnenrollLeadRequest,
  GetSmsCampaignStatsRequest,
} from '@shared/types/src/requests/smsCampaign'

// ============================================
// Campaign CRUD
// ============================================

export const listCampaigns: AuthRequestHandler<
  ListSmsCampaignsRequest
> = async (req, res) => {
  const { organizationId, status, search, page, limit } = req.validated

  const result = await smsCampaignService.listCampaigns({
    organizationId,
    status,
    search,
    pagination: { page, limit, offset: (page - 1) * limit },
  })

  res.json(result)
}

export const getCampaign: AuthRequestHandler<GetSmsCampaignRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    const campaign = await smsCampaignService.getCampaignById(
      id,
      organizationId,
    )
    res.json(campaign)
  } catch (error) {
    res.status(404).json({ error: 'Campaign not found' })
  }
}

export const createCampaign: AuthRequestHandler<
  CreateSmsCampaignRequest
> = async (req, res) => {
  const {
    organizationId,
    name,
    description,
    sendWindowStart,
    sendWindowEnd,
    sendDays,
    defaultTimezone,
    aiEnabled,
    aiModel,
    aiSystemPrompt,
    valueProposition,
    dailySendLimit,
  } = req.validated

  try {
    const campaign = await smsCampaignService.createCampaign({
      organizationId,
      createdById: req.user.id,
      name,
      description,
      sendWindowStart,
      sendWindowEnd,
      sendDays,
      defaultTimezone,
      aiEnabled,
      aiModel,
      aiSystemPrompt,
      valueProposition,
      dailySendLimit,
    })

    res.status(201).json(campaign)
  } catch (error) {
    console.error('Failed to create SMS campaign:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create campaign'
    res.status(500).json({ error: message })
  }
}

export const updateCampaign: AuthRequestHandler<
  UpdateSmsCampaignRequest
> = async (req, res) => {
  const {
    id,
    organizationId,
    name,
    description,
    sendWindowStart,
    sendWindowEnd,
    sendDays,
    defaultTimezone,
    aiEnabled,
    aiModel,
    aiSystemPrompt,
    valueProposition,
    dailySendLimit,
  } = req.validated

  try {
    const campaign = await smsCampaignService.updateCampaign({
      id,
      organizationId,
      name,
      description,
      sendWindowStart,
      sendWindowEnd,
      sendDays,
      defaultTimezone,
      aiEnabled,
      aiModel,
      aiSystemPrompt,
      valueProposition,
      dailySendLimit,
    })
    res.json(campaign)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const deleteCampaign: AuthRequestHandler<
  DeleteSmsCampaignRequest
> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    await smsCampaignService.deleteCampaign(id, organizationId)
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Delete failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

// ============================================
// Campaign Actions
// ============================================

export const activateCampaign: AuthRequestHandler<
  ActivateSmsCampaignRequest
> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    const campaign = await smsCampaignService.activateCampaign(
      id,
      organizationId,
    )
    res.json(campaign)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Activation failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const pauseCampaign: AuthRequestHandler<
  PauseSmsCampaignRequest
> = async (req, res) => {
  const { id, organizationId } = req.validated

  try {
    const campaign = await smsCampaignService.pauseCampaign(id, organizationId)
    res.json(campaign)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Pause failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

// ============================================
// Campaign Steps
// ============================================

export const addStep: AuthRequestHandler<AddSmsCampaignStepRequest> = async (
  req,
  res,
) => {
  const {
    id,
    organizationId,
    stepNumber,
    dayOffset,
    messageTemplate,
    aiEnabled,
    aiPromptOverride,
    skipIfReplied,
  } = req.validated

  try {
    const step = await smsCampaignService.addStep({
      campaignId: id,
      organizationId,
      stepNumber,
      dayOffset,
      messageTemplate,
      aiEnabled,
      aiPromptOverride,
      skipIfReplied,
    })
    res.status(201).json(step)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Add step failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const updateStep: AuthRequestHandler<
  UpdateSmsCampaignStepRequest
> = async (req, res) => {
  const {
    id,
    stepId,
    organizationId,
    stepNumber,
    dayOffset,
    messageTemplate,
    aiEnabled,
    aiPromptOverride,
    skipIfReplied,
  } = req.validated

  try {
    const step = await smsCampaignService.updateStep({
      stepId,
      campaignId: id,
      organizationId,
      stepNumber,
      dayOffset,
      messageTemplate,
      aiEnabled,
      aiPromptOverride,
      skipIfReplied,
    })
    res.json(step)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Update step failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const deleteStep: AuthRequestHandler<
  DeleteSmsCampaignStepRequest
> = async (req, res) => {
  const { id, stepId, organizationId } = req.validated

  try {
    await smsCampaignService.deleteStep(stepId, id, organizationId)
    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Delete step failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

// ============================================
// Campaign Lists
// ============================================

export const attachList: AuthRequestHandler<
  AttachSmsCampaignListRequest
> = async (req, res) => {
  const { id, organizationId, listId } = req.validated

  try {
    await smsCampaignService.attachList(id, organizationId, listId)
    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Attach list failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const detachList: AuthRequestHandler<
  DetachSmsCampaignListRequest
> = async (req, res) => {
  const { id, listId, organizationId } = req.validated

  try {
    await smsCampaignService.detachList(id, organizationId, listId)
    res.json({ success: true })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Detach list failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

// ============================================
// Enrollments
// ============================================

export const listEnrollments: AuthRequestHandler<
  ListSmsCampaignEnrollmentsRequest
> = async (req, res) => {
  const { id, organizationId, status, page, limit } = req.validated

  try {
    const result = await smsCampaignService.listEnrollments({
      campaignId: id,
      organizationId,
      status,
      pagination: { page, limit, offset: (page - 1) * limit },
    })
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'List enrollments failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const enrollLeads: AuthRequestHandler<EnrollLeadsRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, leadIds } = req.validated

  try {
    const result = await smsCampaignService.enrollLeads(
      id,
      organizationId,
      leadIds,
    )
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enroll failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const enrollFromList: AuthRequestHandler<EnrollFromListRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, listId } = req.validated

  try {
    const result = await smsCampaignService.enrollFromList(
      id,
      organizationId,
      listId,
    )
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Enroll from list failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

export const unenrollLead: AuthRequestHandler<UnenrollLeadRequest> = async (
  req,
  res,
) => {
  const { id, enrollmentId, organizationId } = req.validated

  try {
    await smsCampaignService.unenrollLead(id, organizationId, enrollmentId)
    res.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unenroll failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

// ============================================
// Stats
// ============================================

export const getStats: AuthRequestHandler<GetSmsCampaignStatsRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    const stats = await smsCampaignService.getCampaignStats(id, organizationId)
    res.json(stats)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Get stats failed'
    if (message.includes('not found')) {
      res.status(404).json({ error: message })
    } else {
      res.status(400).json({ error: message })
    }
  }
}

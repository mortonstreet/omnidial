import * as campaignService from '@/services/campaign.service'
import * as activityService from '@/services/activity.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  ListCampaignsRequest,
  GetCampaignRequest,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  DeleteCampaignRequest,
  AssignLeadsRequest,
  GetCampaignLeadsRequest,
  UploadCsvRequest,
} from '@shared/types/src'
import { addCsvImportJob } from '@/queues/csv-import.queue'
import { CsvImportEventType } from '@/types/queues'

export const listCampaigns: AuthRequestHandler<ListCampaignsRequest> = async (
  req,
  res,
) => {
  const { organizationId, clientId, status, search, page, limit } =
    req.validated

  const result = await campaignService.list({
    organizationId,
    clientId,
    status,
    search,
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

export const getCampaign: AuthRequestHandler<GetCampaignRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    const campaign = await campaignService.getById(id, organizationId)
    res.json(campaign)
  } catch (error) {
    res.status(404).json({ error: 'Campaign not found' })
  }
}

export const createCampaign: AuthRequestHandler<CreateCampaignRequest> = async (
  req,
  res,
) => {
  const { organizationId, name, clientId, listId, assignedUserIds } =
    req.validated

  try {
    const campaign = await campaignService.create({
      organizationId,
      createdById: req.user.id,
      name,
      clientId,
      listId,
      assignedUserIds,
    })

    // Log campaign creation activity
    try {
      await activityService.logCampaignCreated({
        organizationId,
        userId: req.user.id,
        campaignId: campaign.id,
        campaignName: name,
      })
    } catch (error) {
      console.error('Failed to log campaign creation activity:', error)
    }

    res.status(201).json(campaign)
  } catch (error) {
    console.error('Failed to create campaign:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to create campaign'
    res.status(500).json({ error: message })
  }
}

export const updateCampaign: AuthRequestHandler<UpdateCampaignRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, name, clientId, assignedUserIds } = req.validated

  try {
    const campaign = await campaignService.update({
      id,
      organizationId,
      name,
      clientId,
      assignedUserIds,
    })
    res.json(campaign)
  } catch (error) {
    res.status(404).json({ error: 'Campaign not found' })
  }
}

export const deleteCampaign: AuthRequestHandler<DeleteCampaignRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    await campaignService.remove(id, organizationId)
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'Campaign not found' })
  }
}

export const assignLeads: AuthRequestHandler<AssignLeadsRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, userIds } = req.validated

  try {
    const result = await campaignService.assignLeadsRoundRobin({
      campaignId: id,
      organizationId,
      userIds,
    })
    res.json(result)
  } catch (error) {
    res.status(404).json({ error: 'Campaign not found' })
  }
}

export const getCampaignLeads: AuthRequestHandler<
  GetCampaignLeadsRequest
> = async (req, res) => {
  const { id, organizationId, status, assignedUserId, page, limit } =
    req.validated

  try {
    const result = await campaignService.getCampaignLeads(
      id,
      organizationId,
      { status, assignedUserId },
      { page, limit, offset: (page - 1) * limit },
    )

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
    res.status(404).json({ error: 'Campaign not found' })
  }
}

export const uploadCsv: AuthRequestHandler<UploadCsvRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  // Verify campaign exists
  try {
    await campaignService.getById(id, organizationId)
  } catch (error) {
    res.status(404).json({ error: 'Campaign not found' })
    return
  }

  // Get file from request (expects multipart form data with 'file' field)
  const file = (req as any).file
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

  // Validate file type
  const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel']
  if (
    !allowedMimeTypes.includes(file.mimetype) &&
    !file.originalname.endsWith('.csv')
  ) {
    res
      .status(400)
      .json({ error: 'Invalid file type. Please upload a CSV file.' })
    return
  }

  // Convert file buffer to base64
  const fileContent = file.buffer.toString('base64')

  // Queue the CSV import job
  const jobId = await addCsvImportJob({
    type: CsvImportEventType.PROCESS_CSV,
    organizationId,
    campaignId: id,
    userId: req.user.id,
    fileContent,
    fileName: file.originalname,
  })

  res.json({
    success: true,
    message: 'CSV upload queued for processing',
    jobId,
  })
}

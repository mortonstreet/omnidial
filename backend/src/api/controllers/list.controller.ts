import * as listService from '@/services/leadList.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  ListFoldersRequest,
  CreateFolderRequest,
  UpdateFolderRequest,
  DeleteFolderRequest,
  ReorderFoldersRequest,
  ListListsRequest,
  GetListRequest,
  CreateListRequest,
  UpdateListRequest,
  DeleteListRequest,
  UploadListCsvRequest,
  GetListLeadsRequest,
  AddLeadsToListRequest,
  RemoveLeadsFromListRequest,
  SoftRemoveLeadFromListRequest,
  AddListToCampaignRequest,
  RemoveListFromCampaignRequest,
  GetCampaignListsRequest,
  ExportListLeadsRequest,
  ToggleFavoriteRequest,
  GetFavoritesRequest,
  GetFavoriteIdsRequest,
  RecordListOpenRequest,
  RecordFolderOpenRequest,
  GetRecentsRequest,
} from '@shared/types/src'
import { addListCsvImportJob } from '@/queues/list-csv-import.queue'
import { ListCsvImportEventType } from '@/types/queues'

// ======= FOLDER HANDLERS =======

export const listFolders: AuthRequestHandler<ListFoldersRequest> = async (
  req,
  res,
) => {
  const { organizationId } = req.validated
  const folders = await listService.listFolders(organizationId)
  res.json({ data: folders })
}

export const createFolder: AuthRequestHandler<CreateFolderRequest> = async (
  req,
  res,
) => {
  const folder = await listService.createFolder(req.validated)
  res.status(201).json(folder)
}

export const updateFolder: AuthRequestHandler<UpdateFolderRequest> = async (
  req,
  res,
) => {
  try {
    const folder = await listService.updateFolder(req.validated)
    res.json(folder)
  } catch (error) {
    res.status(404).json({ error: 'Folder not found' })
  }
}

export const deleteFolder: AuthRequestHandler<DeleteFolderRequest> = async (
  req,
  res,
) => {
  try {
    await listService.deleteFolder(
      req.validated.id,
      req.validated.organizationId,
    )
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'Folder not found' })
  }
}

export const reorderFolders: AuthRequestHandler<ReorderFoldersRequest> = async (
  req,
  res,
) => {
  await listService.reorderFolders(
    req.validated.organizationId,
    req.validated.folderIds,
  )
  res.json({ success: true })
}

// ======= LIST HANDLERS =======

export const listLists: AuthRequestHandler<ListListsRequest> = async (
  req,
  res,
) => {
  const { organizationId, folderId, search, page, limit } = req.validated
  const result = await listService.listLists(
    { organizationId, folderId, search },
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
}

export const getList: AuthRequestHandler<GetListRequest> = async (req, res) => {
  try {
    const list = await listService.getList(
      req.validated.id,
      req.validated.organizationId,
    )
    res.json(list)
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

export const createList: AuthRequestHandler<CreateListRequest> = async (
  req,
  res,
) => {
  const list = await listService.createList({
    ...req.validated,
    createdById: req.user.id,
  })
  res.status(201).json(list)
}

export const updateList: AuthRequestHandler<UpdateListRequest> = async (
  req,
  res,
) => {
  try {
    const list = await listService.updateList(req.validated)
    res.json(list)
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

export const deleteList: AuthRequestHandler<DeleteListRequest> = async (
  req,
  res,
) => {
  try {
    await listService.deleteList(req.validated.id, req.validated.organizationId)
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

export const uploadListCsv: AuthRequestHandler<UploadListCsvRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    await listService.getList(id, organizationId)
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
    return
  }

  const file = (req as any).file
  if (!file) {
    res.status(400).json({ error: 'No file uploaded' })
    return
  }

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

  const fileContent = file.buffer.toString('base64')

  const jobId = await addListCsvImportJob({
    type: ListCsvImportEventType.PROCESS_CSV,
    organizationId,
    listId: id,
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

// ======= LIST LEADS HANDLERS =======

export const getListLeads: AuthRequestHandler<GetListLeadsRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, search, page, limit } = req.validated
  try {
    const result = await listService.getListLeads(
      id,
      organizationId,
      { search },
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
    res.status(404).json({ error: 'List not found' })
  }
}

export const addLeadsToList: AuthRequestHandler<AddLeadsToListRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, leadIds } = req.validated
  try {
    const result = await listService.addLeadsToList(id, organizationId, leadIds)
    res.json(result)
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

export const removeLeadsFromList: AuthRequestHandler<
  RemoveLeadsFromListRequest
> = async (req, res) => {
  const { id, organizationId, leadIds } = req.validated
  try {
    const result = await listService.removeLeadsFromList(
      id,
      organizationId,
      leadIds,
    )
    res.json(result)
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

// Soft-remove a single lead from list (for power dialer - preserves data)
export const softRemoveLeadFromList: AuthRequestHandler<
  SoftRemoveLeadFromListRequest
> = async (req, res) => {
  const { id, organizationId, leadId } = req.validated
  try {
    const result = await listService.softRemoveLeadsFromList(
      id,
      organizationId,
      [leadId],
    )
    res.json({ success: result.removed > 0 })
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

// ======= CAMPAIGN-LIST LINKING HANDLERS =======

export const addListToCampaign: AuthRequestHandler<
  AddListToCampaignRequest
> = async (req, res) => {
  try {
    const result = await listService.addListToCampaign(
      req.validated.campaignId,
      req.validated.listId,
      req.validated.organizationId,
    )
    res.json(result)
  } catch (error) {
    res.status(404).json({ error: (error as Error).message })
  }
}

export const removeListFromCampaign: AuthRequestHandler<
  RemoveListFromCampaignRequest
> = async (req, res) => {
  try {
    const result = await listService.removeListFromCampaign(
      req.validated.campaignId,
      req.validated.listId,
      req.validated.organizationId,
    )
    res.json(result)
  } catch (error) {
    res.status(404).json({ error: (error as Error).message })
  }
}

export const getCampaignLists: AuthRequestHandler<
  GetCampaignListsRequest
> = async (req, res) => {
  const lists = await listService.getCampaignLists(req.validated.campaignId)
  res.json({ data: lists })
}

// ======= EXPORT HANDLER =======

export const exportListLeads: AuthRequestHandler<
  ExportListLeadsRequest
> = async (req, res) => {
  try {
    const { csv, fileName } = await listService.exportListLeads(
      req.validated.id,
      req.validated.organizationId,
    )
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.send(csv)
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

// ======= FAVORITES HANDLERS =======

export const toggleFavorite: AuthRequestHandler<ToggleFavoriteRequest> = async (
  req,
  res,
) => {
  try {
    const result = await listService.toggleFavorite(
      req.user.id,
      req.validated.organizationId,
      req.validated.itemId,
      req.validated.type,
    )
    res.json(result)
  } catch (error) {
    res.status(404).json({ error: (error as Error).message })
  }
}

export const getFavorites: AuthRequestHandler<GetFavoritesRequest> = async (
  req,
  res,
) => {
  const favorites = await listService.getFavorites(
    req.user.id,
    req.validated.organizationId,
  )
  res.json(favorites)
}

export const getFavoriteIds: AuthRequestHandler<GetFavoriteIdsRequest> = async (
  req,
  res,
) => {
  const ids = await listService.getFavoriteIds(
    req.user.id,
    req.validated.organizationId,
  )
  res.json(ids)
}

// ======= RECENTS HANDLERS =======

export const recordListOpen: AuthRequestHandler<RecordListOpenRequest> = async (
  req,
  res,
) => {
  try {
    await listService.recordListOpen(
      req.user.id,
      req.validated.id,
      req.validated.organizationId,
    )
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'List not found' })
  }
}

export const recordFolderOpen: AuthRequestHandler<
  RecordFolderOpenRequest
> = async (req, res) => {
  try {
    await listService.recordFolderOpen(
      req.user.id,
      req.validated.id,
      req.validated.organizationId,
    )
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'Folder not found' })
  }
}

export const getRecents: AuthRequestHandler<GetRecentsRequest> = async (
  req,
  res,
) => {
  const recents = await listService.getRecents(
    req.user.id,
    req.validated.organizationId,
    req.validated.limit ?? 20,
  )
  res.json({ data: recents })
}

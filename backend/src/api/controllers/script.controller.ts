import * as scriptService from '@/services/script.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  ListScriptsRequest,
  GetScriptRequest,
  CreateScriptRequest,
  UpdateScriptRequest,
  DeleteScriptRequest,
} from '@shared/types/src'

export const listScripts: AuthRequestHandler<ListScriptsRequest> = async (
  req,
  res,
) => {
  const { organizationId, campaignId, page, limit } = req.validated

  const result = await scriptService.list({
    organizationId,
    campaignId,
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

export const getScript: AuthRequestHandler<GetScriptRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    const script = await scriptService.getById(id, organizationId)
    res.json(script)
  } catch (error) {
    res.status(404).json({ error: 'Script not found' })
  }
}

export const createScript: AuthRequestHandler<CreateScriptRequest> = async (
  req,
  res,
) => {
  const { organizationId, name, content, campaignId, isDefault } = req.validated

  const script = await scriptService.create({
    organizationId,
    name,
    content,
    campaignId,
    isDefault,
  })

  res.status(201).json(script)
}

export const updateScript: AuthRequestHandler<UpdateScriptRequest> = async (
  req,
  res,
) => {
  const { id, organizationId, name, content, campaignId, isDefault } =
    req.validated

  try {
    const script = await scriptService.update({
      id,
      organizationId,
      name,
      content,
      campaignId,
      isDefault,
    })
    res.json(script)
  } catch (error) {
    res.status(404).json({ error: 'Script not found' })
  }
}

export const deleteScript: AuthRequestHandler<DeleteScriptRequest> = async (
  req,
  res,
) => {
  const { id, organizationId } = req.validated

  try {
    await scriptService.remove(id, organizationId)
    res.json({ success: true })
  } catch (error) {
    res.status(404).json({ error: 'Script not found' })
  }
}

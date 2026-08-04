import * as apiKeyService from '@/services/apiKey.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  ListApiKeysRequest,
  GetApiKeyRequest,
  CreateApiKeyRequest,
  RevokeApiKeyRequest,
  GetApiKeyUsageRequest,
} from '@shared/types/src'

export const listApiKeys: AuthRequestHandler<ListApiKeysRequest> = async (
  req,
  res,
) => {
  const { organizationId, page, limit } = req.validated

  const result = await apiKeyService.listApiKeys(organizationId, {
    page,
    limit,
    offset: (page - 1) * limit,
  })

  res.json({
    data: result.data,
    total: result.total,
    page,
    limit,
  })
}

export const getApiKey: AuthRequestHandler<GetApiKeyRequest> = async (
  req,
  res,
) => {
  const { id } = req.validated

  const apiKey = await apiKeyService.getApiKeyById(id)
  if (!apiKey) {
    res.status(404).json({ error: 'API key not found' })
    return
  }

  res.json({ data: apiKey })
}

export const createApiKey: AuthRequestHandler<CreateApiKeyRequest> = async (
  req,
  res,
) => {
  const { organizationId, name, scopes, expiresInDays } = req.validated

  const result = await apiKeyService.createApiKey(
    organizationId,
    req.user.id,
    name,
    scopes,
    expiresInDays,
  )

  res.status(201).json({ data: result })
}

export const revokeApiKey: AuthRequestHandler<RevokeApiKeyRequest> = async (
  req,
  res,
) => {
  const { id } = req.validated

  await apiKeyService.revokeApiKey(id)
  res.json({ success: true })
}

export const getApiKeyUsage: AuthRequestHandler<GetApiKeyUsageRequest> = async (
  req,
  res,
) => {
  const { id, startDate, endDate } = req.validated

  const usage = await apiKeyService.getApiKeyUsage(id, startDate, endDate)
  res.json({ data: usage })
}

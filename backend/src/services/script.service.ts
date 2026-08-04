import * as scriptRepo from '@/repositories/script.repository'
import { DBPagination } from '@shared/db/src/types'

export interface CreateScriptParams {
  organizationId: string
  name: string
  content: string
  campaignId?: string
  isDefault?: boolean
}

export const create = async (params: CreateScriptParams) => {
  return scriptRepo.create(params)
}

export const getById = async (id: string, organizationId: string) => {
  const script = await scriptRepo.findByIdAndOrg(id, organizationId)
  if (!script) {
    throw new Error('Script not found')
  }
  return script
}

export interface ListScriptsParams {
  organizationId: string
  campaignId?: string
  pagination: DBPagination
}

export const list = async (params: ListScriptsParams) => {
  return scriptRepo.findMany(
    {
      organizationId: params.organizationId,
      campaignId: params.campaignId,
    },
    params.pagination,
  )
}

export const getByCampaign = async (campaignId: string) => {
  return scriptRepo.findByCampaignId(campaignId)
}

export const getDefaultForOrg = async (organizationId: string) => {
  return scriptRepo.findDefaultForOrg(organizationId)
}

export interface UpdateScriptParams {
  id: string
  organizationId: string
  name?: string
  content?: string
  campaignId?: string | null
  isDefault?: boolean
}

export const update = async (params: UpdateScriptParams) => {
  const { id, organizationId, ...data } = params

  const script = await scriptRepo.update(id, organizationId, data)
  if (!script) {
    throw new Error('Script not found')
  }

  return script
}

export const remove = async (id: string, organizationId: string) => {
  const result = await scriptRepo.deleteById(id, organizationId)
  if (!result || Number(result.numDeletedRows) === 0) {
    throw new Error('Script not found')
  }
  return { success: true }
}

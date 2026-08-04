import * as clientRepo from '@/repositories/client.repository'

export interface CreateClientParams {
  organizationId: string
  name: string
  color?: string
}

export const create = async (params: CreateClientParams) => {
  return clientRepo.create(params)
}

export const getById = async (id: string, organizationId: string) => {
  const client = await clientRepo.findById(id, organizationId)
  if (!client) {
    throw new Error('Client not found')
  }

  const campaignCount = await clientRepo.getCampaignCount(id)
  return {
    ...client,
    campaignCount,
  }
}

export const list = async (organizationId: string) => {
  return clientRepo.findByOrganization(organizationId)
}

export interface UpdateClientParams {
  id: string
  organizationId: string
  name?: string
  color?: string
}

export const update = async (params: UpdateClientParams) => {
  const { id, organizationId, ...data } = params

  const client = await clientRepo.update(id, organizationId, data)
  if (!client) {
    throw new Error('Client not found')
  }

  return client
}

export const remove = async (id: string, organizationId: string) => {
  // Check if client has campaigns
  const campaignCount = await clientRepo.getCampaignCount(id)
  if (campaignCount > 0) {
    throw new Error(
      `Cannot delete client with ${campaignCount} campaign(s). Please reassign or delete the campaigns first.`,
    )
  }

  const success = await clientRepo.remove(id, organizationId)
  if (!success) {
    throw new Error('Client not found')
  }
  return { success: true }
}

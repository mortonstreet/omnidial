import * as campaignRepo from '@/repositories/campaign.repository'
import * as campaignLeadRepo from '@/repositories/campaign-lead.repository'
import * as campaignListRepo from '@/repositories/campaignList.repository'
import { DBPagination } from '@shared/db/src/types'

export interface CreateCampaignParams {
  organizationId: string
  createdById: string
  name: string
  clientId?: string
  listId?: string
  assignedUserIds?: string[]
}

export const create = async (params: CreateCampaignParams) => {
  const campaign = await campaignRepo.create({
    organizationId: params.organizationId,
    createdById: params.createdById,
    name: params.name,
    clientId: params.clientId,
  })

  // If a list was provided, link it to the campaign
  if (params.listId) {
    await campaignListRepo.addListToCampaign(campaign.id, params.listId)
  }

  if (params.assignedUserIds?.length) {
    await campaignRepo.addUsers(campaign.id, params.assignedUserIds)
  }

  return campaign
}

export const getById = async (id: string, organizationId: string) => {
  const campaign = await campaignRepo.findById(id, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  const users = await campaignRepo.getCampaignUsers(id)

  return {
    ...campaign,
    assignedUsers: users,
  }
}

export interface ListCampaignsParams {
  organizationId: string
  clientId?: string
  status?: 'active' | 'inactive'
  search?: string
  createdById?: string
  pagination: DBPagination
}

export const list = async (params: ListCampaignsParams) => {
  const { pagination, ...filters } = params
  return campaignRepo.findMany(filters, pagination)
}

export interface UpdateCampaignParams {
  id: string
  organizationId: string
  name?: string
  clientId?: string | null
  assignedUserIds?: string[]
}

export const update = async (params: UpdateCampaignParams) => {
  const { id, organizationId, assignedUserIds, ...data } = params

  const campaign = await campaignRepo.update(id, organizationId, data)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  if (assignedUserIds !== undefined) {
    await campaignRepo.removeUsers(id)
    if (assignedUserIds.length > 0) {
      await campaignRepo.addUsers(id, assignedUserIds)
    }
  }

  return campaign
}

export const remove = async (id: string, organizationId: string) => {
  const success = await campaignRepo.remove(id, organizationId)
  if (!success) {
    throw new Error('Campaign not found')
  }
  return { success: true }
}

export interface AssignLeadsParams {
  campaignId: string
  organizationId: string
  userIds: string[]
}

export const assignLeadsRoundRobin = async (params: AssignLeadsParams) => {
  const { campaignId, organizationId, userIds } = params

  // Verify campaign exists
  const campaign = await campaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  // Get unassigned leads in the campaign
  const leads = await campaignLeadRepo.getUnassignedLeads(campaignId)

  if (leads.length === 0) {
    return { assigned: 0 }
  }

  // Round-robin assignment
  let userIndex = 0
  for (const lead of leads) {
    await campaignLeadRepo.assignUser(
      lead.id,
      userIds[userIndex % userIds.length],
    )
    userIndex++
  }

  return { assigned: leads.length }
}

export const getCampaignLeads = async (
  campaignId: string,
  organizationId: string,
  filters: {
    status?: 'pending' | 'dialed' | 'completed'
    assignedUserId?: string
  },
  pagination: DBPagination,
) => {
  // Verify campaign exists
  const campaign = await campaignRepo.findById(campaignId, organizationId)
  if (!campaign) {
    throw new Error('Campaign not found')
  }

  return campaignLeadRepo.findByCampaign(campaignId, filters, pagination)
}

export const refreshCounts = async (
  campaignId: string,
  organizationId: string,
) => {
  await campaignRepo.updateCounts(campaignId, organizationId)
}

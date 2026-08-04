import * as folderRepo from '@/repositories/leadListFolder.repository'
import * as listRepo from '@/repositories/leadList.repository'
import * as entryRepo from '@/repositories/leadListEntry.repository'
import * as campaignListRepo from '@/repositories/campaignList.repository'
import * as campaignLeadRepo from '@/repositories/campaign-lead.repository'
import * as campaignRepo from '@/repositories/campaign.repository'
import * as favoriteRepo from '@/repositories/listFavorite.repository'
import * as openRepo from '@/repositories/listOpen.repository'
import { DBPagination } from '@shared/db/src/types'

// ======= FOLDER OPERATIONS =======

export const createFolder = async (params: {
  organizationId: string
  name: string
  color?: string
  parentId?: string | null
}) => folderRepo.create(params)

export const listFolders = async (
  organizationId: string,
  parentId?: string | null,
) => folderRepo.findAll(organizationId, parentId)

export const getFolder = async (id: string, organizationId: string) => {
  const folder = await folderRepo.findById(id, organizationId)
  if (!folder) throw new Error('Folder not found')
  return folder
}

export const updateFolder = async (params: {
  id: string
  organizationId: string
  name?: string
  color?: string
  parentId?: string | null
}) => {
  const { id, organizationId, ...data } = params
  const folder = await folderRepo.update(id, organizationId, data)
  if (!folder) throw new Error('Folder not found')
  return folder
}

export const deleteFolder = async (id: string, organizationId: string) => {
  const success = await folderRepo.remove(id, organizationId)
  if (!success) throw new Error('Folder not found')
  return { success: true }
}

export const reorderFolders = async (
  organizationId: string,
  folderIds: string[],
) => {
  await folderRepo.reorder(organizationId, folderIds)
  return { success: true }
}

// ======= LIST OPERATIONS =======

export const createList = async (params: {
  organizationId: string
  folderId?: string | null
  name: string
  description?: string
  createdById: string
}) => listRepo.create(params)

export const getList = async (id: string, organizationId: string) => {
  const list = await listRepo.findById(id, organizationId)
  if (!list) throw new Error('List not found')
  return list
}

export const listLists = async (
  filters: { organizationId: string; folderId?: string; search?: string },
  pagination: DBPagination,
) => listRepo.findMany(filters, pagination)

export const updateList = async (params: {
  id: string
  organizationId: string
  name?: string
  description?: string | null
  folderId?: string | null
}) => {
  const { id, organizationId, ...data } = params
  const list = await listRepo.update(id, organizationId, data)
  if (!list) throw new Error('List not found')
  return list
}

export const deleteList = async (id: string, organizationId: string) => {
  const success = await listRepo.remove(id, organizationId)
  if (!success) throw new Error('List not found')
  return { success: true }
}

// ======= LIST ENTRIES (LEADS) =======

export const addLeadsToList = async (
  listId: string,
  organizationId: string,
  leadIds: string[],
) => {
  // Verify list exists
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  await entryRepo.addLeads(listId, leadIds)
  await listRepo.updateLeadCount(listId)

  // Sync with linked campaigns
  await syncListWithCampaigns(listId, leadIds, 'add')

  return { added: leadIds.length }
}

export const removeLeadsFromList = async (
  listId: string,
  organizationId: string,
  leadIds: string[],
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  const removed = await entryRepo.removeLeads(listId, leadIds)
  await listRepo.updateLeadCount(listId)

  // Note: We don't remove from campaigns as the lead might be in other linked lists

  return { removed }
}

// Soft-remove leads from list - preserves data but excludes from dialer
export const softRemoveLeadsFromList = async (
  listId: string,
  organizationId: string,
  leadIds: string[],
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  const removed = await entryRepo.softRemoveLeads(listId, leadIds)
  await listRepo.updateLeadCount(listId)

  return { removed }
}

// Restore soft-removed leads back to list
export const restoreLeadsToList = async (
  listId: string,
  organizationId: string,
  leadIds: string[],
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  const restored = await entryRepo.restoreLeads(listId, leadIds)
  await listRepo.updateLeadCount(listId)

  return { restored }
}

export const getListLeads = async (
  listId: string,
  organizationId: string,
  filters: { search?: string },
  pagination: DBPagination,
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  return entryRepo.findByList(listId, filters, pagination)
}

// ======= CAMPAIGN-LIST LINKING =======

export const addListToCampaign = async (
  campaignId: string,
  listId: string,
  organizationId: string,
) => {
  // Verify list ownership
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  // Verify campaign ownership
  const campaign = await campaignRepo.findById(campaignId, organizationId)
  if (!campaign) throw new Error('Campaign not found')

  await campaignListRepo.addListToCampaign(campaignId, listId)

  // Add all leads from the list to the campaign
  const leadIds = await entryRepo.getLeadIdsByList(listId)
  if (leadIds.length > 0) {
    const maxOrder = await campaignLeadRepo.getMaxDialOrder(campaignId)
    await campaignLeadRepo.createMany(campaignId, leadIds, maxOrder + 1)
    await campaignRepo.updateCounts(campaignId, organizationId)
  }

  return { success: true, leadsAdded: leadIds.length }
}

export const removeListFromCampaign = async (
  campaignId: string,
  listId: string,
  organizationId: string,
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  const success = await campaignListRepo.removeListFromCampaign(
    campaignId,
    listId,
  )
  if (!success) throw new Error('List not linked to campaign')

  // Note: Leads remain in campaign - only the link is removed

  return { success: true }
}

export const getCampaignLists = async (campaignId: string) =>
  campaignListRepo.findByCampaign(campaignId)

export const getListCampaigns = async (listId: string) =>
  campaignListRepo.findByList(listId)

// ======= HELPER FUNCTIONS =======

// Sync list changes with all linked campaigns
async function syncListWithCampaigns(
  listId: string,
  leadIds: string[],
  action: 'add' | 'remove',
) {
  const linkedCampaigns = await campaignListRepo.findByList(listId)

  for (const campaign of linkedCampaigns) {
    if (action === 'add') {
      const maxOrder = await campaignLeadRepo.getMaxDialOrder(
        campaign.campaignId,
      )
      await campaignLeadRepo.createMany(
        campaign.campaignId,
        leadIds,
        maxOrder + 1,
      )
    }
    // For 'remove', we intentionally don't remove leads as they might be in other lists
  }
}

// Update import status of a list
export const updateImportStatus = async (
  listId: string,
  status: string,
  error?: string,
) => {
  await listRepo.updateImportStatus(listId, status, error)
}

// Update lead count after import
export const refreshLeadCount = async (listId: string) => {
  await listRepo.updateLeadCount(listId)
}

// Export list leads as CSV
export const exportListLeads = async (
  listId: string,
  organizationId: string,
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  const leads = await entryRepo.findAllByList(listId)

  // CSV escape function
  const escapeCSV = (value: string | null | undefined): string => {
    if (value == null) return ''
    const str = String(value)
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const headers = [
    'First Name',
    'Last Name',
    'Email',
    'Phone',
    'Company',
    'Title',
    'LinkedIn URL',
  ]
  const rows = leads.map((lead) =>
    [
      escapeCSV(lead.firstName),
      escapeCSV(lead.lastName),
      escapeCSV(lead.email),
      escapeCSV(lead.phone),
      escapeCSV(lead.company),
      escapeCSV(lead.title),
      escapeCSV(lead.linkedInUrl),
    ].join(','),
  )

  const csv = [headers.join(','), ...rows].join('\n')
  const sanitizedName =
    list.name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim() || 'export'

  return { csv, fileName: `${sanitizedName}.csv` }
}

// ======= FAVORITES =======

export const toggleFavorite = async (
  userId: string,
  organizationId: string,
  itemId: string,
  type: 'list' | 'folder',
) => {
  const isFavorited = await favoriteRepo.isFavorited(userId, itemId, type)

  if (isFavorited) {
    await favoriteRepo.removeFavorite(userId, itemId, type)
    return { favorited: false }
  } else {
    if (type === 'list') {
      // Verify list exists in organization
      const list = await listRepo.findById(itemId, organizationId)
      if (!list) throw new Error('List not found')
      await favoriteRepo.addFavorite({ userId, listId: itemId })
    } else {
      // Verify folder exists in organization
      const folder = await folderRepo.findById(itemId, organizationId)
      if (!folder) throw new Error('Folder not found')
      await favoriteRepo.addFavorite({ userId, folderId: itemId })
    }
    return { favorited: true }
  }
}

export const getFavorites = async (userId: string, organizationId: string) => {
  return favoriteRepo.findUserFavorites(userId, organizationId)
}

export const getFavoriteIds = async (
  userId: string,
  organizationId: string,
) => {
  return favoriteRepo.getFavoriteIds(userId, organizationId)
}

// ======= RECENTS (OPENS) =======

export const recordListOpen = async (
  userId: string,
  listId: string,
  organizationId: string,
) => {
  const list = await listRepo.findById(listId, organizationId)
  if (!list) throw new Error('List not found')

  await openRepo.recordOpen({ userId, listId })
  return { success: true }
}

export const recordFolderOpen = async (
  userId: string,
  folderId: string,
  organizationId: string,
) => {
  const folder = await folderRepo.findById(folderId, organizationId)
  if (!folder) throw new Error('Folder not found')

  await openRepo.recordOpen({ userId, folderId })
  return { success: true }
}

export const getRecents = async (
  userId: string,
  organizationId: string,
  limit = 20,
) => {
  return openRepo.findUserRecents(userId, organizationId, limit)
}

export const getLastOpenedByUser = async (userId: string, listId: string) => {
  const result = await openRepo.getLastOpenedByUser(userId, listId)
  return result?.openedAt ?? null
}

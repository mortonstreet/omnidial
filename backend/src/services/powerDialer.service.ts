import * as progressRepo from '@/repositories/powerDialerProgress.repository'
import * as leadListEntryRepo from '@/repositories/leadListEntry.repository'
import * as leadListRepo from '@/repositories/leadList.repository'
import * as campaignListRepo from '@/repositories/campaignList.repository'
import * as callingNotificationService from '@/services/callingNotification.service'

// Special marker for campaign-level (all lists) mode
const CAMPAIGN_ALL_LISTS = 'campaign-all'

export interface GetProgressParams {
  userId: string
  campaignId: string
  listId?: string // Optional - if not provided, uses all campaign lists
  organizationId: string
}

export const getProgress = async (params: GetProgressParams) => {
  const { userId, campaignId, listId, organizationId } = params

  // Use campaign-all marker when no specific list is provided
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS

  const progress = await progressRepo.findByUserCampaignList(
    userId,
    campaignId,
    effectiveListId,
  )

  if (!progress) {
    // Get total leads count - from campaign or specific list
    let totalLeads = 0
    if (effectiveListId === CAMPAIGN_ALL_LISTS) {
      totalLeads = await campaignListRepo.getActiveCampaignLeadCount(campaignId)
    } else {
      const list = await leadListRepo.findById(effectiveListId, organizationId)
      totalLeads = list?.leadCount || 0
    }

    return {
      currentIndex: 0,
      totalLeads,
      dialedCount: 0,
      isPaused: true,
      isNew: true,
    }
  }

  return {
    ...progress,
    isNew: false,
  }
}

export interface UpdateProgressParams {
  userId: string
  campaignId: string
  listId?: string
  currentIndex?: number
  dialedCount?: number
  isPaused?: boolean
}

export const updateProgress = async (params: UpdateProgressParams) => {
  const { userId, campaignId, listId, ...data } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS

  return progressRepo.upsert(userId, campaignId, effectiveListId, data)
}

export interface StartSessionParams {
  userId: string
  campaignId: string
  listId?: string
  organizationId: string
}

export const startSession = async (params: StartSessionParams) => {
  const { userId, campaignId, listId, organizationId } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS

  // Get total leads count - from campaign or specific list
  let totalLeads = 0
  if (effectiveListId === CAMPAIGN_ALL_LISTS) {
    totalLeads = await campaignListRepo.getActiveCampaignLeadCount(campaignId)
    if (totalLeads === 0) {
      throw new Error('No leads found in campaign lists')
    }
  } else {
    const list = await leadListRepo.findById(effectiveListId, organizationId)
    if (!list) {
      throw new Error('List not found')
    }
    totalLeads = list.leadCount || 0
  }

  // Create or update progress with isPaused = false
  const progress = await progressRepo.upsert(
    userId,
    campaignId,
    effectiveListId,
    {
      totalLeads,
      isPaused: false,
    },
  )

  // Notify organization owners asynchronously
  setImmediate(() => {
    callingNotificationService.notifyOwnersOfCallingSession({
      organizationId,
      userId,
      campaignId,
      dialerType: 'power',
    })
  })

  return progress
}

export interface StopSessionParams {
  userId: string
  campaignId: string
  listId?: string
}

export const stopSession = async (params: StopSessionParams) => {
  const { userId, campaignId, listId } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS

  const progress = await progressRepo.findByUserCampaignList(
    userId,
    campaignId,
    effectiveListId,
  )

  if (!progress) {
    return { success: true, wasPaused: true }
  }

  await progressRepo.update(progress.id, { isPaused: true })

  return { success: true, wasPaused: false }
}

export interface GetNextLeadParams {
  userId: string
  campaignId: string
  listId?: string
  organizationId: string
}

export const getNextLead = async (params: GetNextLeadParams) => {
  const { userId, campaignId, listId, organizationId } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS
  const isCampaignMode = effectiveListId === CAMPAIGN_ALL_LISTS

  // Get or create progress
  let progress = await progressRepo.findByUserCampaignList(
    userId,
    campaignId,
    effectiveListId,
  )

  if (!progress) {
    let totalLeads = 0
    if (isCampaignMode) {
      totalLeads = await campaignListRepo.getActiveCampaignLeadCount(campaignId)
    } else {
      const list = await leadListRepo.findById(effectiveListId, organizationId)
      if (!list) {
        throw new Error('List not found')
      }
      totalLeads = list.leadCount || 0
    }

    progress = await progressRepo.create({
      userId,
      campaignId,
      listId: effectiveListId,
      totalLeads,
      currentIndex: 0,
      dialedCount: 0,
      isPaused: false,
    })
  }

  // Get dynamic active lead count (excludes soft-removed leads)
  let activeLeadCount: number
  if (isCampaignMode) {
    activeLeadCount =
      await campaignListRepo.getActiveCampaignLeadCount(campaignId)
  } else {
    activeLeadCount =
      await leadListEntryRepo.getActiveLeadCount(effectiveListId)
  }

  // If no active leads, return empty state
  if (activeLeadCount === 0) {
    return {
      lead: null,
      progress: {
        currentIndex: progress.currentIndex,
        totalLeads: activeLeadCount,
        dialedCount: progress.dialedCount,
        isComplete: false,
        isEmpty: true,
      },
    }
  }

  // Calculate effective index using modulo for continuous cycling
  const effectiveIndex = progress.currentIndex % activeLeadCount

  // Get the lead at effective index
  let lead = null
  if (isCampaignMode) {
    // Fetch from all campaign lists
    const leads = await campaignListRepo.findCampaignLeadsWithOffset(
      campaignId,
      effectiveIndex,
      1,
    )
    lead = leads.length > 0 ? leads[0] : null
  } else {
    // Fetch from specific list
    const entries = await leadListEntryRepo.findByList(
      effectiveListId,
      {},
      {
        page: 1,
        limit: 1,
        offset: effectiveIndex,
      },
    )
    lead = entries.data?.length > 0 ? entries.data[0] : null
  }

  return {
    lead,
    progress: {
      currentIndex: progress.currentIndex,
      totalLeads: activeLeadCount,
      dialedCount: progress.dialedCount,
      isComplete: false, // Never complete - continuous cycling
      isEmpty: false,
    },
  }
}

export interface SkipLeadParams {
  userId: string
  campaignId: string
  listId?: string
}

export const skipLead = async (params: SkipLeadParams) => {
  const { userId, campaignId, listId } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS
  const isCampaignMode = effectiveListId === CAMPAIGN_ALL_LISTS

  const progress = await progressRepo.findByUserCampaignList(
    userId,
    campaignId,
    effectiveListId,
  )

  if (!progress) {
    throw new Error('No active power dialer session')
  }

  // Move to next lead without incrementing dialed count
  const updatedProgress = await progressRepo.incrementCurrentIndex(progress.id)

  if (!updatedProgress) {
    throw new Error('Failed to update progress')
  }

  // Get dynamic active lead count
  let activeLeadCount: number
  if (isCampaignMode) {
    activeLeadCount =
      await campaignListRepo.getActiveCampaignLeadCount(campaignId)
  } else {
    activeLeadCount =
      await leadListEntryRepo.getActiveLeadCount(effectiveListId)
  }

  // If no active leads, return empty state
  if (activeLeadCount === 0) {
    return {
      lead: null,
      progress: {
        currentIndex: updatedProgress.currentIndex,
        totalLeads: activeLeadCount,
        dialedCount: updatedProgress.dialedCount,
        isComplete: false,
        isEmpty: true,
      },
    }
  }

  // Calculate effective index using modulo for continuous cycling
  const effectiveIndex = updatedProgress.currentIndex % activeLeadCount

  // Fetch the lead at the effective index
  let lead = null
  if (isCampaignMode) {
    const leads = await campaignListRepo.findCampaignLeadsWithOffset(
      campaignId,
      effectiveIndex,
      1,
    )
    lead = leads.length > 0 ? leads[0] : null
  } else {
    const entries = await leadListEntryRepo.findByList(
      effectiveListId,
      {},
      {
        page: 1,
        limit: 1,
        offset: effectiveIndex,
      },
    )
    lead = entries.data?.length > 0 ? entries.data[0] : null
  }

  return {
    lead,
    progress: {
      currentIndex: updatedProgress.currentIndex,
      totalLeads: activeLeadCount,
      dialedCount: updatedProgress.dialedCount,
      isComplete: false, // Never complete - continuous cycling
      isEmpty: false,
    },
  }
}

export interface AdvanceToNextParams {
  userId: string
  campaignId: string
  listId?: string
}

export const advanceToNext = async (params: AdvanceToNextParams) => {
  const { userId, campaignId, listId } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS

  const progress = await progressRepo.findByUserCampaignList(
    userId,
    campaignId,
    effectiveListId,
  )

  if (!progress) {
    throw new Error('No active power dialer session')
  }

  // Increment both current index and dialed count
  await progressRepo.incrementCurrentIndex(progress.id)
  return progressRepo.incrementDialedCount(progress.id)
}

export interface GoToPreviousParams {
  userId: string
  campaignId: string
  listId?: string
}

export const goToPrevious = async (params: GoToPreviousParams) => {
  const { userId, campaignId, listId } = params
  const effectiveListId = listId || CAMPAIGN_ALL_LISTS
  const isCampaignMode = effectiveListId === CAMPAIGN_ALL_LISTS

  const progress = await progressRepo.findByUserCampaignList(
    userId,
    campaignId,
    effectiveListId,
  )

  if (!progress) {
    throw new Error('No active power dialer session')
  }

  // Get dynamic active lead count
  let activeLeadCount: number
  if (isCampaignMode) {
    activeLeadCount =
      await campaignListRepo.getActiveCampaignLeadCount(campaignId)
  } else {
    activeLeadCount =
      await leadListEntryRepo.getActiveLeadCount(effectiveListId)
  }

  // If no active leads, return empty state
  if (activeLeadCount === 0) {
    return {
      lead: null,
      progress: {
        currentIndex: progress.currentIndex,
        totalLeads: activeLeadCount,
        dialedCount: progress.dialedCount,
        isComplete: false,
        isEmpty: true,
      },
    }
  }

  // Calculate effective current position
  const effectiveCurrent = progress.currentIndex % activeLeadCount

  let newIndex: number
  let updatedProgress

  // Handle backward wrapping: if at effective position 0, wrap to last lead
  if (effectiveCurrent === 0) {
    // If currentIndex is 0, wrap to the last position
    // Otherwise, decrement normally (this handles when currentIndex > activeLeadCount)
    if (progress.currentIndex === 0) {
      // Wrap from beginning to end
      newIndex = activeLeadCount - 1
      updatedProgress = await progressRepo.setCurrentIndex(
        progress.id,
        newIndex,
      )
    } else {
      // currentIndex > 0 but effectiveCurrent is 0, just decrement
      updatedProgress = await progressRepo.decrementCurrentIndex(progress.id)
    }
  } else {
    // Normal decrement
    updatedProgress = await progressRepo.decrementCurrentIndex(progress.id)
  }

  // Use updated progress or fall back to original
  const finalProgress = updatedProgress || progress

  // Calculate the effective index for fetching the lead
  const effectiveIndex = finalProgress.currentIndex % activeLeadCount

  // Fetch the lead at the effective index
  let lead = null
  if (isCampaignMode) {
    const leads = await campaignListRepo.findCampaignLeadsWithOffset(
      campaignId,
      effectiveIndex,
      1,
    )
    lead = leads.length > 0 ? leads[0] : null
  } else {
    const entries = await leadListEntryRepo.findByList(
      effectiveListId,
      {},
      {
        page: 1,
        limit: 1,
        offset: effectiveIndex,
      },
    )
    lead = entries.data?.length > 0 ? entries.data[0] : null
  }

  return {
    lead,
    progress: {
      currentIndex: finalProgress.currentIndex,
      totalLeads: activeLeadCount,
      dialedCount: finalProgress.dialedCount,
      isComplete: false, // Never complete - continuous cycling
      isEmpty: false,
    },
  }
}

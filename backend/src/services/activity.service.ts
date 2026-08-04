import * as activityRepository from '@/repositories/activity.repository'
import * as userRepository from '@/repositories/user.repository'
import type {
  ActivityItemResponse,
  GetActivityResponse,
  ActivityFilterCategory,
} from '@shared/types/src'

interface GetActivityOptions {
  organizationId: string
  type?: ActivityFilterCategory
  userId?: string
  limit?: number
  cursor?: string
}

// Map filter categories to actual activity types
const filterCategoryToTypes: Record<
  Exclude<ActivityFilterCategory, 'all'>,
  string[]
> = {
  calls: ['call'],
  leads: ['lead_added', 'lead_updated'],
  tasks: ['task_completed'],
}

interface CreateActivityOptions {
  type: string
  userId: string
  organizationId: string
  description: string
  metadata?: Record<string, unknown>
}

export const getActivity = async (
  options: GetActivityOptions,
): Promise<GetActivityResponse> => {
  // Map filter category to actual activity types
  const types =
    options.type && options.type !== 'all'
      ? filterCategoryToTypes[options.type]
      : undefined

  const { items, nextCursor } = await activityRepository.findByOrganization({
    organizationId: options.organizationId,
    types,
    userId: options.userId,
    limit: options.limit ?? 20,
    cursor: options.cursor,
  })

  // Fetch user names for all activities
  const userIds = [...new Set(items.map((item) => item.userId))]
  const users = await userRepository.findByIds(userIds)

  const userMap = new Map(users.map((u) => [u.id, u.name || u.email]))

  const activityItems: ActivityItemResponse[] = items.map((item) => ({
    id: item.id,
    type: item.type as ActivityItemResponse['type'],
    userId: item.userId,
    userName: userMap.get(item.userId) || 'Unknown',
    description: item.description,
    metadata:
      typeof item.metadata === 'string'
        ? JSON.parse(item.metadata)
        : item.metadata,
    createdAt: new Date(item.createdAt as unknown as string).toISOString(),
  }))

  return {
    items: activityItems,
    nextCursor,
  }
}

export const createActivity = async (options: CreateActivityOptions) => {
  return activityRepository.create(options)
}

// Helper to log call activity
export const logCallActivity = async (params: {
  organizationId: string
  userId: string
  leadId?: string
  direction: 'outbound' | 'inbound'
  duration: number
  disposition?: string
}) => {
  const { organizationId, userId, direction, duration } = params
  const directionText =
    direction === 'outbound' ? 'made a call' : 'received a call'
  const description = `Call ${direction} - ${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')} duration`

  await createActivity({
    type: 'call',
    userId,
    organizationId,
    description,
    metadata: {
      leadId: params.leadId,
      callDuration: duration,
      disposition: params.disposition,
      direction,
    },
  })
}

// Helper to log lead activity
export const logLeadActivity = async (params: {
  organizationId: string
  userId: string
  action: 'added' | 'updated'
  leadName: string
  leadId: string
}) => {
  const { organizationId, userId, action, leadName, leadId } = params
  await createActivity({
    type: action === 'added' ? 'lead_added' : 'lead_updated',
    userId,
    organizationId,
    description: `${action === 'added' ? 'Added' : 'Updated'} lead: ${leadName}`,
    metadata: {
      leadId,
      leadName,
    },
  })
}

// Helper to log task completion
export const logTaskCompleted = async (params: {
  organizationId: string
  userId: string
  taskId: string
  taskTitle: string
  leadId?: string
}) => {
  const { organizationId, userId, taskId, taskTitle, leadId } = params
  await createActivity({
    type: 'task_completed',
    userId,
    organizationId,
    description: `Completed task: ${taskTitle}`,
    metadata: {
      taskId,
      leadId,
    },
  })
}

// Helper to log campaign creation
export const logCampaignCreated = async (params: {
  organizationId: string
  userId: string
  campaignName: string
  campaignId: string
}) => {
  const { organizationId, userId, campaignName, campaignId } = params
  await createActivity({
    type: 'campaign_created',
    userId,
    organizationId,
    description: `Created campaign: ${campaignName}`,
    metadata: {
      campaignId,
      campaignName,
    },
  })
}

// Helper to log pipeline stage activity
export const logPipelineStageActivity = async (params: {
  organizationId: string
  userId: string
  action: 'created' | 'updated' | 'deleted'
  stageId: string
  stageName: string
  changes?: Record<string, { from: unknown; to: unknown }>
}) => {
  const { organizationId, userId, action, stageId, stageName, changes } = params

  let description: string
  switch (action) {
    case 'created':
      description = `Created pipeline stage: ${stageName}`
      break
    case 'updated':
      description = `Updated pipeline stage: ${stageName}`
      break
    case 'deleted':
      description = `Deleted pipeline stage: ${stageName}`
      break
  }

  await createActivity({
    type: `pipeline_stage_${action}`,
    userId,
    organizationId,
    description,
    metadata: {
      stageId,
      stageName,
      changes,
    },
  })
}

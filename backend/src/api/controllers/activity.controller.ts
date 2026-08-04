import { AuthRequestHandler } from '@/types/handlers'
import * as activityService from '@/services/activity.service'
import { GetActivityRequest } from '@shared/types/src'

export const getActivity: AuthRequestHandler<GetActivityRequest> = async (
  req,
  res,
) => {
  const { organizationId, type, userId, limit, cursor } = req.validated

  const result = await activityService.getActivity({
    organizationId,
    type,
    userId,
    limit,
    cursor,
  })

  res.json(result)
}

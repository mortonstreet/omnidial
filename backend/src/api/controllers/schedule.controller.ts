import { AuthRequestHandler, AuthRequest } from '@/types/handlers'
import * as scheduleService from '@/services/schedule.service'
import {
  GetScheduleRequest,
  CreateScheduleEventRequest,
  UpdateScheduleEventRequest,
  DeleteScheduleEventRequest,
  ScheduleEventResponse,
} from '@shared/types/src'

export const getSchedule: AuthRequestHandler<GetScheduleRequest> = async (
  req,
  res,
) => {
  const { organizationId, startDate, endDate, userId } = req.validated

  const result = await scheduleService.getSchedule({
    organizationId,
    startDate,
    endDate,
    userId,
  })

  res.json(result)
}

export const createScheduleEvent: AuthRequestHandler<
  CreateScheduleEventRequest
> = async (req, res) => {
  const { type, title, leadId, startTime, endTime, notes } = req.validated

  const authReq = req as AuthRequest<CreateScheduleEventRequest>
  const organizationId = authReq.session?.activeOrganizationId
  const userId = authReq.session?.userId

  if (!organizationId || !userId) {
    res
      .status(401)
      .json({ error: 'User must be authenticated with an active organization' })
    return
  }

  const event = await scheduleService.createScheduleEvent({
    type,
    title,
    leadId,
    userId,
    organizationId,
    startTime,
    endTime,
    notes,
  })

  const response: ScheduleEventResponse = {
    id: event.id,
    type: event.type as ScheduleEventResponse['type'],
    title: event.title,
    leadId: event.leadId ?? undefined,
    startTime: new Date(event.startTime as unknown as string).toISOString(),
    endTime: event.endTime
      ? new Date(event.endTime as unknown as string).toISOString()
      : undefined,
    notes: event.notes ?? undefined,
  }

  res.status(201).json(response)
}

export const updateScheduleEvent: AuthRequestHandler<
  UpdateScheduleEventRequest
> = async (req, res) => {
  const { id, ...updates } = req.validated

  const event = await scheduleService.updateScheduleEvent(id, updates)

  const response: ScheduleEventResponse = {
    id: event.id,
    type: event.type as ScheduleEventResponse['type'],
    title: event.title,
    leadId: event.leadId ?? undefined,
    startTime: new Date(event.startTime as unknown as string).toISOString(),
    endTime: event.endTime
      ? new Date(event.endTime as unknown as string).toISOString()
      : undefined,
    notes: event.notes ?? undefined,
  }

  res.json(response)
}

export const deleteScheduleEvent: AuthRequestHandler<
  DeleteScheduleEventRequest
> = async (req, res) => {
  const { id } = req.validated

  await scheduleService.deleteScheduleEvent(id)

  res.json({ success: true })
}

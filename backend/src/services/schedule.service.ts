import * as scheduleEventRepository from '@/repositories/scheduleEvent.repository'
import * as leadRepository from '@/repositories/lead.repository'
import type {
  ScheduleEventResponse,
  GetScheduleResponse,
} from '@shared/types/src'

interface GetScheduleOptions {
  organizationId: string
  startDate: string
  endDate: string
  userId?: string
}

interface CreateScheduleEventOptions {
  type: string
  title: string
  leadId?: string
  userId: string
  organizationId: string
  startTime: string
  endTime?: string
  notes?: string
}

interface UpdateScheduleEventOptions {
  type?: string
  title?: string
  leadId?: string | null
  startTime?: string
  endTime?: string | null
  notes?: string | null
}

export const getSchedule = async (
  options: GetScheduleOptions,
): Promise<GetScheduleResponse> => {
  const events = await scheduleEventRepository.findByOrganization({
    organizationId: options.organizationId,
    startDate: new Date(options.startDate),
    endDate: new Date(`${options.endDate}T23:59:59.999Z`),
    userId: options.userId,
  })

  // Fetch lead names for events with leads
  const leadIds = events.filter((e) => e.leadId).map((e) => e.leadId!)
  // Use a dummy org ID since we just need basic lead info - the events are already org-scoped
  const leads =
    leadIds.length > 0 ? await leadRepository.findByIdsBasic(leadIds) : []

  const leadMap = new Map(
    leads.map((l) => [
      l.id,
      [l.firstName, l.lastName].filter(Boolean).join(' ') ||
        l.company ||
        'Unknown',
    ]),
  )

  const eventResponses: ScheduleEventResponse[] = events.map((event) => ({
    id: event.id,
    type: event.type as ScheduleEventResponse['type'],
    title: event.title,
    leadId: event.leadId ?? undefined,
    leadName: event.leadId ? leadMap.get(event.leadId) : undefined,
    startTime: new Date(event.startTime as unknown as string).toISOString(),
    endTime: event.endTime
      ? new Date(event.endTime as unknown as string).toISOString()
      : undefined,
    notes: event.notes ?? undefined,
  }))

  return {
    events: eventResponses,
  }
}

export const createScheduleEvent = async (
  options: CreateScheduleEventOptions,
) => {
  return scheduleEventRepository.create({
    type: options.type,
    title: options.title,
    leadId: options.leadId ?? null,
    userId: options.userId,
    organizationId: options.organizationId,
    startTime: new Date(options.startTime),
    endTime: options.endTime ? new Date(options.endTime) : null,
    notes: options.notes ?? null,
  })
}

export const updateScheduleEvent = async (
  id: string,
  options: UpdateScheduleEventOptions,
) => {
  const updateData: Parameters<typeof scheduleEventRepository.update>[1] = {}

  if (options.type !== undefined) updateData.type = options.type
  if (options.title !== undefined) updateData.title = options.title
  if (options.leadId !== undefined) updateData.leadId = options.leadId
  if (options.startTime !== undefined)
    updateData.startTime = new Date(options.startTime)
  if (options.endTime !== undefined) {
    updateData.endTime = options.endTime ? new Date(options.endTime) : null
  }
  if (options.notes !== undefined) updateData.notes = options.notes

  return scheduleEventRepository.update(id, updateData)
}

export const deleteScheduleEvent = async (id: string) => {
  return scheduleEventRepository.deleteById(id)
}

export const getScheduleEventById = async (id: string) => {
  return scheduleEventRepository.findById(id)
}

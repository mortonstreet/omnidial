import { AuthRequestHandler } from '@/types/handlers'
import * as taskRepository from '@/repositories/task.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as activityService from '@/services/activity.service'
import {
  GetTasksRequest,
  GetTaskRequest,
  CreateTaskRequest,
  UpdateTaskRequest,
  CompleteTaskRequest,
  DeleteTaskRequest,
} from '@shared/types/src'

const getOrganizationId = (session: any): string | null => {
  return session?.session?.activeOrganizationId || null
}

export const getTasks: AuthRequestHandler<GetTasksRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { leadId, userId, completed, dueFrom, dueTo, page, limit } =
    req.validated

  const result = await taskRepository.findByOrganizationId({
    organizationId,
    leadId,
    userId,
    completed,
    dueFrom: dueFrom ? new Date(dueFrom) : undefined,
    dueTo: dueTo ? new Date(dueTo) : undefined,
    page,
    limit,
  })

  // Fetch lead names for tasks
  const leadIds = [...new Set(result.data.map((t) => t.leadId).filter(Boolean))]
  const leads =
    leadIds.length > 0 ? await leadRepository.findByIdsBasic(leadIds) : []

  const leadMap = new Map(
    leads.map((l) => [
      l.id,
      {
        firstName: l.firstName,
        lastName: l.lastName,
        company: l.company,
      },
    ]),
  )

  // Transform data to include lead info
  const dataWithLeads = result.data.map((task) => ({
    ...task,
    lead: task.leadId ? leadMap.get(task.leadId) : undefined,
  }))

  return res.json({
    ...result,
    data: dataWithLeads,
  })
}

export const getTask: AuthRequestHandler<GetTaskRequest> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated

  const task = await taskRepository.findById(id)
  if (!task || task.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Task not found' })
  }

  return res.json(task)
}

export const createTask: AuthRequestHandler<CreateTaskRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { leadId, title, dueAt } = req.validated

  // Verify lead ownership
  const lead = await leadRepository.findById(leadId, organizationId)
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' })
  }

  const task = await taskRepository.create({
    organizationId,
    userId: req.user.id,
    leadId,
    title,
    dueAt: dueAt ? new Date(dueAt) : null,
  })

  return res.status(201).json(task)
}

export const updateTask: AuthRequestHandler<UpdateTaskRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id, title, dueAt, completedAt } = req.validated

  // Check ownership
  const existing = await taskRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Task not found' })
  }

  const task = await taskRepository.update(id, {
    ...(title !== undefined && { title }),
    ...(dueAt !== undefined && { dueAt: dueAt ? new Date(dueAt) : null }),
    ...(completedAt !== undefined && {
      completedAt: completedAt ? new Date(completedAt) : null,
    }),
  })

  return res.json(task)
}

export const completeTask: AuthRequestHandler<CompleteTaskRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated

  // Check ownership
  const existing = await taskRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Task not found' })
  }

  // Toggle completion status
  const wasCompleted = !!existing.completedAt
  const task = wasCompleted
    ? await taskRepository.uncomplete(id)
    : await taskRepository.complete(id)

  // Log activity when task is completed (not uncompleted)
  if (!wasCompleted && task) {
    try {
      await activityService.logTaskCompleted({
        organizationId,
        userId: req.user.id,
        taskId: task.id,
        taskTitle: task.title,
        leadId: task.leadId ?? undefined,
      })
    } catch (error) {
      console.error('Failed to log task completed activity:', error)
    }
  }

  return res.json(task)
}

export const deleteTask: AuthRequestHandler<DeleteTaskRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated

  // Check ownership
  const existing = await taskRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Task not found' })
  }

  await taskRepository.deleteById(id)
  return res.json({ success: true })
}

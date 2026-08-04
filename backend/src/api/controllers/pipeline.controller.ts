import { AuthRequestHandler } from '@/types/handlers'
import * as pipelineRepository from '@/repositories/pipeline.repository'
import * as leadRepository from '@/repositories/lead.repository'
import { logPipelineStageActivity } from '@/services/activity.service'
import {
  GetPipelineStagesRequest,
  CreatePipelineStageRequest,
  UpdatePipelineStageRequest,
  DeletePipelineStageRequest,
  ReorderPipelineStagesRequest,
} from '@shared/types/src'

const getOrganizationId = (session: any): string | null => {
  return session?.session?.activeOrganizationId || null
}

export const getPipelineStages: AuthRequestHandler<
  GetPipelineStagesRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  let stages = await pipelineRepository.findByOrganizationId(organizationId)

  // Create default stages if none exist
  if (stages.length === 0) {
    stages = await pipelineRepository.createDefaultStages(organizationId)
  }

  // Get lead counts and total values per stage
  const stageStats = await leadRepository.getStageStats(organizationId)

  // Enhance stages with stats
  const stagesWithStats = stages.map((stage) => {
    const stats = stageStats.get(stage.id) || { count: 0, totalValue: 0 }
    return {
      ...stage,
      leadCount: stats.count,
      totalValue: stats.totalValue,
    }
  })

  return res.json({ data: stagesWithStats })
}

export const createPipelineStage: AuthRequestHandler<
  CreatePipelineStageRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { label, color, sortOrder, isDefault } = req.validated

  // If this stage is default, clear others
  if (isDefault) {
    await pipelineRepository.clearDefaultFlag(organizationId)
  }

  const stage = await pipelineRepository.create({
    organizationId,
    label,
    color,
    sortOrder,
    isDefault,
    createdAt: new Date(),
  })

  // Log activity
  await logPipelineStageActivity({
    organizationId,
    userId: req.user.id,
    action: 'created',
    stageId: stage.id,
    stageName: label,
  })

  return res.status(201).json(stage)
}

export const updatePipelineStage: AuthRequestHandler<
  UpdatePipelineStageRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id, ...updateData } = req.validated

  // Check ownership
  const existing = await pipelineRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Pipeline stage not found' })
  }

  // If setting as default, clear others
  if (updateData.isDefault) {
    await pipelineRepository.clearDefaultFlag(organizationId)
  }

  const stage = await pipelineRepository.update(id, updateData)

  // Log activity with changes
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  if (updateData.label && updateData.label !== existing.label) {
    changes.label = { from: existing.label, to: updateData.label }
  }
  if (updateData.color && updateData.color !== existing.color) {
    changes.color = { from: existing.color, to: updateData.color }
  }

  await logPipelineStageActivity({
    organizationId,
    userId: req.user.id,
    action: 'updated',
    stageId: id,
    stageName: stage?.label || existing.label,
    changes: Object.keys(changes).length > 0 ? changes : undefined,
  })

  return res.json(stage)
}

export const deletePipelineStage: AuthRequestHandler<
  DeletePipelineStageRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated

  // Check ownership
  const existing = await pipelineRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Pipeline stage not found' })
  }

  await pipelineRepository.deleteById(id)

  // Log activity
  await logPipelineStageActivity({
    organizationId,
    userId: req.user.id,
    action: 'deleted',
    stageId: id,
    stageName: existing.label,
  })

  return res.json({ success: true })
}

export const reorderPipelineStages: AuthRequestHandler<
  ReorderPipelineStagesRequest
> = async (req, res) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { stages } = req.validated

  // Verify all stages belong to this organization
  for (const stage of stages) {
    const existing = await pipelineRepository.findById(stage.id)
    if (!existing || existing.organizationId !== organizationId) {
      return res
        .status(404)
        .json({ error: `Pipeline stage ${stage.id} not found` })
    }
  }

  await pipelineRepository.updateSortOrders(stages)
  const updatedStages =
    await pipelineRepository.findByOrganizationId(organizationId)
  return res.json({ data: updatedStages })
}

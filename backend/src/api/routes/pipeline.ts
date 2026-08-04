import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  getPipelineStages,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
} from '@/api/controllers/pipeline.controller'
import {
  GetPipelineStagesRequestSchema,
  CreatePipelineStageRequestSchema,
  UpdatePipelineStageRequestSchema,
  DeletePipelineStageRequestSchema,
  ReorderPipelineStagesRequestSchema,
} from '@shared/types/src'

const router = Router()

router.get(
  '/',
  withBetterAuth,
  validateAndMerge(GetPipelineStagesRequestSchema),
  authenticatedRoute(getPipelineStages),
)

router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreatePipelineStageRequestSchema),
  authenticatedRoute(createPipelineStage),
)

router.post(
  '/reorder',
  withBetterAuth,
  validateAndMerge(ReorderPipelineStagesRequestSchema),
  authenticatedRoute(reorderPipelineStages),
)

router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdatePipelineStageRequestSchema),
  authenticatedRoute(updatePipelineStage),
)

router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeletePipelineStageRequestSchema),
  authenticatedRoute(deletePipelineStage),
)

export default router

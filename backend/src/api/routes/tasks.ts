import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  getTasks,
  getTask,
  createTask,
  updateTask,
  completeTask,
  deleteTask,
} from '@/api/controllers/task.controller'
import {
  GetTasksRequestSchema,
  GetTaskRequestSchema,
  CreateTaskRequestSchema,
  UpdateTaskRequestSchema,
  CompleteTaskRequestSchema,
  DeleteTaskRequestSchema,
} from '@shared/types/src'

const router = Router()

router.get(
  '/',
  withBetterAuth,
  validateAndMerge(GetTasksRequestSchema),
  authenticatedRoute(getTasks),
)

router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetTaskRequestSchema),
  authenticatedRoute(getTask),
)

router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateTaskRequestSchema),
  authenticatedRoute(createTask),
)

router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateTaskRequestSchema),
  authenticatedRoute(updateTask),
)

router.post(
  '/:id/complete',
  withBetterAuth,
  validateAndMerge(CompleteTaskRequestSchema),
  authenticatedRoute(completeTask),
)

router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteTaskRequestSchema),
  authenticatedRoute(deleteTask),
)

export default router

import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  getSchedule,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
} from '@/api/controllers/schedule.controller'
import {
  GetScheduleRequestSchema,
  CreateScheduleEventRequestSchema,
  UpdateScheduleEventRequestSchema,
  DeleteScheduleEventRequestSchema,
} from '@shared/types/src'

const router = Router()

router.get(
  '/:organizationId',
  withBetterAuth,
  validateAndMerge(GetScheduleRequestSchema),
  authenticatedRoute(getSchedule),
)

router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateScheduleEventRequestSchema),
  authenticatedRoute(createScheduleEvent),
)

router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateScheduleEventRequestSchema),
  authenticatedRoute(updateScheduleEvent),
)

router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteScheduleEventRequestSchema),
  authenticatedRoute(deleteScheduleEvent),
)

export default router

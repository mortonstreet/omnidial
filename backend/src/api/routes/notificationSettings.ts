import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import { withBetterAuth } from '../middlewares/auth'
import { UpdateNotificationSettingsSchema } from '@shared/types/src'
import {
  getNotificationSettingsController,
  updateNotificationSettingsController,
  testDailySummaryController,
  testRepReminderController,
} from '@/api/controllers/notificationSettings.controller'

const router = Router()

// Get notification settings
router.get(
  '/',
  withBetterAuth,
  authenticatedRoute(getNotificationSettingsController),
)

// Update notification settings
router.patch(
  '/',
  withBetterAuth,
  validateAndMerge(UpdateNotificationSettingsSchema),
  authenticatedRoute(updateNotificationSettingsController),
)

// Send test daily summary
router.post(
  '/test-daily-summary',
  withBetterAuth,
  authenticatedRoute(testDailySummaryController),
)

// Send test rep reminder (sends to current user)
router.post(
  '/test-rep-reminder',
  withBetterAuth,
  authenticatedRoute(testRepReminderController),
)

export default router

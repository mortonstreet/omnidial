import { Router } from 'express'
import {
  listDispositions,
  createDisposition,
  updateDisposition,
  deleteDisposition,
} from '@/api/controllers/dialer.controller'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { withBetterAuth } from '@/api/middlewares/auth'
import { authenticatedRoute } from './utils'
import {
  ListDispositionsRequestSchema,
  CreateDispositionRequestSchema,
  UpdateDispositionRequestSchema,
  DeleteDispositionRequestSchema,
} from '@shared/types/src'

const router = Router()

// All routes require authentication
router.use(withBetterAuth)

// List dispositions
router.get(
  '/',
  validateAndMerge(ListDispositionsRequestSchema),
  authenticatedRoute(listDispositions),
)

// Create a new disposition
router.post(
  '/',
  validateAndMerge(CreateDispositionRequestSchema),
  authenticatedRoute(createDisposition),
)

// Update a disposition
router.patch(
  '/:id',
  validateAndMerge(UpdateDispositionRequestSchema),
  authenticatedRoute(updateDisposition),
)

// Delete a disposition
router.delete(
  '/:id',
  validateAndMerge(DeleteDispositionRequestSchema),
  authenticatedRoute(deleteDisposition),
)

export default router

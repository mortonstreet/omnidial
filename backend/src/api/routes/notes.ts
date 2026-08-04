import { Router } from 'express'
import { withBetterAuth } from '@/api/middlewares/auth'
import { validateAndMerge } from '@/api/middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  getNotes,
  createNote,
  updateNote,
  deleteNote,
} from '@/api/controllers/note.controller'
import {
  GetNotesRequestSchema,
  CreateNoteRequestSchema,
  UpdateNoteRequestSchema,
  DeleteNoteRequestSchema,
} from '@shared/types/src'

const router = Router()

router.get(
  '/',
  withBetterAuth,
  validateAndMerge(GetNotesRequestSchema),
  authenticatedRoute(getNotes),
)

router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateNoteRequestSchema),
  authenticatedRoute(createNote),
)

router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateNoteRequestSchema),
  authenticatedRoute(updateNote),
)

router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteNoteRequestSchema),
  authenticatedRoute(deleteNote),
)

export default router

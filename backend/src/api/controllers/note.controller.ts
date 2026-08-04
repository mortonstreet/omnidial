import { AuthRequestHandler } from '@/types/handlers'
import * as noteRepository from '@/repositories/note.repository'
import * as leadRepository from '@/repositories/lead.repository'
import {
  GetNotesRequest,
  CreateNoteRequest,
  UpdateNoteRequest,
  DeleteNoteRequest,
} from '@shared/types/src'

const getOrganizationId = (session: any): string | null => {
  return session?.session?.activeOrganizationId || null
}

export const getNotes: AuthRequestHandler<GetNotesRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { leadId, page, limit } = req.validated

  // Verify lead ownership
  const lead = await leadRepository.findById(leadId, organizationId)
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' })
  }

  const result = await noteRepository.findByLeadId({
    leadId,
    page,
    limit,
  })

  return res.json(result)
}

export const createNote: AuthRequestHandler<CreateNoteRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { leadId, content } = req.validated

  // Verify lead ownership
  const lead = await leadRepository.findById(leadId, organizationId)
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' })
  }

  const note = await noteRepository.create({
    organizationId,
    userId: req.user.id,
    leadId,
    content,
  })

  return res.status(201).json(note)
}

export const updateNote: AuthRequestHandler<UpdateNoteRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id, content } = req.validated

  // Check ownership
  const existing = await noteRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Note not found' })
  }

  const note = await noteRepository.update(id, { content })
  return res.json(note)
}

export const deleteNote: AuthRequestHandler<DeleteNoteRequest> = async (
  req,
  res,
) => {
  const organizationId = getOrganizationId(req.session)
  if (!organizationId) {
    return res.status(400).json({ error: 'No active organization' })
  }

  const { id } = req.validated

  // Check ownership
  const existing = await noteRepository.findById(id)
  if (!existing || existing.organizationId !== organizationId) {
    return res.status(404).json({ error: 'Note not found' })
  }

  await noteRepository.deleteById(id)
  return res.json({ success: true })
}

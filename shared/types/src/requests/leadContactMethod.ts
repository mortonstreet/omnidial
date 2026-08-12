import { z } from 'zod'

export const ContactMethodKindSchema = z.enum(['email', 'phone'])
export type ContactMethodKind = z.infer<typeof ContactMethodKindSchema>

/**
 * Labels the UI offers. Free text is still accepted so a rep can record
 * something the list does not cover ("reception", "assistant").
 */
export const COMMON_CONTACT_LABELS = [
  'primary',
  'office',
  'mobile',
  'direct',
  'personal',
  'assistant',
  'other',
] as const

export const ListContactMethodsRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().min(1),
})
export type ListContactMethodsRequest = z.infer<
  typeof ListContactMethodsRequestSchema
>

export const CreateContactMethodRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().min(1),
  kind: ContactMethodKindSchema,
  value: z.string().min(1).max(320),
  label: z.string().max(64).nullish(),
})
export type CreateContactMethodRequest = z.infer<
  typeof CreateContactMethodRequestSchema
>

export const UpdateContactMethodRequestSchema = z.object({
  organizationId: z.string().min(1),
  id: z.string().min(1),
  value: z.string().min(1).max(320).optional(),
  label: z.string().max(64).nullish(),
  // Promoting a method writes it back to lead.email / lead.phone.
  isPrimary: z.boolean().optional(),
})
export type UpdateContactMethodRequest = z.infer<
  typeof UpdateContactMethodRequestSchema
>

export const DeleteContactMethodRequestSchema = z.object({
  organizationId: z.string().min(1),
  id: z.string().min(1),
})
export type DeleteContactMethodRequest = z.infer<
  typeof DeleteContactMethodRequestSchema
>

export interface ContactMethodItem {
  id: string
  leadId: string
  kind: ContactMethodKind
  label: string | null
  value: string
  normalizedValue: string | null
  isPrimary: boolean
  createdAt: string
  updatedAt: string
}

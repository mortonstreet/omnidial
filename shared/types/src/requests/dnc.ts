import { z } from 'zod'

export const MarkLeadsDncRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(500),
  reason: z.string().max(500).nullish(),
})
export type MarkLeadsDncRequest = z.infer<typeof MarkLeadsDncRequestSchema>

export const UnmarkDncRequestSchema = z.object({
  organizationId: z.string().min(1),
  phone: z.string().min(1),
})
export type UnmarkDncRequest = z.infer<typeof UnmarkDncRequestSchema>

export const ListDncRequestSchema = z.object({
  organizationId: z.string().min(1),
})
export type ListDncRequest = z.infer<typeof ListDncRequestSchema>

/** Remove leads from a campaign without suppressing them. */
export const RemoveCampaignLeadsRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(500),
})
export type RemoveCampaignLeadsRequest = z.infer<
  typeof RemoveCampaignLeadsRequestSchema
>

/** Soft-remove leads from a list without suppressing them. */
export const RemoveListLeadsRequestSchema = z.object({
  organizationId: z.string().min(1),
  listId: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(500),
})
export type RemoveListLeadsRequest = z.infer<
  typeof RemoveListLeadsRequestSchema
>

export interface MarkLeadsDncResponse {
  leadsMarked: number
  numbersSuppressed: number
  removedFromCampaigns: number
  removedFromLists: number
  skipped: { leadId: string; reason: string }[]
}

export interface RemoveCampaignLeadsResponse {
  removed: number
}

export interface RemoveListLeadsResponse {
  removed: number
}

export interface DncEntryItem {
  id: string
  normalizedPhone: string
  leadId: string | null
  reason: string | null
  createdAt: string
}

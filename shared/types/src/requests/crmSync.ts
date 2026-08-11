import { z } from 'zod'

export const CrmProviderSchema = z.enum([
  'hubspot',
  'salesforce',
  'attio',
  'pipedrive',
])
export type CrmProvider = z.infer<typeof CrmProviderSchema>

export const CrmPushRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().min(1),
  provider: CrmProviderSchema,
})
export type CrmPushRequest = z.infer<typeof CrmPushRequestSchema>

export const CrmPresenceRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().min(1),
})
export type CrmPresenceRequest = z.infer<typeof CrmPresenceRequestSchema>

export const CrmTestRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: CrmProviderSchema,
})
export type CrmTestRequest = z.infer<typeof CrmTestRequestSchema>

export const CrmConnectedRequestSchema = z.object({
  organizationId: z.string().min(1),
})
export type CrmConnectedRequest = z.infer<typeof CrmConnectedRequestSchema>

export const CrmBulkPushRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().min(1)).min(1).max(100),
  provider: CrmProviderSchema,
})
export type CrmBulkPushRequest = z.infer<typeof CrmBulkPushRequestSchema>

// Org-wide sync of every pipeline lead. Unlike bulk-push the caller sends no
// lead ids - the server resolves them - so the 100-id cap does not apply.
export const CrmSyncAllRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: CrmProviderSchema,
  clientId: z.string().min(1).optional(),
})
export type CrmSyncAllRequest = z.infer<typeof CrmSyncAllRequestSchema>

// Response types
export interface CrmPushResponse {
  success: boolean
  externalId: string
  externalUrl?: string
}

export interface CrmBulkPushResponse {
  success: boolean
  total: number
  synced: number
  failed: number
  errors: Array<{
    leadId: string
    error: string
  }>
}

export interface CrmSyncAllResponse extends CrmBulkPushResponse {
  // Leads found beyond the per-run ceiling and left unsynced.
  skipped: number
}

export interface CrmPresenceItem {
  provider: string
  exists: boolean
  externalId: string | null
  externalUrl: string | null
  syncStatus: string | null
}

export interface CrmConnectionItem {
  provider: string
  connectedAt?: string
}

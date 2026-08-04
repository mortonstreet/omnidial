import { z } from 'zod';
import { DataVendorProvider } from './enrichment';
import { CrmProviderSchema } from './crmSync';

// === Extension Session ===

export interface ExtensionSessionResponse {
  authenticated: boolean;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  organization: {
    id: string;
    name: string;
  } | null;
}

// === Enriched Phone Number ===

export interface EnrichedPhoneNumber {
  value: string;
  type: 'mobile' | 'direct_dial' | 'office';
  source: string;
  isPrimary: boolean;
}

// === Check Lead ===

export const CheckLeadRequestSchema = z.object({
  linkedInUrl: z.string().url(),
});
export type CheckLeadRequest = z.infer<typeof CheckLeadRequestSchema>;

export interface CheckLeadResponse {
  exists: boolean;
  lead?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    company: string | null;
    phone: string | null;
    linkedInUrl: string | null;
    phoneNumbers?: Array<{ id: string; value: string; type: string; source: string | null; isPrimary: boolean }>;
    campaign?: { id: string; name: string };
    client?: { id: string; name: string };
  };
  matchedBy: 'linkedInUrl' | 'phone' | null;
}

// === Quick Context ===

export const QuickContextRequestSchema = z.object({});
export type QuickContextRequest = z.infer<typeof QuickContextRequestSchema>;

export interface QuickContextResponse {
  clients: Array<{ id: string; name: string; color: string | null }>;
  campaigns: Array<{ id: string; name: string; clientId: string; leadCount: number }>;
  phoneNumbers: Array<{ id: string; number: string; clientId: string }>;
}

// === Extension Enrichment ===

export const ExtensionEnrichRequestSchema = z.object({
  linkedInUrl: z.string().url(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  company: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
});
export type ExtensionEnrichRequest = z.infer<typeof ExtensionEnrichRequestSchema>;

export interface ExtensionEnrichResponse {
  leadId: string | null;
  phone: string | null;
  email: string | null;
  phoneNumbers?: EnrichedPhoneNumber[];
  // Profile data (from Prospeo when DOM parsing fails)
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  title?: string | null;
  enrichedBy: string[];
  success: boolean;
  errorMessage?: string;
}

// === Get Leads ===

export const GetLeadsRequestSchema = z.object({
  clientId: z.string().optional(),
  campaignId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});
export type GetLeadsRequest = z.infer<typeof GetLeadsRequestSchema>;

export interface LeadListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  linkedInUrl: string | null;
  isEnriched: boolean;
  clientId: string | null;
  clientName: string | null;
  campaignId: string | null;
  campaignName: string | null;
}

export interface GetLeadsResponse {
  leads: LeadListItem[];
  total: number;
  hasMore: boolean;
}

// === Extension CRM (session-scoped org) ===

export const ExtensionCrmPushRequestSchema = z.object({
  leadId: z.string().min(1),
  provider: CrmProviderSchema,
});
export type ExtensionCrmPushRequest = z.infer<
  typeof ExtensionCrmPushRequestSchema
>;

export const ExtensionCrmPresenceRequestSchema = z.object({
  leadId: z.string().min(1),
});
export type ExtensionCrmPresenceRequest = z.infer<
  typeof ExtensionCrmPresenceRequestSchema
>;

export const ExtensionCrmConnectedRequestSchema = z.object({});
export type ExtensionCrmConnectedRequest = z.infer<
  typeof ExtensionCrmConnectedRequestSchema
>;

// === LinkedIn Selection + Bulk Flow ===

export const LinkedInSelectionSourceTypeSchema = z.enum([
  'linkedin_search',
  'linkedin_recommended',
  'sales_nav_search',
]);
export type LinkedInSelectionSourceType = z.infer<
  typeof LinkedInSelectionSourceTypeSchema
>;

export const LinkedInSelectionItemSchema = z.object({
  canonicalLinkedInUrl: z.string().url(),
  rawLinkedInUrl: z.string().url(),
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  headline: z.string().optional(),
  company: z.string().optional(),
  location: z.string().optional(),
  sourcePageUrl: z.string().url(),
  sourceType: LinkedInSelectionSourceTypeSchema,
  capturedAt: z.string().datetime(),
});
export type LinkedInSelectionItem = z.infer<typeof LinkedInSelectionItemSchema>;

export const CreateListFromLinkedInSelectionRequestSchema = z.object({
  listName: z.string().min(1).max(120),
  listDescription: z.string().max(500).optional(),
  selections: z.array(LinkedInSelectionItemSchema).min(1).max(100),
});
export type CreateListFromLinkedInSelectionRequest = z.infer<
  typeof CreateListFromLinkedInSelectionRequestSchema
>;

export interface CreateListFromLinkedInSelectionResponse {
  listId: string;
  listName: string;
  totalSelected: number;
  createdLeads: number;
  dedupedExistingLeads: number;
  leadIds: string[];
  correlationId: string;
}

export const ExtensionListBulkEnrichRequestSchema = z.object({
  id: z.string().uuid(),
  providers: z.array(DataVendorProvider).optional(),
  forceRefresh: z.boolean().optional().default(false),
});
export type ExtensionListBulkEnrichRequest = z.infer<
  typeof ExtensionListBulkEnrichRequestSchema
>;

export const ExtensionJobStatusRequestSchema = z.object({
  jobId: z.string().min(1),
});
export type ExtensionJobStatusRequest = z.infer<
  typeof ExtensionJobStatusRequestSchema
>;

export interface ExtensionBulkJobProgress {
  processed: number;
  total: number;
  enriched: number;
  failed: number;
}

export interface ExtensionBulkEnrichJobStatusResponse {
  jobId: string;
  correlationId: string;
  state: 'waiting' | 'active' | 'completed' | 'failed' | 'delayed' | 'paused';
  progress: number | ExtensionBulkJobProgress;
  result?: {
    totalRequested: number;
    totalEnriched: number;
    totalFailed: number;
    totalCreditsUsed: number;
  };
  errorMessage?: string;
}

export const ExtensionListBulkPushCrmRequestSchema = z.object({
  id: z.string().uuid(),
  provider: CrmProviderSchema,
});
export type ExtensionListBulkPushCrmRequest = z.infer<
  typeof ExtensionListBulkPushCrmRequestSchema
>;

export interface ExtensionBulkCrmPushResponse {
  provider: string;
  totalRequested: number;
  totalPushed: number;
  totalFailed: number;
  correlationId: string;
  results: Array<{
    leadId: string;
    success: boolean;
    externalId?: string;
    externalUrl?: string;
    errorMessage?: string;
  }>;
}

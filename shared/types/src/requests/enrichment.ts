import { z } from 'zod';

// === Data Vendor Types ===

export const DataVendorProvider = z.enum([
  'zoominfo',
  'apollo',
  'clearbit',
  'lusha',
  'enrichengine',
  'prospeo',
  'forager',
  'leadmagic',
  'firecrawl',
]);
export type DataVendorProvider = z.infer<typeof DataVendorProvider>;

export const ContactInfoType = z.enum([
  'work_email',
  'personal_email',
  'mobile',
  'direct_dial',
  'office',
]);
export type ContactInfoType = z.infer<typeof ContactInfoType>;

export const EnrichmentStatus = z.enum([
  'pending',
  'enriched',
  'failed',
  'stale',
]);
export type EnrichmentStatus = z.infer<typeof EnrichmentStatus>;

export const EnrichmentRequestType = z.enum([
  'person',
  'company',
  'email_lookup',
  'phone_lookup',
]);
export type EnrichmentRequestType = z.infer<typeof EnrichmentRequestType>;

// === Vendor Data Type Configuration ===

export const VendorDataType = z.enum(['phone', 'email', 'profile']);
export type VendorDataType = z.infer<typeof VendorDataType>;

// === Vendor Connection Types ===

export const ConnectVendorRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: DataVendorProvider,
  apiKey: z.string().min(1),
  priority: z.number().int().min(0).max(100).optional().default(0),
  creditsLimit: z.number().int().positive().optional(),
  enabledDataTypes: z.array(VendorDataType).optional().default(['phone', 'email', 'profile']),
});
export type ConnectVendorRequest = z.infer<typeof ConnectVendorRequestSchema>;

export const UpdateVendorConnectionRequestSchema = z.object({
  id: z.string().uuid(),
  apiKey: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
  priority: z.number().int().min(0).max(100).optional(),
  creditsLimit: z.number().int().positive().nullable().optional(),
  enabledDataTypes: z.array(VendorDataType).optional(),
});
export type UpdateVendorConnectionRequest = z.infer<typeof UpdateVendorConnectionRequestSchema>;

export const DisconnectVendorRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DisconnectVendorRequest = z.infer<typeof DisconnectVendorRequestSchema>;

export const TestVendorConnectionRequestSchema = z.object({
  id: z.string().uuid(),
});
export type TestVendorConnectionRequest = z.infer<typeof TestVendorConnectionRequestSchema>;

export const ListVendorConnectionsRequestSchema = z.object({
  organizationId: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
});
export type ListVendorConnectionsRequest = z.infer<typeof ListVendorConnectionsRequestSchema>;

// === Enrichment Types ===

export const EnrichLeadRequestSchema = z.object({
  leadId: z.string().uuid(),
  organizationId: z.string().min(1),
  providers: z.array(DataVendorProvider).optional(), // Specific providers or use waterfall
  forceRefresh: z.boolean().optional().default(false),
});
export type EnrichLeadRequest = z.infer<typeof EnrichLeadRequestSchema>;

export const BulkEnrichRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  providers: z.array(DataVendorProvider).optional(),
  forceRefresh: z.boolean().optional().default(false),
});
export type BulkEnrichRequest = z.infer<typeof BulkEnrichRequestSchema>;

export const GetLeadContactInfoRequestSchema = z.object({
  leadId: z.string().uuid(),
});
export type GetLeadContactInfoRequest = z.infer<typeof GetLeadContactInfoRequestSchema>;

export const AddContactInfoRequestSchema = z.object({
  leadId: z.string().uuid(),
  type: ContactInfoType,
  value: z.string().min(1),
  isPrimary: z.boolean().optional().default(false),
  source: z.string().optional(),
});
export type AddContactInfoRequest = z.infer<typeof AddContactInfoRequestSchema>;

export const UpdateContactInfoRequestSchema = z.object({
  id: z.string().uuid(),
  type: ContactInfoType.optional(),
  value: z.string().min(1).optional(),
  isPrimary: z.boolean().optional(),
  isVerified: z.boolean().optional(),
});
export type UpdateContactInfoRequest = z.infer<typeof UpdateContactInfoRequestSchema>;

export const DeleteContactInfoRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteContactInfoRequest = z.infer<typeof DeleteContactInfoRequestSchema>;

export const GetEnrichmentHistoryRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().uuid().optional(),
  provider: DataVendorProvider.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});
export type GetEnrichmentHistoryRequest = z.infer<typeof GetEnrichmentHistoryRequestSchema>;

// === Response Types ===

export interface VendorConnectionResponse {
  id: string;
  organizationId: string;
  provider: DataVendorProvider;
  isActive: boolean;
  priority: number;
  enabledDataTypes: VendorDataType[];
  creditsUsed: number;
  creditsLimit: number | null;
  creditsRemaining: number | null;
  lastSyncAt: string | null;
  connectedById: string;
  connectedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface VendorConnectionListResponse {
  data: VendorConnectionResponse[];
}

export interface VendorTestResult {
  success: boolean;
  message: string;
  responseTimeMs: number;
  creditsRemaining: number | null;
}

export interface ContactInfoResponse {
  id: string;
  leadId: string;
  type: ContactInfoType;
  value: string;
  isPrimary: boolean;
  isVerified: boolean;
  source: string | null;
  confidence: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadContactInfoResponse {
  leadId: string;
  contacts: ContactInfoResponse[];
}

export interface EnrichedFieldResult {
  field: string;
  previousValue: string | null;
  newValue: string;
  source: DataVendorProvider;
  confidence: number | null;
}

export interface EnrichLeadResponse {
  leadId: string;
  success: boolean;
  providersUsed: DataVendorProvider[];
  fieldsEnriched: EnrichedFieldResult[];
  creditsUsed: number;
  cacheHit?: boolean;
  creditsSaved?: number;
  errorMessage: string | null;
}

export interface BulkEnrichResponse {
  totalRequested: number;
  totalEnriched: number;
  totalFailed: number;
  totalCreditsUsed: number;
  results: EnrichLeadResponse[];
}

export interface EnrichmentHistoryRecordResponse {
  id: string;
  organizationId: string;
  leadId: string;
  leadName: string | null;
  vendorConnectionId: string | null;
  provider: DataVendorProvider;
  requestType: EnrichmentRequestType;
  fieldsRequested: string[];
  fieldsEnriched: string[];
  creditsCost: number;
  success: boolean;
  errorMessage: string | null;
  responseTimeMs: number | null;
  createdAt: string;
}

export interface EnrichmentHistoryResponse {
  data: EnrichmentHistoryRecordResponse[];
  total: number;
  page: number;
  limit: number;
  // Aggregated stats for the query period
  totalCreditsUsed: number;
  totalSuccessful: number;
  totalFailed: number;
}

// === Vendor Adapter Interface ===
// This is for documentation - actual implementation in backend

export interface VendorEnrichmentResult {
  provider: DataVendorProvider;
  success: boolean;
  errorMessage: string | null;
  creditsCost: number;
  responseTimeMs: number;
  data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    mobilePhone?: string;
    directDial?: string;
    company?: string;
    title?: string;
    linkedInUrl?: string;
    industry?: string;
    companySize?: string;
    revenue?: string;
    location?: string;
    additionalEmails?: string[];
    additionalPhones?: string[];
  } | null;
}

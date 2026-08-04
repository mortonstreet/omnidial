import { z } from 'zod';
import { PaginationRequestSchema } from './pagination';

// Lead status in campaign
export const CampaignLeadStatusSchema = z.enum(['pending', 'dialed', 'completed']);
export type CampaignLeadStatus = z.infer<typeof CampaignLeadStatusSchema>;

// Smart filter for individual fields
export const SmartFilterSchema = z.object({
  operator: z.enum(['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte']),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
export type SmartFilter = z.infer<typeof SmartFilterSchema>;

// List leads
export const ListLeadsRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().min(1),
  search: z.string().optional(),
  campaignId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  pipelineStageId: z.string().uuid().optional(),
  inPipeline: z.coerce.boolean().optional().default(false),
  includeDeleted: z.coerce.boolean().optional().default(false),
  includeClient: z.coerce.boolean().optional().default(false),
  // Smart query filters - passed as JSON strings in query params
  titleFilter: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try { return SmartFilterSchema.parse(JSON.parse(val)); }
    catch { return undefined; }
  }),
  emailFilter: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try { return SmartFilterSchema.parse(JSON.parse(val)); }
    catch { return undefined; }
  }),
  companyFilter: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try { return SmartFilterSchema.parse(JSON.parse(val)); }
    catch { return undefined; }
  }),
  createdAtFilter: z.string().optional().transform((val) => {
    if (!val) return undefined;
    try { return SmartFilterSchema.parse(JSON.parse(val)); }
    catch { return undefined; }
  }),
});
export type ListLeadsRequest = z.infer<typeof ListLeadsRequestSchema>;

// Get lead
export const GetLeadRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetLeadRequest = z.infer<typeof GetLeadRequestSchema>;

// Phone validation - accepts various formats and normalizes to 10 digits
// Accepts: +1 555 123 4567, (555) 123-4567, 555-123-4567, 5551234567, etc.
const phoneSchema = z.string()
  .transform((val) => val.replace(/\D/g, '')) // Strip non-digits
  .transform((val) => {
    // Remove leading 1 if 11 digits (US country code)
    if (val.length === 11 && val.startsWith('1')) {
      return val.slice(1);
    }
    return val;
  })
  .refine((val) => val.length === 10, {
    message: 'Phone must be 10 digits (excluding country code)',
  });

// URL schema that auto-prepends https:// if no protocol is provided
const urlSchema = z.string()
  .transform((val) => {
    if (val && !/^https?:\/\//i.test(val)) {
      return `https://${val}`;
    }
    return val;
  })
  .pipe(z.string().url());

// Create lead
export const CreateLeadRequestSchema = z.object({
  organizationId: z.string().min(1),
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
  email: z.string().email().optional(),
  phone: phoneSchema,
  company: z.string().trim().max(255).optional(),
  title: z.string().trim().max(255).optional(),
  linkedInUrl: urlSchema.optional(),
  website: urlSchema.optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  pipelineStageId: z.string().uuid().optional(),
  dealValue: z.number().optional(),
});
export type CreateLeadRequest = z.infer<typeof CreateLeadRequestSchema>;

// Update lead - uses lenient phone validation to support existing data and international formats
export const UpdateLeadRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  firstName: z.string().trim().max(255).optional(),
  lastName: z.string().trim().max(255).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().min(1).nullable().optional(), // Allows clearing phone for "wrong number" disposition
  company: z.string().trim().max(255).nullable().optional(),
  title: z.string().trim().max(255).nullable().optional(),
  linkedInUrl: urlSchema.nullable().optional(),
  website: urlSchema.nullable().optional(),
  customFields: z.record(z.string(), z.string()).optional(),
  pipelineStageId: z.string().uuid().nullable().optional(),
  dealValue: z.number().nullable().optional(),
  clientId: z.string().uuid().nullable().optional(), // Direct client assignment (only when not in campaign)
});
export type UpdateLeadRequest = z.infer<typeof UpdateLeadRequestSchema>;

// Delete lead (soft delete)
export const DeleteLeadRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type DeleteLeadRequest = z.infer<typeof DeleteLeadRequestSchema>;

// Lookup lead by phone (for inbound matching)
export const LookupLeadRequestSchema = z.object({
  organizationId: z.string().min(1),
  phone: phoneSchema,
});
export type LookupLeadRequest = z.infer<typeof LookupLeadRequestSchema>;

// Bulk create leads (for CSV import)
export const BulkCreateLeadsRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  leads: z.array(z.object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    email: z.string().optional(),
    phone: phoneSchema,
    company: z.string().trim().optional(),
    title: z.string().trim().optional(),
    linkedInUrl: z.string().optional(),
    website: z.string().optional(),
    customFields: z.record(z.string(), z.string()).optional(),
  })),
});
export type BulkCreateLeadsRequest = z.infer<typeof BulkCreateLeadsRequestSchema>;

// Smart query filter operators
export const FilterOperatorSchema = z.enum(['eq', 'ne', 'contains', 'startsWith', 'endsWith', 'gt', 'gte', 'lt', 'lte']);
export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

// Smart query filter value
export const FilterValueSchema = z.object({
  operator: FilterOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});
export type FilterValue = z.infer<typeof FilterValueSchema>;

// Smart query filters object
export const SmartQueryFiltersSchema = z.record(z.string(), FilterValueSchema);
export type SmartQueryFilters = z.infer<typeof SmartQueryFiltersSchema>;

// Smart query request
export const SmartQueryRequestSchema = z.object({
  organizationId: z.string().min(1),
  query: z.string().min(1),
  previewOnly: z.boolean().optional().default(true),
});
export type SmartQueryRequest = z.infer<typeof SmartQueryRequestSchema>;

// Smart query response
export interface SmartQueryResponse {
  interpretation: {
    filters: SmartQueryFilters;
    humanReadable: string;
  };
  previewCount: number;
  leads?: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    title: string | null;
    createdAt: Date;
  }>;
}

// Bulk add leads to campaign
export const BulkAddToCampaignRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1),
  campaignId: z.string().uuid(),
});
export type BulkAddToCampaignRequest = z.infer<typeof BulkAddToCampaignRequestSchema>;

// Bulk add to campaign response
export interface BulkAddToCampaignResponse {
  success: boolean;
  added: number;
  alreadyInCampaign: number;
}

// Bulk add leads to pipeline stage
export const BulkAddToPipelineRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1),
  pipelineStageId: z.string().uuid(),
});
export type BulkAddToPipelineRequest = z.infer<typeof BulkAddToPipelineRequestSchema>;

// Bulk add to pipeline response
export interface BulkAddToPipelineResponse {
  success: boolean;
  updated: number;
  alreadyInPipeline: number;
}

// Move lead to pipeline stage (for CRM)
export const MoveLeadRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  pipelineStageId: z.string().uuid().nullable(),
});
export type MoveLeadRequest = z.infer<typeof MoveLeadRequestSchema>;

// Get lead activity (combined timeline)
export const GetLeadActivityRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetLeadActivityRequest = z.infer<typeof GetLeadActivityRequestSchema>;

// Get lead calls (call history with recordings)
export const GetLeadCallsRequestSchema = PaginationRequestSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetLeadCallsRequest = z.infer<typeof GetLeadCallsRequestSchema>;

// Activity item types
export interface ActivityItem {
  id: string;
  type: 'call' | 'note' | 'task';
  content: string;
  createdAt: string;
  metadata?: {
    duration?: number;
    recordingUrl?: string | null;
    completed?: boolean;
    status?: string;
    direction?: string;
  };
}

export interface GetLeadActivityResponse {
  data: ActivityItem[];
}

// Generate AI company summary
export const GenerateCompanySummaryRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  forceRegenerate: z.boolean().optional().default(false),
});
export type GenerateCompanySummaryRequest = z.infer<typeof GenerateCompanySummaryRequestSchema>;

export interface GenerateCompanySummaryResponse {
  summary: string;
  cached: boolean;
  noInfoAvailable?: boolean;
}

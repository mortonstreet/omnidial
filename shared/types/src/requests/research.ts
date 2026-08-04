import { z } from 'zod';

// === Custom Field Schema Types ===

export const CustomFieldType = z.enum([
  'text',
  'number',
  'date',
  'url',
  'email',
  'phone',
  'select',
  'multiselect',
]);
export type CustomFieldType = z.infer<typeof CustomFieldType>;

export const CreateCustomFieldSchemaRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, 'Must be lowercase snake_case'),
  label: z.string().min(1).max(100),
  fieldType: CustomFieldType.optional().default('text'),
  description: z.string().max(500).optional(),
  isRequired: z.boolean().optional().default(false),
  defaultValue: z.string().optional(),
  validationRule: z.string().optional(), // JSON string
  sortOrder: z.number().int().min(0).optional(),
});
export type CreateCustomFieldSchemaRequest = z.infer<typeof CreateCustomFieldSchemaRequestSchema>;

export const UpdateCustomFieldSchemaRequestSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  isRequired: z.boolean().optional(),
  defaultValue: z.string().optional().nullable(),
  validationRule: z.string().optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCustomFieldSchemaRequest = z.infer<typeof UpdateCustomFieldSchemaRequestSchema>;

export const ListCustomFieldSchemasRequestSchema = z.object({
  organizationId: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
});
export type ListCustomFieldSchemasRequest = z.infer<typeof ListCustomFieldSchemasRequestSchema>;

// === Research Template Types ===

export const CreateResearchTemplateRequestSchema = z.object({
  organizationId: z.string().min(1).optional(), // null for system templates
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  prompt: z.string().min(1).max(10000),
  targetUrls: z.array(z.string()).optional().default([]),
  extractionSchema: z.record(z.string(), z.unknown()).optional().default({}),
  fieldMappings: z.record(z.string(), z.string()).optional().default({}),
  isSystemTemplate: z.boolean().optional().default(false),
});
export type CreateResearchTemplateRequest = z.infer<typeof CreateResearchTemplateRequestSchema>;

export const UpdateResearchTemplateRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  prompt: z.string().min(1).max(10000).optional(),
  targetUrls: z.array(z.string()).optional(),
  extractionSchema: z.record(z.string(), z.unknown()).optional(),
  fieldMappings: z.record(z.string(), z.string()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateResearchTemplateRequest = z.infer<typeof UpdateResearchTemplateRequestSchema>;

export const ListResearchTemplatesRequestSchema = z.object({
  organizationId: z.string().min(1),
  isActive: z.coerce.boolean().optional(),
  includeSystem: z.coerce.boolean().optional().default(true),
});
export type ListResearchTemplatesRequest = z.infer<typeof ListResearchTemplatesRequestSchema>;

// === Research Task Types ===

export const ResearchTaskStatus = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
]);
export type ResearchTaskStatus = z.infer<typeof ResearchTaskStatus>;

export const CreateResearchTaskRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  customPrompt: z.string().max(10000).optional(),
  targetUrls: z.array(z.string().url()).optional(),
  priority: z.number().int().min(0).max(100).optional().default(0),
});
export type CreateResearchTaskRequest = z.infer<typeof CreateResearchTaskRequestSchema>;

export const BulkCreateResearchTasksRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1).max(100),
  templateId: z.string().uuid().optional(),
  customPrompt: z.string().max(10000).optional(),
  targetUrls: z.array(z.string().url()).optional(),
  priority: z.number().int().min(0).max(100).optional().default(0),
});
export type BulkCreateResearchTasksRequest = z.infer<typeof BulkCreateResearchTasksRequestSchema>;

export const ListResearchTasksRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().uuid().optional(),
  status: ResearchTaskStatus.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type ListResearchTasksRequest = z.infer<typeof ListResearchTasksRequestSchema>;

export const CancelResearchTaskRequestSchema = z.object({
  id: z.string().uuid(),
});
export type CancelResearchTaskRequest = z.infer<typeof CancelResearchTaskRequestSchema>;

export const RetryResearchTaskRequestSchema = z.object({
  id: z.string().uuid(),
});
export type RetryResearchTaskRequest = z.infer<typeof RetryResearchTaskRequestSchema>;

// === Research Approval Types ===

export const ResearchApprovalStatus = z.enum([
  'pending',
  'approved',
  'rejected',
  'modified',
]);
export type ResearchApprovalStatus = z.infer<typeof ResearchApprovalStatus>;

export const ListResearchApprovalsRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  status: ResearchApprovalStatus.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type ListResearchApprovalsRequest = z.infer<typeof ListResearchApprovalsRequestSchema>;

export const ApproveResearchApprovalRequestSchema = z.object({
  id: z.string().uuid(),
});
export type ApproveResearchApprovalRequest = z.infer<typeof ApproveResearchApprovalRequestSchema>;

export const RejectResearchApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().max(500).optional(),
});
export type RejectResearchApprovalRequest = z.infer<typeof RejectResearchApprovalRequestSchema>;

export const ModifyResearchApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  modifiedValue: z.string().min(1),
});
export type ModifyResearchApprovalRequest = z.infer<typeof ModifyResearchApprovalRequestSchema>;

export const BulkApproveResearchApprovalsRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});
export type BulkApproveResearchApprovalsRequest = z.infer<typeof BulkApproveResearchApprovalsRequestSchema>;

export const BulkRejectResearchApprovalsRequestSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  reason: z.string().max(500).optional(),
});
export type BulkRejectResearchApprovalsRequest = z.infer<typeof BulkRejectResearchApprovalsRequestSchema>;

// === Firecrawl Connection Types ===

export const TestFirecrawlConnectionRequestSchema = z.object({
  apiKey: z.string().min(1),
});
export type TestFirecrawlConnectionRequest = z.infer<typeof TestFirecrawlConnectionRequestSchema>;

// === Response Types ===

export interface CustomFieldSchemaResponse {
  id: string;
  organizationId: string;
  name: string;
  label: string;
  fieldType: CustomFieldType;
  description: string | null;
  isRequired: boolean;
  defaultValue: string | null;
  validationRule: string | null;
  sortOrder: number;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomFieldSchemaListResponse {
  data: CustomFieldSchemaResponse[];
}

export interface ResearchTemplateResponse {
  id: string;
  organizationId: string | null;
  name: string;
  description: string | null;
  prompt: string;
  targetUrls: string[];
  extractionSchema: Record<string, unknown>;
  fieldMappings: Record<string, string>;
  isSystemTemplate: boolean;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchTemplateListResponse {
  data: ResearchTemplateResponse[];
}

export interface ResearchTaskResponse {
  id: string;
  organizationId: string;
  leadId: string;
  leadName: string | null; // Joined from lead
  templateId: string | null;
  templateName: string | null; // Joined from template
  customPrompt: string | null;
  targetUrls: string[];
  status: ResearchTaskStatus;
  priority: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  creditsUsed: number;
  crawlCount: number;
  pendingApprovalCount: number; // Count of pending approvals
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchTaskListResponse {
  data: ResearchTaskResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ResearchTaskDetailResponse extends ResearchTaskResponse {
  rawResults: unknown;
  extractedData: unknown;
  approvals: ResearchApprovalResponse[];
}

export interface ResearchApprovalResponse {
  id: string;
  researchTaskId: string;
  leadId: string;
  fieldSchemaId: string | null;
  fieldName: string;
  fieldLabel: string | null; // From custom field schema
  fieldType: string;
  currentValue: string | null;
  proposedValue: string;
  source: string | null;
  confidence: number | null;
  status: ResearchApprovalStatus;
  reviewedById: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  modifiedValue: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchApprovalListResponse {
  data: ResearchApprovalResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface BulkResearchTasksResponse {
  totalRequested: number;
  totalCreated: number;
  taskIds: string[];
  errors: Array<{
    leadId: string;
    error: string;
  }>;
}

export interface BulkApprovalActionResponse {
  totalRequested: number;
  totalProcessed: number;
  errors: Array<{
    id: string;
    error: string;
  }>;
}

export interface FirecrawlTestResult {
  success: boolean;
  message: string;
}

// === Research History Types ===

export const ResearchHistoryAction = z.enum([
  'task_created',
  'task_queued',
  'task_started',
  'task_completed',
  'task_failed',
  'task_cancelled',
  'task_retried',
  'approval_created',
  'approval_approved',
  'approval_rejected',
  'approval_modified',
  'lead_updated',
]);
export type ResearchHistoryAction = z.infer<typeof ResearchHistoryAction>;

export interface ResearchHistoryResponse {
  id: string;
  organizationId: string;
  leadId: string | null;
  taskId: string | null;
  action: ResearchHistoryAction;
  details: Record<string, unknown>;
  performedById: string | null;
  performedByName: string | null;
  createdAt: string;
}

export interface ResearchHistoryListResponse {
  data: ResearchHistoryResponse[];
  total: number;
  page: number;
  limit: number;
}

export const ListResearchHistoryRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  action: ResearchHistoryAction.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});
export type ListResearchHistoryRequest = z.infer<typeof ListResearchHistoryRequestSchema>;

// === Firecrawl Credits ===

export interface FirecrawlCreditsResponse {
  creditsRemaining: number | null;
  creditsUsed: number;
  lastCheckedAt: string | null;
}

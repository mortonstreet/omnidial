import { z } from 'zod';

// === Provider Types ===
// Note: Only google_sheets, enrich_engine, and webhook are active integrations
// Salesforce, HubSpot, Slack, Zapier have been deprecated
export const IntegrationProviderSchema = z.enum([
  'google_sheets',
  'enrich_engine',
  'webhook',
  'hubspot',
  'salesforce',
  'pipedrive',
  'monday',
  'attio',
]);
export type IntegrationProvider = z.infer<typeof IntegrationProviderSchema>;

export const IntegrationCategorySchema = z.enum([
  'crm',
  'communication',
  'data',
  'automation',
]);
export type IntegrationCategory = z.infer<typeof IntegrationCategorySchema>;

export const SyncDirectionSchema = z.enum(['one_way', 'two_way']);
export type SyncDirection = z.infer<typeof SyncDirectionSchema>;

// === Request Schemas ===
export const ListIntegrationsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type ListIntegrationsRequest = z.infer<typeof ListIntegrationsRequestSchema>;

export const GetIntegrationStatusRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: IntegrationProviderSchema,
});
export type GetIntegrationStatusRequest = z.infer<typeof GetIntegrationStatusRequestSchema>;

export const ConnectIntegrationRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: IntegrationProviderSchema,
  redirectUrl: z.string().url().optional(),
});
export type ConnectIntegrationRequest = z.infer<typeof ConnectIntegrationRequestSchema>;

export const IntegrationCallbackRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: IntegrationProviderSchema,
  code: z.string().min(1),
  state: z.string().optional(),
});
export type IntegrationCallbackRequest = z.infer<typeof IntegrationCallbackRequestSchema>;

export const FieldMappingSchema = z.object({
  source: z.string(),
  target: z.string(),
});

export const WebhookEventSchema = z.enum([
  'call.completed',
  'call.started',
  'lead.created',
  'lead.updated',
  'campaign.completed',
]);
export type WebhookEvent = z.infer<typeof WebhookEventSchema>;

export const IntegrationConfigSchema = z.object({
  // Google Sheets settings
  syncLeads: z.boolean().optional(),
  logCalls: z.boolean().optional(),
  syncPipeline: z.boolean().optional(),
  importContacts: z.boolean().optional(),
  syncDirection: SyncDirectionSchema.optional(),
  fieldMappings: z.array(FieldMappingSchema).optional(),
  // Webhook settings
  webhookUrl: z.string().url().optional().or(z.literal('')),
  webhookEvents: z.array(z.string()).optional(),
  // Auto-sync to CRM after enrichment
  autoSyncToCrm: z.boolean().optional(),
});
export type IntegrationConfig = z.infer<typeof IntegrationConfigSchema>;

export const UpdateIntegrationConfigRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: IntegrationProviderSchema,
  config: IntegrationConfigSchema,
});
export type UpdateIntegrationConfigRequest = z.infer<typeof UpdateIntegrationConfigRequestSchema>;

export const DisconnectIntegrationRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: IntegrationProviderSchema,
});
export type DisconnectIntegrationRequest = z.infer<typeof DisconnectIntegrationRequestSchema>;

export const TestIntegrationRequestSchema = z.object({
  organizationId: z.string().min(1),
  provider: IntegrationProviderSchema,
});
export type TestIntegrationRequest = z.infer<typeof TestIntegrationRequestSchema>;

// === Response Types ===
export interface IntegrationConnectedBy {
  id: string;
  name: string;
  email: string;
}

export interface IntegrationResponse {
  provider: IntegrationProvider;
  name: string;
  description: string;
  category: IntegrationCategory;
  isConnected: boolean;
  connectedAt?: string;
  connectedBy?: IntegrationConnectedBy | null;
  lastSyncAt?: string;
  config?: IntegrationConfig;
}

export interface IntegrationListResponse {
  data: IntegrationResponse[];
}

export interface OAuthUrlResponse {
  url: string;
  state: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
}

// === Google Sheets Specific ===

export const ListGoogleSheetsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type ListGoogleSheetsRequest = z.infer<typeof ListGoogleSheetsRequestSchema>;

export const GetSheetColumnsRequestSchema = z.object({
  organizationId: z.string().min(1),
  sheetId: z.string().min(1),
});
export type GetSheetColumnsRequest = z.infer<typeof GetSheetColumnsRequestSchema>;

export const ColumnMappingInputSchema = z.object({
  columnIndex: z.number(),
  columnName: z.string(),
  leadField: z.string(), // firstName, lastName, phone, email, company, title, linkedInUrl
});
export type ColumnMappingInput = z.infer<typeof ColumnMappingInputSchema>;

export const ImportFromSheetRequestSchema = z.object({
  organizationId: z.string().min(1),
  sheetId: z.string().min(1),
  columnMappings: z.array(ColumnMappingInputSchema),
  listName: z.string().optional(), // Optional override for list name
});
export type ImportFromSheetRequest = z.infer<typeof ImportFromSheetRequestSchema>;

export interface GoogleSheet {
  id: string;
  name: string;
  modifiedTime: string;
}

export interface SheetColumn {
  index: number;
  name: string;
}

export interface ImportResult {
  success: boolean;
  listId: string;
  listName: string;
  leadsImported: number;
  errors?: string[];
}

// === Enrich Engine Specific (API Key Authentication) ===

// API Key validation: must start with 'ee_' and be at least 40 characters
export const EnrichEngineApiKeySchema = z.string()
  .min(40, 'API key appears too short')
  .refine((key) => key.startsWith('ee_'), {
    message: 'Invalid API key format. Key should start with "ee_"',
  });

// Connect with API key (not OAuth)
export const ConnectEnrichEngineRequestSchema = z.object({
  organizationId: z.string().min(1),
  apiKey: EnrichEngineApiKeySchema,
});
export type ConnectEnrichEngineRequest = z.infer<typeof ConnectEnrichEngineRequestSchema>;

// Get EnrichEngine connection status
export const GetEnrichEngineStatusRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetEnrichEngineStatusRequest = z.infer<typeof GetEnrichEngineStatusRequestSchema>;

// Disconnect EnrichEngine
export const DisconnectEnrichEngineRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type DisconnectEnrichEngineRequest = z.infer<typeof DisconnectEnrichEngineRequestSchema>;

// Test EnrichEngine connection
export const TestEnrichEngineRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type TestEnrichEngineRequest = z.infer<typeof TestEnrichEngineRequestSchema>;

// List EnrichEngine lists
export const ListEnrichEngineListsRequestSchema = z.object({
  organizationId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
  search: z.string().optional(),
});
export type ListEnrichEngineListsRequest = z.infer<typeof ListEnrichEngineListsRequestSchema>;

// Get leads from EnrichEngine list
export const GetEnrichEngineListLeadsRequestSchema = z.object({
  organizationId: z.string().min(1),
  listId: z.string().min(1),
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100).optional(),
});
export type GetEnrichEngineListLeadsRequest = z.infer<typeof GetEnrichEngineListLeadsRequestSchema>;

// Import from EnrichEngine
export const ImportFromEnrichEngineRequestSchema = z.object({
  organizationId: z.string().min(1),
  listId: z.string().min(1),
  listName: z.string().optional(), // Optional override for local list name
});
export type ImportFromEnrichEngineRequest = z.infer<typeof ImportFromEnrichEngineRequestSchema>;

// EnrichEngine API response types (as per spec)
export interface EnrichEngineList {
  id: string;
  name: string;
  description: string | null;
  leadCount: number;
  source: 'uploaded' | 'scraped';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface EnrichEngineLead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  role: string | null;
  linkedinUrl: string | null;
  companyDomain: string | null;
  customFields: Record<string, unknown>;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface EnrichEnginePagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EnrichEngineListsResponse {
  lists: EnrichEngineList[];
  pagination: EnrichEnginePagination;
}

export interface EnrichEngineListDetailResponse {
  list: EnrichEngineList;
  leads: EnrichEngineLead[];
  pagination: EnrichEnginePagination;
}

export interface EnrichEngineConnectionStatus {
  isConnected: boolean;
  isActive?: boolean;
  lastSyncAt?: string;
  connectedAt?: string;
  connectedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

// === Google Sheets Export Types ===

export const ExportTargetSchema = z.enum(['new_sheet', 'existing_sheet']);
export type ExportTarget = z.infer<typeof ExportTargetSchema>;

// Check write access
export const CheckSheetsWriteAccessRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type CheckSheetsWriteAccessRequest = z.infer<typeof CheckSheetsWriteAccessRequestSchema>;

export interface CheckSheetsWriteAccessResponse {
  hasWriteAccess: boolean;
  needsReauth: boolean;
}

// Export leads to sheet
export const ExportLeadsToSheetRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()),
  target: ExportTargetSchema,
  existingSheetId: z.string().optional(),
  newSheetTitle: z.string().optional(),
});
export type ExportLeadsToSheetRequest = z.infer<typeof ExportLeadsToSheetRequestSchema>;

// Export list to sheet
export const ExportListToSheetRequestSchema = z.object({
  organizationId: z.string().min(1),
  listId: z.string().uuid(),
  target: ExportTargetSchema,
  existingSheetId: z.string().optional(),
  newSheetTitle: z.string().optional(),
});
export type ExportListToSheetRequest = z.infer<typeof ExportListToSheetRequestSchema>;

// Export analytics to sheet
export const ExportAnalyticsToSheetRequestSchema = z.object({
  organizationId: z.string().min(1),
  dateRange: z.object({
    start: z.string(),
    end: z.string(),
  }),
  target: ExportTargetSchema,
  existingSheetId: z.string().optional(),
  newSheetTitle: z.string().optional(),
});
export type ExportAnalyticsToSheetRequest = z.infer<typeof ExportAnalyticsToSheetRequestSchema>;

// Export result
export interface ExportToSheetResult {
  success: boolean;
  spreadsheetId: string;
  spreadsheetUrl: string;
  spreadsheetName: string;
  rowsExported: number;
}

// === HubSpot Specific ===

export const ListHubSpotContactListsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type ListHubSpotContactListsRequest = z.infer<typeof ListHubSpotContactListsRequestSchema>;

export const ImportFromHubSpotRequestSchema = z.object({
  organizationId: z.string().min(1),
  listName: z.string().optional(),
  requirePhone: z.boolean().default(true),
  maxContacts: z.coerce.number().int().min(1).max(10000).optional(),
});
export type ImportFromHubSpotRequest = z.infer<typeof ImportFromHubSpotRequestSchema>;

export interface HubSpotContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
}

export interface HubSpotContactsResponse {
  results: HubSpotContact[];
  paging?: {
    next?: {
      after: string;
    };
  };
}

export interface HubSpotContactsSummary {
  totalContacts: number;
  contactsWithPhone: number;
  contactsWithEmail: number;
  sampleContacts: HubSpotContact[];
}

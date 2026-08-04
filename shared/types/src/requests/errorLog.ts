import { z } from 'zod';
import { PaginationRequestSchema, PaginatedResponse } from './pagination';

// ============================================================================
// Enums / Constants
// ============================================================================

export const ErrorSeverity = {
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
} as const;

export type ErrorSeverity = (typeof ErrorSeverity)[keyof typeof ErrorSeverity];

export const ErrorProduct = {
  PROGRAMMABLE_VOICE: 'Programmable Voice',
  CALLS: 'Calls',
  DIALER: 'Dialer',
  API: 'API',
  WEBHOOKS: 'Webhooks',
  INTEGRATIONS: 'Integrations',
} as const;

export type ErrorProduct = (typeof ErrorProduct)[keyof typeof ErrorProduct];

export const ErrorCategory = {
  TWILIO: 'TWILIO',
  DIALER: 'DIALER',
  API: 'API',
  VALIDATION: 'VALIDATION',
  CONFIG: 'CONFIG',
  INTEGRATION: 'INTEGRATION',
  DATABASE: 'DATABASE',
  UNKNOWN: 'UNKNOWN',
} as const;

export type ErrorCategory = (typeof ErrorCategory)[keyof typeof ErrorCategory];

export const ErrorLogStatus = {
  OPEN: 'open',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
} as const;

export type ErrorLogStatus = (typeof ErrorLogStatus)[keyof typeof ErrorLogStatus];

// ============================================================================
// Request/Response Types
// ============================================================================

// Get Error Logs (paginated, filterable list)
export const GetErrorLogsRequestSchema = PaginationRequestSchema.extend({
  severity: z.enum(['warning', 'error', 'critical']).optional(),
  product: z.string().optional(),
  category: z.string().optional(),
  status: z.enum(['open', 'acknowledged', 'resolved']).optional(),
  organizationId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type GetErrorLogsRequest = z.infer<typeof GetErrorLogsRequestSchema>;

export type ErrorLogItem = {
  id: string;
  code: string;
  message: string;
  severity: string;
  product: string;
  category: string;
  organizationId: string | null;
  organizationName?: string | null;
  userId: string | null;
  userName?: string | null;
  status: string;
  occurredAt: string;
  createdAt: string;
};

export type GetErrorLogsResponse = PaginatedResponse<ErrorLogItem>;

// Get Error Log Detail
export const GetErrorLogDetailRequestSchema = z.object({
  id: z.string(),
});

export type GetErrorLogDetailRequest = z.infer<typeof GetErrorLogDetailRequestSchema>;

export type ErrorLogDetail = {
  id: string;
  code: string;
  message: string;
  description: string | null;
  severity: string;
  product: string;
  category: string;
  organizationId: string | null;
  organizationName?: string | null;
  userId: string | null;
  userName?: string | null;
  userEmail?: string | null;
  callId: string | null;
  campaignId: string | null;
  campaignName?: string | null;
  leadId: string | null;
  leadName?: string | null;
  twilioCallSid: string | null;
  metadata: Record<string, unknown>;
  source: string | null;
  requestId: string | null;
  stackTrace: string | null;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolvedByName?: string | null;
  resolutionNote: string | null;
  occurredAt: string;
  createdAt: string;
};

export type GetErrorLogDetailResponse = ErrorLogDetail;

// Get Error Log Stats (for trend chart)
export const GetErrorLogStatsRequestSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  groupBy: z.enum(['hour', 'day', 'week']).default('day'),
  organizationId: z.string().optional(),
});

export type GetErrorLogStatsRequest = z.infer<typeof GetErrorLogStatsRequestSchema>;

export type ErrorLogStatsBucket = {
  timestamp: string;
  warning: number;
  error: number;
  critical: number;
  total: number;
};

export type GetErrorLogStatsResponse = {
  buckets: ErrorLogStatsBucket[];
  totals: {
    warning: number;
    error: number;
    critical: number;
    total: number;
  };
};

// Update Error Log Status
export const UpdateErrorLogStatusRequestSchema = z.object({
  id: z.string(),
  status: z.enum(['acknowledged', 'resolved']),
  resolutionNote: z.string().optional(),
});

export type UpdateErrorLogStatusRequest = z.infer<typeof UpdateErrorLogStatusRequestSchema>;

export type UpdateErrorLogStatusResponse = {
  success: boolean;
  errorLog: {
    id: string;
    status: string;
    resolvedAt: string | null;
    resolvedBy: string | null;
    resolutionNote: string | null;
  };
};

// Create Error Log (for internal use by logError service)
export type CreateErrorLogInput = {
  code: string;
  message: string;
  description?: string;
  severity: 'warning' | 'error' | 'critical';
  product: string;
  category: string;
  organizationId?: string;
  userId?: string;
  callId?: string;
  campaignId?: string;
  leadId?: string;
  twilioCallSid?: string;
  metadata?: Record<string, unknown>;
  source?: string;
  requestId?: string;
  stackTrace?: string;
};

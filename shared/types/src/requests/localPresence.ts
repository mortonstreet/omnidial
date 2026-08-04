import { z } from 'zod';

// === Phone Number Pool Types ===

export const CnamStatus = z.enum(['pending', 'approved', 'rejected']);
export type CnamStatus = z.infer<typeof CnamStatus>;

export const ListPhonePoolRequestSchema = z.object({
  organizationId: z.string().min(1),
  areaCode: z.string().length(3).optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});
export type ListPhonePoolRequest = z.infer<typeof ListPhonePoolRequestSchema>;

export const GetPhonePoolNumberRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetPhonePoolNumberRequest = z.infer<typeof GetPhonePoolNumberRequestSchema>;

export const SyncPhonePoolFromTwilioRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type SyncPhonePoolFromTwilioRequest = z.infer<typeof SyncPhonePoolFromTwilioRequestSchema>;

export const UpdatePoolNumberRequestSchema = z.object({
  id: z.string().uuid(),
  friendlyName: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
});
export type UpdatePoolNumberRequest = z.infer<typeof UpdatePoolNumberRequestSchema>;

export const SubmitCnamRequestSchema = z.object({
  id: z.string().uuid(),
  cnamName: z.string().min(1).max(15), // CNAM limited to 15 chars
});
export type SubmitCnamRequest = z.infer<typeof SubmitCnamRequestSchema>;

export const BulkSetPoolActiveRequestSchema = z.object({
  organizationId: z.string().min(1),
  phoneNumberIds: z.array(z.string().uuid()).min(1).max(100),
  isActive: z.boolean(),
});
export type BulkSetPoolActiveRequest = z.infer<typeof BulkSetPoolActiveRequestSchema>;

// === Local Presence Dialing ===

export const PreviewLocalPresenceRequestSchema = z.object({
  organizationId: z.string().min(1),
  leadPhone: z.string().min(1),
});
export type PreviewLocalPresenceRequest = z.infer<typeof PreviewLocalPresenceRequestSchema>;

export const GetCallbackRoutesRequestSchema = z.object({
  organizationId: z.string().min(1),
  repUserId: z.string().uuid().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});
export type GetCallbackRoutesRequest = z.infer<typeof GetCallbackRoutesRequestSchema>;

export const ClearExpiredRoutesRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type ClearExpiredRoutesRequest = z.infer<typeof ClearExpiredRoutesRequestSchema>;

// === Area Code Coverage ===

export const GetAreaCodeCoverageRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetAreaCodeCoverageRequest = z.infer<typeof GetAreaCodeCoverageRequestSchema>;

export const GetMissingAreaCodesRequestSchema = z.object({
  organizationId: z.string().min(1),
  listId: z.string().uuid().optional(), // Analyze a specific list
});
export type GetMissingAreaCodesRequest = z.infer<typeof GetMissingAreaCodesRequestSchema>;

// === Response Types ===

export interface PhonePoolNumberResponse {
  id: string;
  organizationId: string;
  phoneNumber: string;
  friendlyName: string | null;
  areaCode: string;
  region: string | null;
  country: string;
  twilioSid: string | null;
  capabilities: string[];
  cnamStatus: CnamStatus | null;
  cnamName: string | null;
  isActive: boolean;
  lastUsedAt: string | null;
  callsToday: number;
  createdAt: string;
  updatedAt: string;
}

export interface PhonePoolListResponse {
  data: PhonePoolNumberResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface SyncPhonePoolResponse {
  added: number;
  removed: number;
  updated: number;
  total: number;
}

export interface LocalPresencePreviewResponse {
  leadPhone: string;
  leadAreaCode: string | null;
  selectedPoolNumber: PhonePoolNumberResponse | null;
  matchType: 'exact' | 'region' | 'fallback' | 'none';
  fallbackReason: string | null;
}

export interface CallbackRouteResponse {
  id: string;
  organizationId: string;
  poolNumberId: string;
  poolPhoneNumber: string;
  leadPhone: string;
  repUserId: string;
  repName: string | null;
  lastCallAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface CallbackRoutesListResponse {
  data: CallbackRouteResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface AreaCodeCoverage {
  areaCode: string;
  region: string | null;
  state: string | null;
  numberCount: number;
  activeNumberCount: number;
}

export interface AreaCodeCoverageResponse {
  organizationId: string;
  coverage: AreaCodeCoverage[];
  totalAreaCodes: number;
  totalNumbers: number;
  activeNumbers: number;
}

export interface MissingAreaCode {
  areaCode: string;
  region: string | null;
  leadCount: number;
}

export interface MissingAreaCodesResponse {
  organizationId: string;
  listId: string | null;
  missingAreaCodes: MissingAreaCode[];
  totalMissingLeads: number;
  coveragePercentage: number; // % of leads with matching area codes
}

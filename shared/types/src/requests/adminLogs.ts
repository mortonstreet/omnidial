import { z } from 'zod';
import { PaginationRequestSchema, PaginatedResponse } from './pagination';

// ============================================================================
// Admin Calls
// ============================================================================

export const GetAdminCallsRequestSchema = PaginationRequestSchema.extend({
  status: z.string().optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type GetAdminCallsRequest = z.infer<typeof GetAdminCallsRequestSchema>;

export type AdminCallItem = {
  id: string;
  twilioCallSid: string | null;
  dialCallSid: string | null;
  conferenceSid: string | null;
  fromNumber: string;
  toNumber: string;
  direction: string;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  voicemailDropped: boolean | null;
  userName: string | null;
  organizationName: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  dispositionLabel: string | null;
  dispositionColor: string | null;
  startedAt: string | null;
  answeredAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type GetAdminCallsResponse = PaginatedResponse<AdminCallItem>;

// ============================================================================
// Admin Call Detail
// ============================================================================

export const GetAdminCallDetailRequestSchema = z.object({
  id: z.string(),
});

export type GetAdminCallDetailRequest = z.infer<typeof GetAdminCallDetailRequestSchema>;

export type AdminCallDetail = AdminCallItem & {
  transcript?: {
    transcriptText: string;
    speakerLabels: unknown;
    durationSeconds: number;
    language: string;
  } | null;
  coaching?: {
    overallScore: number;
    strengths: string[];
    improvements: string[];
    feedback: unknown;
  } | null;
};

export type GetAdminCallDetailResponse = AdminCallDetail;

// ============================================================================
// Admin Recordings
// ============================================================================

export const GetAdminRecordingsRequestSchema = PaginationRequestSchema.extend({
  status: z.string().optional(),
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type GetAdminRecordingsRequest = z.infer<typeof GetAdminRecordingsRequestSchema>;

export type AdminRecordingItem = {
  id: string;
  twilioCallSid: string | null;
  fromNumber: string;
  toNumber: string;
  direction: string;
  status: string;
  duration: number | null;
  recordingUrl: string | null;
  recordingSid: string | null;
  userName: string | null;
  organizationName: string | null;
  leadFirstName: string | null;
  leadLastName: string | null;
  startedAt: string | null;
  createdAt: string;
};

export type GetAdminRecordingsResponse = PaginatedResponse<AdminRecordingItem>;

// ============================================================================
// Admin Transcriptions
// ============================================================================

export const GetAdminTranscriptionsRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

export type GetAdminTranscriptionsRequest = z.infer<typeof GetAdminTranscriptionsRequestSchema>;

export type AdminTranscriptionItem = {
  id: string;
  callId: string;
  transcriptPreview: string;
  durationSeconds: number;
  language: string;
  userName: string | null;
  organizationName: string | null;
  fromNumber: string;
  toNumber: string;
  startedAt: string | null;
  createdAt: string;
};

export type GetAdminTranscriptionsResponse = PaginatedResponse<AdminTranscriptionItem>;

// Admin Transcription Detail
export const GetAdminTranscriptionDetailRequestSchema = z.object({
  id: z.string(),
});

export type GetAdminTranscriptionDetailRequest = z.infer<typeof GetAdminTranscriptionDetailRequestSchema>;

export type AdminTranscriptionDetail = {
  id: string;
  callId: string;
  transcriptText: string;
  speakerLabels: unknown;
  durationSeconds: number;
  language: string;
  userName: string | null;
  organizationName: string | null;
  fromNumber: string;
  toNumber: string;
  startedAt: string | null;
  createdAt: string;
};

export type GetAdminTranscriptionDetailResponse = AdminTranscriptionDetail;

// ============================================================================
// Admin Activity
// ============================================================================

export const GetAdminActivityRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().optional(),
  userId: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type GetAdminActivityRequest = z.infer<typeof GetAdminActivityRequestSchema>;

export type AdminActivityItem = {
  id: string;
  type: string;
  description: string;
  userName: string | null;
  organizationName: string | null;
  metadata: unknown;
  createdAt: string;
};

export type GetAdminActivityResponse = PaginatedResponse<AdminActivityItem>;

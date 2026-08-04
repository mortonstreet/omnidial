import { z } from 'zod';

// === Parallel Dial Session Types ===

export const ParallelDialSessionStatus = z.enum(['active', 'paused', 'ended']);
export type ParallelDialSessionStatus = z.infer<typeof ParallelDialSessionStatus>;

export const ParallelDialAttemptStatus = z.enum([
  'dialing',
  'ringing',
  'connected',
  'abandoned',
  'failed',
  'no_answer',
  'voicemail',
]);
export type ParallelDialAttemptStatus = z.infer<typeof ParallelDialAttemptStatus>;

export const StartParallelDialSessionRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid().optional(),
  listId: z.string().uuid().optional(),
  lineCount: z.number().int().min(2).max(5).default(2),
});
export type StartParallelDialSessionRequest = z.infer<typeof StartParallelDialSessionRequestSchema>;

export const EndParallelDialSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type EndParallelDialSessionRequest = z.infer<typeof EndParallelDialSessionRequestSchema>;

export const PauseParallelDialSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type PauseParallelDialSessionRequest = z.infer<typeof PauseParallelDialSessionRequestSchema>;

export const ResumeParallelDialSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type ResumeParallelDialSessionRequest = z.infer<typeof ResumeParallelDialSessionRequestSchema>;

export const GetParallelDialSessionRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetParallelDialSessionRequest = z.infer<typeof GetParallelDialSessionRequestSchema>;

export const ListParallelDialSessionsRequestSchema = z.object({
  organizationId: z.string().min(1),
  status: ParallelDialSessionStatus.optional(),
  userId: z.string().uuid().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});
export type ListParallelDialSessionsRequest = z.infer<typeof ListParallelDialSessionsRequestSchema>;

export const GetAbandonedCallsReportRequestSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});
export type GetAbandonedCallsReportRequest = z.infer<typeof GetAbandonedCallsReportRequestSchema>;

// === Response Types ===

export interface ParallelDialAttemptResponse {
  id: string;
  sessionId: string;
  leadId: string;
  leadName: string | null;
  leadCompany: string | null;
  leadPhone: string;
  callSid: string | null;
  status: ParallelDialAttemptStatus;
  wasConnected: boolean;
  wasAbandoned: boolean;
  abandonedAfterMs: number | null;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
}

export interface ParallelDialSessionResponse {
  id: string;
  organizationId: string;
  userId: string;
  userName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  listId: string | null;
  listName: string | null;
  lineCount: number;
  status: ParallelDialSessionStatus;
  conferenceId: string | null;
  totalAttempts: number;
  totalConnects: number;
  totalAbandoned: number;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Current attempts when session is active
  currentAttempts?: ParallelDialAttemptResponse[];
}

export interface ParallelDialSessionListResponse {
  data: ParallelDialSessionResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface AbandonedCallRecord {
  id: string;
  sessionId: string;
  leadId: string;
  leadName: string | null;
  leadPhone: string;
  abandonedAfterMs: number;
  answeredAt: string;
  endedAt: string;
  repUserId: string;
  repName: string | null;
}

export interface AbandonedCallsReportResponse {
  data: AbandonedCallRecord[];
  total: number;
  totalAbandonedMs: number; // Total time customers waited before abandon
  page: number;
  limit: number;
}

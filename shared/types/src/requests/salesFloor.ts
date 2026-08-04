import { z } from 'zod';

// === Sales Floor Types ===

export const BlitzStatus = z.enum(['scheduled', 'active', 'paused', 'ended']);
export type BlitzStatus = z.infer<typeof BlitzStatus>;

export const BlitzGoalType = z.enum(['calls', 'connects', 'meetings']);
export type BlitzGoalType = z.infer<typeof BlitzGoalType>;

export const ManagerListenMode = z.enum(['listen', 'whisper', 'barge']);
export type ManagerListenMode = z.infer<typeof ManagerListenMode>;

// === Sales Floor Dashboard ===

export const GetSalesFloorStatusRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetSalesFloorStatusRequest = z.infer<typeof GetSalesFloorStatusRequestSchema>;

export const LeaderboardPeriod = z.enum(['today', 'week', 'month', '90d', 'all']);
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriod>;

export const GetLeaderboardRequestSchema = z.object({
  organizationId: z.string().min(1),
  period: LeaderboardPeriod.optional().default('today'),
  metric: z.enum(['calls', 'connects', 'talkTime']).optional().default('calls'),
});
export type GetLeaderboardRequest = z.infer<typeof GetLeaderboardRequestSchema>;

// === Call Blitz ===

export const CreateBlitzRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  goalType: BlitzGoalType.optional().default('calls'),
  goalTarget: z.number().int().positive().optional(),
  prizeDescription: z.string().max(255).optional(),
});
export type CreateBlitzRequest = z.infer<typeof CreateBlitzRequestSchema>;

export const UpdateBlitzRequestSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  goalType: BlitzGoalType.optional(),
  goalTarget: z.number().int().positive().nullable().optional(),
  prizeDescription: z.string().max(255).nullable().optional(),
});
export type UpdateBlitzRequest = z.infer<typeof UpdateBlitzRequestSchema>;

export const StartBlitzRequestSchema = z.object({
  id: z.string().uuid(),
});
export type StartBlitzRequest = z.infer<typeof StartBlitzRequestSchema>;

export const EndBlitzRequestSchema = z.object({
  id: z.string().uuid(),
});
export type EndBlitzRequest = z.infer<typeof EndBlitzRequestSchema>;

export const JoinBlitzRequestSchema = z.object({
  blitzId: z.string().uuid(),
});
export type JoinBlitzRequest = z.infer<typeof JoinBlitzRequestSchema>;

export const GetBlitzRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetBlitzRequest = z.infer<typeof GetBlitzRequestSchema>;

export const ListBlitzesRequestSchema = z.object({
  organizationId: z.string().min(1),
  status: BlitzStatus.optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(20),
});
export type ListBlitzesRequest = z.infer<typeof ListBlitzesRequestSchema>;

// === Manager Listen ===

export const StartListenSessionRequestSchema = z.object({
  organizationId: z.string().min(1),
  repId: z.string().uuid(),
  callId: z.string().uuid(),
  mode: ManagerListenMode.optional().default('listen'),
});
export type StartListenSessionRequest = z.infer<typeof StartListenSessionRequestSchema>;

export const ChangeListenModeRequestSchema = z.object({
  sessionId: z.string().uuid(),
  mode: ManagerListenMode,
});
export type ChangeListenModeRequest = z.infer<typeof ChangeListenModeRequestSchema>;

export const EndListenSessionRequestSchema = z.object({
  sessionId: z.string().uuid(),
});
export type EndListenSessionRequest = z.infer<typeof EndListenSessionRequestSchema>;

export const GetActiveListenSessionsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetActiveListenSessionsRequest = z.infer<typeof GetActiveListenSessionsRequestSchema>;

// === Response Types ===

export interface ActiveRepStatus {
  userId: string;
  userName: string;
  userImage: string | null;
  status: 'idle' | 'dialing' | 'on_call' | 'wrap_up';
  currentCallId: string | null;
  currentLeadId: string | null;
  currentLeadName: string | null;
  callDuration: number | null; // Seconds
  campaignId: string | null;
  campaignName: string | null;
  callsThisSession: number;
  connectedThisSession: number;
  sessionStartedAt: string | null;
}

export interface SalesFloorStatusResponse {
  organizationId: string;
  activeReps: ActiveRepStatus[];
  totalActiveReps: number;
  totalOnCalls: number;
  totalDialing: number;
  totalCallsToday: number;
  totalConnectsToday: number;
  activeBlitz: BlitzResponse | null;
}

export interface SalesFloorLeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  userImage: string | null;
  callCount: number;
  connectCount: number;
  talkTimeSeconds: number;
  meetingCount: number;
}

export interface LeaderboardResponse {
  organizationId: string;
  period: string;
  metric: string;
  entries: SalesFloorLeaderboardEntry[];
}

export interface BlitzParticipantResponse {
  id: string;
  userId: string;
  userName: string;
  userImage: string | null;
  callCount: number;
  connectCount: number;
  meetingCount: number;
  rank: number | null;
  joinedAt: string;
}

export interface BlitzResponse {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: BlitzStatus;
  startAt: string;
  endAt: string;
  goalType: BlitzGoalType;
  goalTarget: number | null;
  prizeDescription: string | null;
  createdById: string;
  createdByName: string | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  updatedAt: string;
  participants: BlitzParticipantResponse[];
  // Aggregated stats
  totalParticipants: number;
  totalCalls: number;
  totalConnects: number;
  totalMeetings: number;
  goalProgress: number | null; // Percentage if goalTarget is set
}

export interface BlitzListResponse {
  data: BlitzResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ManagerListenSessionResponse {
  id: string;
  organizationId: string;
  managerId: string;
  managerName: string | null;
  repId: string;
  repName: string | null;
  callId: string;
  conferenceSid: string | null;
  mode: ManagerListenMode;
  startedAt: string;
  endedAt: string | null;
}

export interface ActiveListenSessionsResponse {
  data: ManagerListenSessionResponse[];
}

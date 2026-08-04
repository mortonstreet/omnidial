import { z } from 'zod';

// Get Analytics Request
export const GetAnalyticsRequestSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.string().min(1), // ISO date string
  endDate: z.string().min(1), // ISO date string
  userId: z.string().min(1).optional(),
  campaignId: z.string().min(1).optional(),
  clientId: z.string().min(1).optional(),
});
export type GetAnalyticsRequest = z.infer<typeof GetAnalyticsRequestSchema>;

// Call Metrics Response
export interface CallMetrics {
  totalCalls: number;
  outboundCalls: number;
  inboundCalls: number;
  connectedCalls: number;
  connectionRate: number;
  totalTalkTimeSeconds: number;
  avgCallDurationSeconds: number;
}

// Disposition Breakdown Item
export interface DispositionBreakdown {
  dispositionId: string | null;
  label: string;
  count: number;
  color: string;
}

// Calls Over Time Item
export interface CallsOverTime {
  date: string;
  outbound: number;
  inbound: number;
  connected: number;
}

// Get Analytics Response
export interface GetAnalyticsResponse {
  metrics: CallMetrics;
  dispositionBreakdown: DispositionBreakdown[];
  callsOverTime: CallsOverTime[];
}

// Leaderboard Entry
export interface LeaderboardEntry {
  userId: string;
  userName: string | null;
  totalCalls: number;
  connectedCalls: number;
  connectionRate: number;
  totalTalkTimeSeconds: number;
}

// Get Leaderboard Response
export interface GetLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

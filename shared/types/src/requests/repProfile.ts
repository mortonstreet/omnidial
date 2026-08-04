import { z } from 'zod';

// Period enum for analytics timeframes
export const AnalyticsPeriodSchema = z.enum(['today', 'week', 'month', '90d']);
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;

// Time-of-day stats (AM or PM period)
export interface TimeStats {
  calls: number;
  connects: number;
  connectionRate: number;
  totalTalkTimeSeconds: number;
  avgCallDurationSeconds: number;
  appointments: number;
}

// AM/PM breakdown
export interface RepTimeOfDayBreakdown {
  am: TimeStats;
  pm: TimeStats;
}

// Hourly activity for heatmap
export interface HourlyActivity {
  hour: number; // 0-23
  calls: number;
  connects: number;
  avgDurationSeconds: number;
}

// Campaign-specific AM/PM stats
export interface CampaignTimeOfDayStats {
  campaignId: string;
  campaignName: string;
  am: TimeStats;
  pm: TimeStats;
}

// Get Rep Profile Stats Request
export const GetRepProfileStatsRequestSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1),
  period: AnalyticsPeriodSchema.default('week'),
  campaignId: z.string().min(1).optional(),
  refresh: z.boolean().optional(),
});
export type GetRepProfileStatsRequest = z.infer<typeof GetRepProfileStatsRequestSchema>;

// Rep Profile Stats Response
export interface RepProfileStatsResponse {
  userId: string;
  userName: string;
  userImage: string | null;
  // Overall KPIs for the period
  kpis: {
    totalCalls: number;
    totalConnects: number;
    connectionRate: number;
    totalTalkTimeSeconds: number;
    avgCallDurationSeconds: number;
    appointments: number;
  };
  // AM/PM breakdown
  timeOfDay: RepTimeOfDayBreakdown;
  // 24-hour activity distribution
  hourlyActivity: HourlyActivity[];
  // Peak performing hour
  peakHour: {
    hour: number;
    calls: number;
    connects: number;
  } | null;
  // Best time of day
  bestTimeOfDay: 'am' | 'pm' | null;
  // Campaign-level breakdown (if multiple campaigns)
  campaignStats?: CampaignTimeOfDayStats[];
}

// Get Campaign Time of Day Stats Request
export const GetCampaignTimeOfDayStatsRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().min(1),
  period: AnalyticsPeriodSchema.default('week'),
  refresh: z.boolean().optional(),
});
export type GetCampaignTimeOfDayStatsRequest = z.infer<typeof GetCampaignTimeOfDayStatsRequestSchema>;

// Campaign Time of Day Stats Response
export interface CampaignTimeOfDayStatsResponse {
  campaignId: string;
  campaignName: string;
  timeOfDay: RepTimeOfDayBreakdown;
  hourlyActivity: HourlyActivity[];
  peakHour: {
    hour: number;
    calls: number;
    connects: number;
  } | null;
  bestTimeOfDay: 'am' | 'pm' | null;
  // Per-rep breakdown
  repStats: Array<{
    userId: string;
    userName: string;
    am: TimeStats;
    pm: TimeStats;
  }>;
}

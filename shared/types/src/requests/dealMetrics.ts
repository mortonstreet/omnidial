import { z } from 'zod';
import type { DBDealSignal } from '@shared/db/src/types';

// ============================================
// Win / loss reasons
// ============================================

export const DEAL_LOSS_REASONS = [
  { value: 'price', label: 'Price / budget' },
  { value: 'competitor', label: 'Lost to competitor' },
  { value: 'timing', label: 'Bad timing' },
  { value: 'no_decision', label: 'No decision / status quo' },
  { value: 'no_champion', label: 'No champion / lost champion' },
  { value: 'poor_fit', label: 'Poor product fit' },
  { value: 'went_dark', label: 'Went dark' },
  { value: 'other', label: 'Other' },
] as const;

export const DEAL_WIN_REASONS = [
  { value: 'product_fit', label: 'Product fit' },
  { value: 'champion', label: 'Strong champion' },
  { value: 'relationship', label: 'Relationship / trust' },
  { value: 'price', label: 'Price / ROI' },
  { value: 'timing', label: 'Timing / urgency' },
  { value: 'other', label: 'Other' },
] as const;

export type DealOutcome = 'won' | 'lost';
export type StageOutcomeSetting = 'open' | 'won' | 'lost';

export type StageOutcome = 'open' | 'won' | 'lost'

const WON_LABEL = /\bwon\b(?!['’])|\bclosed[\s-]*won\b|\bsigned\b/i
const LOST_LABEL =
  /\blost\b|\bclosed[\s-]*lost\b|\bdisqualified\b|\bchurned\b|\bdead\b/i

/**
 * Explicit outcome wins. Unset stages fall back to their label so existing
 * pipelines ("Closed Won", "Closed Lost") report win/loss with no setup.
 */
export const resolveStageOutcome = (stage: {
  label: string
  outcome?: string | null
}): StageOutcome => {
  if (
    stage.outcome === 'open' ||
    stage.outcome === 'won' ||
    stage.outcome === 'lost'
  ) {
    return stage.outcome
  }
  if (WON_LABEL.test(stage.label)) return 'won'
  if (LOST_LABEL.test(stage.label)) return 'lost'
  return 'open'
}

const allReasons = [
  ...DEAL_LOSS_REASONS.map((r) => r.value),
  ...DEAL_WIN_REASONS.map((r) => r.value),
] as [string, ...string[]];

// ============================================
// Requests
// ============================================

export const GetDealMetricsRequestSchema = z.object({
  startDate: z.string().min(1), // ISO date string
  endDate: z.string().min(1), // ISO date string
  clientId: z.string().min(1).optional(),
});
export type GetDealMetricsRequest = z.infer<typeof GetDealMetricsRequestSchema>;

export const SetDealOutcomeRequestSchema = z.object({
  leadId: z.string().uuid(),
  outcome: z.enum(['won', 'lost']),
  reason: z.enum(allReasons),
  notes: z.string().max(2000).nullable().optional(),
});
export type SetDealOutcomeRequest = z.infer<typeof SetDealOutcomeRequestSchema>;

export const GetLeadDealSignalsRequestSchema = z.object({
  leadId: z.string().uuid(),
});
export type GetLeadDealSignalsRequest = z.infer<typeof GetLeadDealSignalsRequestSchema>;

export const SyncDealSignalsRequestSchema = z.object({
  source: z.enum(['all', 'calls', 'gmail', 'hubspot_email', 'grain']).default('all'),
});
export type SyncDealSignalsRequest = z.infer<typeof SyncDealSignalsRequestSchema>;

export const GetHubSpotSyncStatusRequestSchema = z.object({});
export type GetHubSpotSyncStatusRequest = z.infer<typeof GetHubSpotSyncStatusRequestSchema>;

export const ReconcileHubSpotRequestSchema = z.object({
  fix: z.boolean().default(false),
});
export type ReconcileHubSpotRequest = z.infer<typeof ReconcileHubSpotRequestSchema>;

export const ConnectGrainRequestSchema = z.object({
  apiToken: z.string().min(10),
});
export type ConnectGrainRequest = z.infer<typeof ConnectGrainRequestSchema>;

// ============================================
// Responses
// ============================================

export type StageTrend = 'speeding_up' | 'slowing_down' | 'steady' | 'no_data';

export interface DealListItem {
  leadId: string;
  name: string;
  company: string | null;
  stageLabel: string | null;
  dealValue: number | null;
}

export interface StageVelocity {
  stageId: string;
  label: string;
  color: string;
  avgDays: number;
  medianDays: number;
  samples: number;
  previousAvgDays: number;
  trend: StageTrend;
  /** Deals sitting in this stage right now, and how long on average. */
  currentDeals: number;
  avgDaysInStageNow: number;
}

export interface StageConversionItem {
  stageId: string;
  label: string;
  color: string;
  entered: number;
  advanced: number;
  lost: number;
  stalled: number;
  conversionRate: number;
}

export interface ReasonCount {
  reason: string;
  label: string;
  count: number;
  value: number;
}

export interface ChannelNextSteps {
  touchpoints: number;
  withNextStep: number;
  secured: number;
}

export interface SignalSourceStatus {
  connected: boolean;
  lastSyncAt: string | null;
  detail?: string | null;
}

export interface DealMetricsResponse {
  range: { startDate: string; endDate: string };
  summary: {
    openDeals: number;
    openPipelineValue: number;
    wonDeals: number;
    lostDeals: number;
    winRate: number;
    wonValue: number;
    avgWonDealSize: number;
    avgSalesCycleDays: number;
    /** first_touch = from the real touch timeline; stage = from pipeline moves. */
    salesCycleBasis: 'first_touch' | 'stage';
    salesVelocityPerDay: number;
  };
  salesProcess: {
    wonWithTouches: number;
    avgFirstTouchToCloseDays: number | null;
    medianFirstTouchToCloseDays: number | null;
    avgTouchesToWin: number | null;
    touchesToWinByKind: { call: number | null; email: number | null; meeting: number | null };
    avgTalkMinutesToWin: number | null;
    medianDaysToFirstMeeting: number | null;
    medianBuyerReplyHours: number | null;
    medianRepReplyHours: number | null;
    typicalGapDays: number | null;
    quietDeals: Array<DealListItem & { daysSilent: number; lastTouchAt: string; touches: number }>;
    /** Touches recorded in the period, by kind. */
    touchesInPeriod: { call: number; email: number; meeting: number };
  };
  velocity: StageVelocity[];
  conversion: StageConversionItem[];
  dealSize: {
    avgWon: number;
    medianWon: number;
    avgLost: number;
    avgOpen: number;
    /** Won deals with both a first quote and a final value. */
    comparableWonDeals: number;
    avgInitialQuote: number;
    avgValueDriftPct: number;
    closedBelowQuote: number;
    closedAboveQuote: number;
    /** Sum of (first quote − final value) over won deals that closed below quote. */
    discountGiven: number;
    lostPipelineValue: number;
  };
  nextSteps: {
    touchpoints: number;
    withNextStep: number;
    secured: number;
    securedRate: number;
    avgScore: number;
    byChannel: Record<'call' | 'email' | 'meeting', ChannelNextSteps>;
    openDealsWithoutSecuredNextStep: Array<
      DealListItem & { lastTouchAt: string | null; lastNextStep: string | null }
    >;
  };
  champions: {
    dealsScored: number;
    withChampion: number;
    avgChampionScore: number;
    avgEngagementScore: number;
    strong: Array<DealListItem & { championName: string | null; championScore: number }>;
    atRisk: Array<DealListItem & { championScore: number | null; engagementScore: number | null }>;
  };
  winLoss: {
    won: number;
    lost: number;
    winRate: number;
    lossReasons: ReasonCount[];
    winReasons: ReasonCount[];
    missingReason: number;
    avgCycleWonDays: number;
    avgCycleLostDays: number;
    avgTalkTimeWonSeconds: number;
    avgTalkTimeLostSeconds: number;
    recent: Array<
      DealListItem & {
        outcome: DealOutcome;
        reason: string | null;
        closedAt: string | null;
      }
    >;
  };
  activity: {
    totalTalkTimeSeconds: number;
    connectedCalls: number;
    talkTimePerWonDealSeconds: number;
    coachedCalls: number;
    avgCoachingScore: number;
    callsScored: number;
    avgCallQuality: number;
    meetingsScored: number;
    avgMeetingQuality: number;
    emailThreadsScored: number;
  };
  sources: {
    calls: SignalSourceStatus;
    gmail: SignalSourceStatus;
    grain: SignalSourceStatus;
    hubspot: SignalSourceStatus;
  };
}

export type DealSignal = Omit<DBDealSignal, 'evidence'> & {
  evidence: { nextStep?: string | null; champion?: string | null; risks?: string[] };
};

export interface SetDealOutcomeResponse {
  leadId: string;
  outcome: DealOutcome;
  movedToStageId: string | null;
  crmSync: 'synced' | 'failed' | 'not_connected';
}

// ============================================
// HubSpot sync health
// ============================================

export interface HubSpotSyncEvent {
  id: string;
  leadId: string | null;
  direction: 'push' | 'pull' | 'reconcile';
  objectType: string;
  status: 'applied' | 'skipped' | 'conflict' | 'failed';
  changes: Record<string, unknown>;
  message: string | null;
  createdAt: string;
}

export interface HubSpotSyncStatus {
  portalId: string | null;
  tokenError: string | null;
  missingRequiredScopes: string[];
  missingOptionalScopes: Array<{ scope: string; purpose: string }>;
  config: {
    autoSync: boolean;
    autoReconcile: boolean;
    pipelineId?: string;
    stageProperty: string;
    customPropertiesReady: boolean;
    writeBacks: { calls: boolean; tasks: boolean; properties: boolean; emails: boolean };
  };
  stageMapping: Array<{ omnidialStage: string; hubspotStage: string | null }>;
  webhook: { url: string; echoSuppression: boolean };
  linkedLeads: number;
  failedLinks: number;
  unlinkedPipelineLeads: number;
  last24h: Array<{ direction: string; status: string; count: number }>;
  recentEvents: HubSpotSyncEvent[];
}

export interface HubSpotDriftItem {
  leadId: string;
  object: 'contact' | 'deal';
  field: string;
  omnidial: unknown;
  hubspot: unknown;
  winner: 'omnidial' | 'hubspot';
}

export interface HubSpotReconcileReport {
  checked: number;
  inSync: number;
  drifted: number;
  fixed: number;
  missingInHubSpot: string[];
  unlinkedPipelineLeads: number;
  pushedUnlinked: number;
  orphanDeals: { count: number; sample: Array<{ id: string; name: string | null }> };
  drift: HubSpotDriftItem[];
  errors: string[];
}

import { z } from 'zod';
import { Notification } from './requests';
import type {
  ActiveRepStatus,
  BlitzResponse,
  SalesFloorLeaderboardEntry,
  ManagerListenMode,
} from './requests/salesFloor';
import type { CoachCardResponse, TranscriptSegmentResponse } from './requests/liveCoach';
import type { ParallelDialAttemptResponse } from './requests/parallelDialer';

// ============================================
// Auth Request
// ============================================

export const PusherAuthRequestSchema = z.object({
  socket_id: z.string().min(1),
  channel_name: z.string().min(1),
});

export type PusherAuthRequest = z.infer<typeof PusherAuthRequestSchema>;

// ============================================
// Channels
// ============================================

// Existing channels
export const privateUserChannelPrefix = 'private-user-';
export type PrivateUserChannel = `${typeof privateUserChannelPrefix}${string}`;

// Sales Floor channels
export const presenceOrgChannelPrefix = 'presence-org-';
export type PresenceOrgChannel = `${typeof presenceOrgChannelPrefix}${string}`;

// Call-specific channels for live coaching
export const privateCallChannelPrefix = 'private-call-';
export type PrivateCallChannel = `${typeof privateCallChannelPrefix}${string}`;

// Blitz channels
export const privateBlitzChannelPrefix = 'private-blitz-';
export type PrivateBlitzChannel = `${typeof privateBlitzChannelPrefix}${string}`;

export const channels = {
  privateUser: (userId: string): PrivateUserChannel => `${privateUserChannelPrefix}${userId}`,
  presenceOrg: (orgId: string): PresenceOrgChannel => `${presenceOrgChannelPrefix}${orgId}`,
  privateCall: (callId: string): PrivateCallChannel => `${privateCallChannelPrefix}${callId}`,
  privateBlitz: (blitzId: string): PrivateBlitzChannel => `${privateBlitzChannelPrefix}${blitzId}`,
} as const;

// ============================================
// Events
// ============================================

export const PUSHER_EVENTS = {
  // Existing
  NOTIFICATION: 'notification',

  // Sales Floor Events
  SESSION_STARTED: 'session_started',
  SESSION_ENDED: 'session_ended',
  SESSION_UPDATED: 'session_updated',
  CALL_STARTED: 'call_started',
  CALL_ANSWERED: 'call_answered',
  CALL_ENDED: 'call_ended',
  LEADERBOARD_UPDATE: 'leaderboard_update',
  REP_STATUS_UPDATE: 'rep_status_update',

  // Blitz Events
  BLITZ_STARTED: 'blitz_started',
  BLITZ_ENDED: 'blitz_ended',
  BLITZ_UPDATE: 'blitz_update',
  BLITZ_PARTICIPANT_JOINED: 'blitz_participant_joined',
  BLITZ_LEADERBOARD_UPDATE: 'blitz_leaderboard_update',

  // Manager Listen Events
  MANAGER_JOINED: 'manager_joined',
  MANAGER_LEFT: 'manager_left',
  MANAGER_MODE_CHANGED: 'manager_mode_changed',

  // Live Coaching Events
  TRANSCRIPT_UPDATE: 'transcript_update',
  COACH_CARD_TRIGGERED: 'coach_card_triggered',

  // Parallel Dialer Events
  PARALLEL_DIAL_STARTED: 'parallel_dial_started',
  PARALLEL_DIAL_ATTEMPT_UPDATE: 'parallel_dial_attempt_update',
  PARALLEL_DIAL_CONNECTED: 'parallel_dial_connected',
  PARALLEL_DIAL_ENDED: 'parallel_dial_ended',
} as const;

export type PusherEvent = typeof PUSHER_EVENTS[keyof typeof PUSHER_EVENTS];

// ============================================
// Event Payloads
// ============================================

// Sales Floor Event Payloads
export interface SessionStartedEvent {
  userId: string;
  userName: string;
  sessionId: string;
  campaignId: string | null;
  campaignName: string | null;
}

export interface SessionEndedEvent {
  userId: string;
  sessionId: string;
  callsThisSession: number;
  connectedThisSession: number;
}

export interface SessionUpdatedEvent {
  userId: string;
  sessionId: string;
  status: string;
  currentCallId: string | null;
  currentLeadId: string | null;
  currentLeadName: string | null;
}

export interface CallStartedEvent {
  userId: string;
  callId: string;
  leadId: string | null;
  leadName: string | null;
}

export interface CallAnsweredEvent {
  userId: string;
  callId: string;
  leadId: string | null;
  leadName: string | null;
}

export interface CallEndedEvent {
  userId: string;
  callId: string;
  duration: number;
  disposition: string | null;
}

export interface LeaderboardUpdateEvent {
  period: string;
  entries: SalesFloorLeaderboardEntry[];
}

export interface RepStatusUpdateEvent {
  rep: ActiveRepStatus;
}

// Blitz Event Payloads
export interface BlitzStartedEvent {
  blitz: BlitzResponse;
}

export interface BlitzEndedEvent {
  blitzId: string;
  winner: { userId: string; userName: string; score: number } | null;
}

export interface BlitzUpdateEvent {
  blitzId: string;
  totalCalls: number;
  totalConnects: number;
  totalMeetings: number;
  goalProgress: number | null;
}

export interface BlitzParticipantJoinedEvent {
  blitzId: string;
  userId: string;
  userName: string;
}

export interface BlitzLeaderboardUpdateEvent {
  blitzId: string;
  leaderboard: Array<{
    rank: number;
    userId: string;
    userName: string;
    score: number;
  }>;
}

// Manager Listen Event Payloads
export interface ManagerJoinedEvent {
  callId: string;
  managerId: string;
  managerName: string;
  mode: ManagerListenMode;
}

export interface ManagerLeftEvent {
  callId: string;
  managerId: string;
}

export interface ManagerModeChangedEvent {
  callId: string;
  managerId: string;
  managerName: string;
  mode: ManagerListenMode;
}

// Live Coaching Event Payloads
export interface TranscriptUpdateEvent {
  callId: string;
  segment: TranscriptSegmentResponse;
}

export interface CoachCardTriggeredEvent {
  callId: string;
  userId: string;
  triggerId: string;
  card: CoachCardResponse;
  triggerPhrase: string;
  confidence: number | null;
}

// Parallel Dialer Event Payloads
export interface ParallelDialStartedEvent {
  sessionId: string;
  userId: string;
  lineCount: number;
  conferenceId: string;
}

export interface ParallelDialAttemptUpdateEvent {
  sessionId: string;
  attempt: ParallelDialAttemptResponse;
}

export interface ParallelDialConnectedEvent {
  sessionId: string;
  attempt: ParallelDialAttemptResponse;
  abandonedAttempts: ParallelDialAttemptResponse[];
}

export interface ParallelDialEndedEvent {
  sessionId: string;
  totalAttempts: number;
  totalConnects: number;
  totalAbandoned: number;
}

// ============================================
// Event Map
// ============================================

export interface PusherEventMap {
  [PUSHER_EVENTS.NOTIFICATION]: Notification;
  // Sales Floor
  [PUSHER_EVENTS.SESSION_STARTED]: SessionStartedEvent;
  [PUSHER_EVENTS.SESSION_ENDED]: SessionEndedEvent;
  [PUSHER_EVENTS.SESSION_UPDATED]: SessionUpdatedEvent;
  [PUSHER_EVENTS.CALL_STARTED]: CallStartedEvent;
  [PUSHER_EVENTS.CALL_ANSWERED]: CallAnsweredEvent;
  [PUSHER_EVENTS.CALL_ENDED]: CallEndedEvent;
  [PUSHER_EVENTS.LEADERBOARD_UPDATE]: LeaderboardUpdateEvent;
  [PUSHER_EVENTS.REP_STATUS_UPDATE]: RepStatusUpdateEvent;
  // Blitz
  [PUSHER_EVENTS.BLITZ_STARTED]: BlitzStartedEvent;
  [PUSHER_EVENTS.BLITZ_ENDED]: BlitzEndedEvent;
  [PUSHER_EVENTS.BLITZ_UPDATE]: BlitzUpdateEvent;
  [PUSHER_EVENTS.BLITZ_PARTICIPANT_JOINED]: BlitzParticipantJoinedEvent;
  [PUSHER_EVENTS.BLITZ_LEADERBOARD_UPDATE]: BlitzLeaderboardUpdateEvent;
  // Manager Listen
  [PUSHER_EVENTS.MANAGER_JOINED]: ManagerJoinedEvent;
  [PUSHER_EVENTS.MANAGER_LEFT]: ManagerLeftEvent;
  [PUSHER_EVENTS.MANAGER_MODE_CHANGED]: ManagerModeChangedEvent;
  // Live Coaching
  [PUSHER_EVENTS.TRANSCRIPT_UPDATE]: TranscriptUpdateEvent;
  [PUSHER_EVENTS.COACH_CARD_TRIGGERED]: CoachCardTriggeredEvent;
  // Parallel Dialer
  [PUSHER_EVENTS.PARALLEL_DIAL_STARTED]: ParallelDialStartedEvent;
  [PUSHER_EVENTS.PARALLEL_DIAL_ATTEMPT_UPDATE]: ParallelDialAttemptUpdateEvent;
  [PUSHER_EVENTS.PARALLEL_DIAL_CONNECTED]: ParallelDialConnectedEvent;
  [PUSHER_EVENTS.PARALLEL_DIAL_ENDED]: ParallelDialEndedEvent;
}

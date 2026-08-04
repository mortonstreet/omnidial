import { z } from 'zod';

// === Coach Card Types ===

export const CoachCardCategory = z.enum([
  'objection',
  'question',
  'closing',
  'discovery',
  'general',
]);
export type CoachCardCategory = z.infer<typeof CoachCardCategory>;

export const CreateCoachCardRequestSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(100),
  category: CoachCardCategory.optional().default('general'),
  triggerPhrases: z.array(z.string().min(1).max(100)).min(1).max(20),
  content: z.string().min(1).max(5000), // Markdown content
  tips: z.array(z.string().min(1).max(255)).max(10).optional().default([]),
  sortOrder: z.number().int().optional().default(0),
});
export type CreateCoachCardRequest = z.infer<typeof CreateCoachCardRequestSchema>;

export const UpdateCoachCardRequestSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(100).optional(),
  category: CoachCardCategory.optional(),
  triggerPhrases: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  content: z.string().min(1).max(5000).optional(),
  tips: z.array(z.string().min(1).max(255)).max(10).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type UpdateCoachCardRequest = z.infer<typeof UpdateCoachCardRequestSchema>;

export const DeleteCoachCardRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteCoachCardRequest = z.infer<typeof DeleteCoachCardRequestSchema>;

export const GetCoachCardRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetCoachCardRequest = z.infer<typeof GetCoachCardRequestSchema>;

export const ListCoachCardsRequestSchema = z.object({
  organizationId: z.string().min(1),
  category: CoachCardCategory.optional(),
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});
export type ListCoachCardsRequest = z.infer<typeof ListCoachCardsRequestSchema>;

// === Live Transcription Types ===

export const StartTranscriptionRequestSchema = z.object({
  callId: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type StartTranscriptionRequest = z.infer<typeof StartTranscriptionRequestSchema>;

export const StopTranscriptionRequestSchema = z.object({
  callId: z.string().uuid(),
});
export type StopTranscriptionRequest = z.infer<typeof StopTranscriptionRequestSchema>;

export const GetLiveTranscriptRequestSchema = z.object({
  callId: z.string().uuid(),
  afterMs: z.coerce.number().optional().default(0), // Get segments after this time
});
export type GetLiveTranscriptRequest = z.infer<typeof GetLiveTranscriptRequestSchema>;

// === Coach Card Trigger Feedback ===

export const SubmitTriggerFeedbackRequestSchema = z.object({
  triggerId: z.string().uuid(),
  wasHelpful: z.boolean(),
});
export type SubmitTriggerFeedbackRequest = z.infer<typeof SubmitTriggerFeedbackRequestSchema>;

export const GetTriggerStatsRequestSchema = z.object({
  organizationId: z.string().min(1),
  coachCardId: z.string().uuid().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type GetTriggerStatsRequest = z.infer<typeof GetTriggerStatsRequestSchema>;

// === Response Types ===

export interface CoachCardResponse {
  id: string;
  organizationId: string;
  title: string;
  category: CoachCardCategory;
  triggerPhrases: string[];
  content: string;
  tips: string[];
  isActive: boolean;
  sortOrder: number;
  createdById: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  // Stats
  triggerCount?: number;
  helpfulCount?: number;
}

export interface CoachCardListResponse {
  data: CoachCardResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface TranscriptSegmentResponse {
  id: string;
  callId: string;
  speaker: 'rep' | 'prospect' | 'unknown';
  text: string;
  confidence: number | null;
  startMs: number;
  endMs: number;
  isFinal: boolean;
  createdAt: string;
}

export interface LiveTranscriptResponse {
  callId: string;
  segments: TranscriptSegmentResponse[];
  totalDurationMs: number;
  isTranscribing: boolean;
}

export interface CoachCardTriggerResponse {
  id: string;
  coachCardId: string;
  coachCardTitle: string;
  callId: string;
  userId: string;
  triggerPhrase: string;
  confidence: number | null;
  wasHelpful: boolean | null;
  triggeredAt: string;
}

export interface TriggerStatsResponse {
  organizationId: string;
  totalTriggers: number;
  helpfulCount: number;
  notHelpfulCount: number;
  pendingFeedbackCount: number;
  helpfulRate: number | null;
  topTriggerPhrases: Array<{ phrase: string; count: number }>;
  triggersByCard: Array<{
    cardId: string;
    cardTitle: string;
    count: number;
    helpfulRate: number | null;
  }>;
}

// Real-time events for live coaching
export interface LiveCoachCardEvent {
  type: 'coach_card_triggered';
  callId: string;
  userId: string;
  triggerId: string;
  card: CoachCardResponse;
  triggerPhrase: string;
  confidence: number | null;
}

export interface LiveTranscriptUpdateEvent {
  type: 'transcript_update';
  callId: string;
  segment: TranscriptSegmentResponse;
}

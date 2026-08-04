import { z } from 'zod';

// === Predictive Scoring Types ===

export const PhoneType = z.enum(['mobile', 'landline', 'voip', 'unknown']);
export type PhoneType = z.infer<typeof PhoneType>;

export const CalculatePredictiveScoresRequestSchema = z.object({
  organizationId: z.string().min(1),
  listId: z.string().uuid(),
});
export type CalculatePredictiveScoresRequest = z.infer<typeof CalculatePredictiveScoresRequestSchema>;

export const ReorderByCampaignScoreRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid(),
});
export type ReorderByCampaignScoreRequest = z.infer<typeof ReorderByCampaignScoreRequestSchema>;

export const GetLeadScoreRequestSchema = z.object({
  leadId: z.string().uuid(),
});
export type GetLeadScoreRequest = z.infer<typeof GetLeadScoreRequestSchema>;

export const GetCallAnswerPatternsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetCallAnswerPatternsRequest = z.infer<typeof GetCallAnswerPatternsRequestSchema>;

export const DetectPhoneTypeRequestSchema = z.object({
  phoneNumber: z.string().min(1),
});
export type DetectPhoneTypeRequest = z.infer<typeof DetectPhoneTypeRequestSchema>;

// === Response Types ===

export interface LeadPredictiveScoreResponse {
  id: string;
  organizationId: string;
  leadId: string;
  leadName: string | null;
  leadPhone: string | null;
  score: number; // 0-1
  phoneType: PhoneType | null;
  bestDayOfWeek: number | null; // 0-6 (Sunday-Saturday)
  bestHourOfDay: number | null; // 0-23
  totalAttempts: number;
  totalAnswers: number;
  answerRate: number | null; // Calculated answer rate
  lastAttemptAt: string | null;
  lastAnswerAt: string | null;
  calculatedAt: string;
}

export interface CallAnswerPatternResponse {
  dayOfWeek: number;
  dayName: string; // "Sunday", "Monday", etc.
  hourOfDay: number;
  attempts: number;
  answers: number;
  answerRate: number;
}

export interface CallAnswerPatternsResponse {
  organizationId: string;
  patterns: CallAnswerPatternResponse[];
  // Aggregated stats
  bestDay: { dayOfWeek: number; dayName: string; answerRate: number } | null;
  bestHour: { hourOfDay: number; answerRate: number } | null;
  overallAnswerRate: number;
}

export interface CalculateScoresResponse {
  listId: string;
  leadsProcessed: number;
  avgScore: number;
  highScoreCount: number; // Leads with score > 0.7
  lowScoreCount: number; // Leads with score < 0.3
}

export interface ReorderResponse {
  campaignId: string;
  listId: string;
  leadsReordered: number;
}

export interface PhoneTypeDetectionResponse {
  phoneNumber: string;
  phoneType: PhoneType;
  carrier: string | null;
  mobileCountryCode: string | null;
  mobileNetworkCode: string | null;
}

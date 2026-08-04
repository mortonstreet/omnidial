import { z } from 'zod'

// Coaching Eligibility Response
export interface CoachingEligibilityResponse {
  data: {
    eligible: boolean
    reason?: string
  }
}

// Coaching Feedback Category
export interface CoachingFeedbackCategory {
  score: number
  comment: string
}

// Coaching Feedback Structure
export interface CoachingFeedback {
  opening?: CoachingFeedbackCategory
  discovery?: CoachingFeedbackCategory
  objectionHandling?: CoachingFeedbackCategory
  valueProposition?: CoachingFeedbackCategory
  callControl?: CoachingFeedbackCategory
  closing?: CoachingFeedbackCategory
  toneAndEnergy?: CoachingFeedbackCategory
  talkListenRatio?: CoachingFeedbackCategory
}

// Coaching Record
export interface Coaching {
  id: string
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  overallScore: number
  unhingedQuote: string | null
  strengths: string[]
  improvements: string[]
  feedback: CoachingFeedback
  modelUsed: string
  tokensUsed: number
  analysisTimeMs: number
  createdAt: string
  updatedAt: string
  // Lead info (joined from call -> lead)
  leadId?: string | null
  leadFirstName?: string | null
  leadLastName?: string | null
  leadCompany?: string | null
}

// Transcript Record
export interface Transcript {
  id: string
  callId: string
  organizationId: string
  transcriptText: string
  transcriptSource: string
  speakerLabels: unknown[]
  durationSeconds: number
  language: string
  createdAt: string
  updatedAt: string
}

// Coaching Result (coaching + transcript)
export interface CoachingResult {
  coaching: Coaching
  transcript: Transcript
}

// Get Coaching Response
export interface GetCoachingResponse {
  data: CoachingResult
}

// Generate Coaching Response
export interface GenerateCoachingResponse {
  data: CoachingResult
}

// User Coaching History Response
export interface UserCoachingHistoryResponse {
  data: Coaching[]
}

// Recent Coaching Response
export interface RecentCoachingResponse {
  data: Coaching[]
}

// Coaching Stats
export interface CoachingStats {
  totalCoached: number
  averageScore: number
  scoreDistribution: Record<string, number>
}

// Coaching Stats Response
export interface CoachingStatsResponse {
  data: CoachingStats
}

// Query Schemas
export const CoachingHistoryQuerySchema = z.object({
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
})

export const RecentCoachingQuerySchema = z.object({
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
})

export const CoachingStatsQuerySchema = z.object({
  userId: z.string().optional(),
})

export const UncoachedCallsQuerySchema = z.object({
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
})

export type CoachingHistoryQuery = z.infer<typeof CoachingHistoryQuerySchema>
export type RecentCoachingQuery = z.infer<typeof RecentCoachingQuerySchema>
export type CoachingStatsQuery = z.infer<typeof CoachingStatsQuerySchema>
export type UncoachedCallsQuery = z.infer<typeof UncoachedCallsQuerySchema>

// Uncoached Eligible Call
export interface UncoachedCall {
  id: string
  leadId: string | null
  leadName: string | null
  leadCompany: string | null
  phoneNumber: string
  duration: number
  direction: string
  recordingUrl: string
  createdAt: string
  userId: string
  userName: string | null
}

// Uncoached Calls Response
export interface UncoachedCallsResponse {
  data: UncoachedCall[]
}

// Lead Coaching Query Schema
export const LeadCoachingQuerySchema = z.object({
  limit: z.coerce.number().optional().default(20),
  offset: z.coerce.number().optional().default(0),
  minScore: z.coerce.number().optional(),
  maxScore: z.coerce.number().optional(),
})

export type LeadCoachingQuery = z.infer<typeof LeadCoachingQuerySchema>

// Lead Coaching Response
export interface LeadCoachingResponse {
  data: Coaching[]
}

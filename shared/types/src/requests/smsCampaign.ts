import { z } from 'zod'
import { PaginationRequestSchema } from './pagination'

// ============================================
// Enums and Base Schemas
// ============================================

export const SmsCampaignStatusSchema = z.enum([
  'draft',
  'active',
  'paused',
  'completed',
])
export type SmsCampaignStatus = z.infer<typeof SmsCampaignStatusSchema>

export const SmsCampaignEnrollmentStatusSchema = z.enum([
  'active',
  'paused',
  'completed',
  'replied',
  'unsubscribed',
  'failed',
])
export type SmsCampaignEnrollmentStatus = z.infer<
  typeof SmsCampaignEnrollmentStatusSchema
>

export const SmsCampaignMessageStatusSchema = z.enum([
  'queued',
  'sending',
  'sent',
  'delivered',
  'failed',
  'undelivered',
])
export type SmsCampaignMessageStatus = z.infer<
  typeof SmsCampaignMessageStatusSchema
>

// Time format HH:MM
const TimeStringSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, {
  message: 'Time must be in HH:MM format (e.g., 09:00)',
})

// Days of week (0=Sunday, 1=Monday, etc.)
const SendDaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)

// ============================================
// Campaign CRUD
// ============================================

// List campaigns
export const ListSmsCampaignsRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().min(1),
  status: SmsCampaignStatusSchema.optional(),
  search: z.string().optional(),
})
export type ListSmsCampaignsRequest = z.infer<
  typeof ListSmsCampaignsRequestSchema
>

// Get campaign by ID
export const GetSmsCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type GetSmsCampaignRequest = z.infer<typeof GetSmsCampaignRequestSchema>

// Create campaign
export const CreateSmsCampaignRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  sendWindowStart: TimeStringSchema.optional().default('09:00'),
  sendWindowEnd: TimeStringSchema.optional().default('18:00'),
  sendDays: SendDaysSchema.optional().default([1, 2, 3, 4, 5]),
  defaultTimezone: z.string().optional().default('America/New_York'),
  aiEnabled: z.boolean().optional().default(false),
  aiModel: z.string().optional(),
  aiSystemPrompt: z.string().optional(),
  valueProposition: z.string().optional(),
  dailySendLimit: z.number().int().min(1).max(10000).optional().default(100),
})
export type CreateSmsCampaignRequest = z.infer<
  typeof CreateSmsCampaignRequestSchema
>

// Update campaign
export const UpdateSmsCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  sendWindowStart: TimeStringSchema.optional(),
  sendWindowEnd: TimeStringSchema.optional(),
  sendDays: SendDaysSchema.optional(),
  defaultTimezone: z.string().optional(),
  aiEnabled: z.boolean().optional(),
  aiModel: z.string().nullable().optional(),
  aiSystemPrompt: z.string().nullable().optional(),
  valueProposition: z.string().nullable().optional(),
  dailySendLimit: z.number().int().min(1).max(10000).optional(),
})
export type UpdateSmsCampaignRequest = z.infer<
  typeof UpdateSmsCampaignRequestSchema
>

// Delete campaign
export const DeleteSmsCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type DeleteSmsCampaignRequest = z.infer<
  typeof DeleteSmsCampaignRequestSchema
>

// ============================================
// Campaign Actions
// ============================================

// Activate campaign
export const ActivateSmsCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type ActivateSmsCampaignRequest = z.infer<
  typeof ActivateSmsCampaignRequestSchema
>

// Pause campaign
export const PauseSmsCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type PauseSmsCampaignRequest = z.infer<
  typeof PauseSmsCampaignRequestSchema
>

// ============================================
// Campaign Steps
// ============================================

// Add step
export const AddSmsCampaignStepRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  organizationId: z.string().min(1),
  stepNumber: z.number().int().min(1),
  dayOffset: z.number().int().min(0),
  messageTemplate: z.string().min(1).max(1600), // SMS max length
  aiEnabled: z.boolean().nullable().optional(), // null = inherit from campaign
  aiPromptOverride: z.string().nullable().optional(),
  skipIfReplied: z.boolean().optional().default(true),
})
export type AddSmsCampaignStepRequest = z.infer<
  typeof AddSmsCampaignStepRequestSchema
>

// Update step
export const UpdateSmsCampaignStepRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  stepId: z.string().uuid(),
  organizationId: z.string().min(1),
  stepNumber: z.number().int().min(1).optional(),
  dayOffset: z.number().int().min(0).optional(),
  messageTemplate: z.string().min(1).max(1600).optional(),
  aiEnabled: z.boolean().nullable().optional(),
  aiPromptOverride: z.string().nullable().optional(),
  skipIfReplied: z.boolean().optional(),
})
export type UpdateSmsCampaignStepRequest = z.infer<
  typeof UpdateSmsCampaignStepRequestSchema
>

// Delete step
export const DeleteSmsCampaignStepRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  stepId: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type DeleteSmsCampaignStepRequest = z.infer<
  typeof DeleteSmsCampaignStepRequestSchema
>

// ============================================
// Campaign Lists
// ============================================

// Attach list
export const AttachSmsCampaignListRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  organizationId: z.string().min(1),
  listId: z.string().uuid(),
})
export type AttachSmsCampaignListRequest = z.infer<
  typeof AttachSmsCampaignListRequestSchema
>

// Detach list
export const DetachSmsCampaignListRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  listId: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type DetachSmsCampaignListRequest = z.infer<
  typeof DetachSmsCampaignListRequestSchema
>

// ============================================
// Enrollments
// ============================================

// List enrollments
export const ListSmsCampaignEnrollmentsRequestSchema =
  PaginationRequestSchema.extend({
    id: z.string().uuid(), // campaign ID
    organizationId: z.string().min(1),
    status: SmsCampaignEnrollmentStatusSchema.optional(),
  })
export type ListSmsCampaignEnrollmentsRequest = z.infer<
  typeof ListSmsCampaignEnrollmentsRequestSchema
>

// Enroll specific leads
export const EnrollLeadsRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1).max(1000),
})
export type EnrollLeadsRequest = z.infer<typeof EnrollLeadsRequestSchema>

// Enroll from list
export const EnrollFromListRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  organizationId: z.string().min(1),
  listId: z.string().uuid(),
})
export type EnrollFromListRequest = z.infer<typeof EnrollFromListRequestSchema>

// Unenroll
export const UnenrollLeadRequestSchema = z.object({
  id: z.string().uuid(), // campaign ID
  enrollmentId: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type UnenrollLeadRequest = z.infer<typeof UnenrollLeadRequestSchema>

// ============================================
// Stats
// ============================================

export const GetSmsCampaignStatsRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
})
export type GetSmsCampaignStatsRequest = z.infer<
  typeof GetSmsCampaignStatsRequestSchema
>

// ============================================
// Response Types
// ============================================

export interface SmsCampaignStepResponse {
  id: string
  campaignId: string
  stepNumber: number
  dayOffset: number
  messageTemplate: string
  aiEnabled: boolean | null
  aiPromptOverride: string | null
  skipIfReplied: boolean
  totalSent: number
  totalDelivered: number
  totalFailed: number
  createdAt: string
  updatedAt: string
}

export interface SmsCampaignResponse {
  id: string
  organizationId: string
  name: string
  description: string | null
  status: SmsCampaignStatus
  sendWindowStart: string
  sendWindowEnd: string
  sendDays: number[]
  defaultTimezone: string
  aiEnabled: boolean
  aiModel: string | null
  aiSystemPrompt: string | null
  valueProposition: string | null
  dailySendLimit: number
  totalEnrolled: number
  totalSent: number
  totalDelivered: number
  totalReplied: number
  totalUnsubscribed: number
  createdById: string
  activatedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  steps?: SmsCampaignStepResponse[]
}

export interface SmsCampaignListResponse {
  data: SmsCampaignResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface SmsCampaignEnrollmentResponse {
  id: string
  campaignId: string
  leadId: string
  status: SmsCampaignEnrollmentStatus
  currentStep: number
  nextSendAt: string | null
  timezone: string | null
  lastSentAt: string | null
  repliedAt: string | null
  unsubscribedAt: string | null
  enrolledAt: string
  completedAt: string | null
  lead?: {
    id: string
    firstName: string | null
    lastName: string | null
    phone: string | null
    company: string | null
  }
}

export interface SmsCampaignEnrollmentListResponse {
  data: SmsCampaignEnrollmentResponse[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
}

export interface SmsCampaignStatsResponse {
  campaignId: string
  totalEnrolled: number
  totalSent: number
  totalDelivered: number
  totalReplied: number
  totalUnsubscribed: number
  deliveryRate: number // delivered / sent
  replyRate: number // replied / delivered
  unsubscribeRate: number // unsubscribed / delivered
  stepStats: Array<{
    stepNumber: number
    dayOffset: number
    totalSent: number
    totalDelivered: number
    totalFailed: number
    deliveryRate: number
  }>
  enrollmentsByStatus: Record<SmsCampaignEnrollmentStatus, number>
}

export interface EnrollLeadsResponse {
  enrolled: number
  skipped: number // Already enrolled or no phone
  errors: Array<{
    leadId: string
    reason: string
  }>
}

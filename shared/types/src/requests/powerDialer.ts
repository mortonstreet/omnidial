import { z } from 'zod';

export const PowerDialerTimezonePrioritySchema = z.enum([
  'eastern',
  'central',
  'mountain',
  'pacific',
]);
export type PowerDialerTimezonePriority = z.infer<
  typeof PowerDialerTimezonePrioritySchema
>;

// Get power dialer progress
export const GetPowerDialerProgressRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  timezonePriority: PowerDialerTimezonePrioritySchema.optional(),
});
export type GetPowerDialerProgressRequest = z.infer<typeof GetPowerDialerProgressRequestSchema>;

// Update power dialer progress
export const UpdatePowerDialerProgressRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  currentIndex: z.number().int().min(0).optional(),
  dialedCount: z.number().int().min(0).optional(),
  isPaused: z.boolean().optional(),
});
export type UpdatePowerDialerProgressRequest = z.infer<typeof UpdatePowerDialerProgressRequestSchema>;

// Get next lead in power dialer
export const GetNextLeadRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  timezonePriority: PowerDialerTimezonePrioritySchema.optional(),
});
export type GetNextLeadRequest = z.infer<typeof GetNextLeadRequestSchema>;

// Get a paged window of leads in the current power dialer queue order
export const GetPowerDialerQueueRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  timezonePriority: PowerDialerTimezonePrioritySchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type GetPowerDialerQueueRequest = z.infer<typeof GetPowerDialerQueueRequestSchema>;

// Jump directly to a lead's position in the current queue order
export const JumpToPowerDialerLeadRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  timezonePriority: PowerDialerTimezonePrioritySchema.optional(),
  currentIndex: z.number().int().min(0),
});
export type JumpToPowerDialerLeadRequest = z.infer<typeof JumpToPowerDialerLeadRequestSchema>;

// Skip current lead
export const SkipLeadRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  timezonePriority: PowerDialerTimezonePrioritySchema.optional(),
});
export type SkipLeadRequest = z.infer<typeof SkipLeadRequestSchema>;

// Start power dialer session
export const StartPowerDialerRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
  timezonePriority: PowerDialerTimezonePrioritySchema.optional(),
  delaySeconds: z.number().int().min(0).max(30).default(5),
});
export type StartPowerDialerRequest = z.infer<typeof StartPowerDialerRequestSchema>;

// Stop power dialer session
export const StopPowerDialerRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
});
export type StopPowerDialerRequest = z.infer<typeof StopPowerDialerRequestSchema>;

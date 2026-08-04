import { z } from 'zod';

// Get power dialer progress
export const GetPowerDialerProgressRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
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
});
export type GetNextLeadRequest = z.infer<typeof GetNextLeadRequestSchema>;

// Skip current lead
export const SkipLeadRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
});
export type SkipLeadRequest = z.infer<typeof SkipLeadRequestSchema>;

// Start power dialer session
export const StartPowerDialerRequestSchema = z.object({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid(),
  listId: z.string().uuid().optional(),
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

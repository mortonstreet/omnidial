import { z } from 'zod';

// Schedule Event Types
export const ScheduleEventTypeEnum = z.enum(['callback', 'meeting', 'demo']);
export type ScheduleEventType = z.infer<typeof ScheduleEventTypeEnum>;

// Get Schedule Request
export const GetScheduleRequestSchema = z.object({
  organizationId: z.string().min(1),
  startDate: z.string(),
  endDate: z.string(),
  userId: z.string().min(1).optional(),
});
export type GetScheduleRequest = z.infer<typeof GetScheduleRequestSchema>;

// Create Schedule Event Request
export const CreateScheduleEventRequestSchema = z.object({
  type: ScheduleEventTypeEnum,
  title: z.string().min(1).max(255),
  leadId: z.string().uuid().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateScheduleEventRequest = z.infer<typeof CreateScheduleEventRequestSchema>;

// Update Schedule Event Request
export const UpdateScheduleEventRequestSchema = z.object({
  id: z.string().uuid(),
  type: ScheduleEventTypeEnum.optional(),
  title: z.string().min(1).max(255).optional(),
  leadId: z.string().uuid().optional().nullable(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});
export type UpdateScheduleEventRequest = z.infer<typeof UpdateScheduleEventRequestSchema>;

// Delete Schedule Event Request
export const DeleteScheduleEventRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteScheduleEventRequest = z.infer<typeof DeleteScheduleEventRequestSchema>;

// Schedule Event Response
export interface ScheduleEventResponse {
  id: string;
  type: ScheduleEventType;
  title: string;
  leadId?: string;
  leadName?: string;
  startTime: string;
  endTime?: string;
  notes?: string;
}

// Get Schedule Response
export interface GetScheduleResponse {
  events: ScheduleEventResponse[];
}

import { z } from 'zod';

// Activity Types
export const ActivityTypeEnum = z.enum([
  'call',
  'lead_added',
  'lead_updated',
  'task_completed',
  'campaign_created',
]);
export type ActivityType = z.infer<typeof ActivityTypeEnum>;

// Filter categories (frontend-friendly grouped types)
export const ActivityFilterCategoryEnum = z.enum([
  'all',
  'calls',
  'leads',
  'tasks',
]);
export type ActivityFilterCategory = z.infer<typeof ActivityFilterCategoryEnum>;

// Get Activity Request
export const GetActivityRequestSchema = z.object({
  organizationId: z.string().min(1),
  type: ActivityFilterCategoryEnum.optional(),
  userId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
export type GetActivityRequest = z.infer<typeof GetActivityRequestSchema>;

// Create Activity Request
export const CreateActivityRequestSchema = z.object({
  type: ActivityTypeEnum,
  description: z.string().min(1).max(500),
  metadata: z.record(z.string(), z.any()).optional(),
});
export type CreateActivityRequest = z.infer<typeof CreateActivityRequestSchema>;

// Activity Item Response
export interface ActivityItemResponse {
  id: string;
  type: ActivityType;
  userId: string;
  userName: string;
  description: string;
  metadata: {
    leadId?: string;
    leadName?: string;
    campaignId?: string;
    campaignName?: string;
    taskId?: string;
    callDuration?: number;
    disposition?: string;
  };
  createdAt: string;
}

// Get Activity Response
export interface GetActivityResponse {
  items: ActivityItemResponse[];
  nextCursor?: string;
}

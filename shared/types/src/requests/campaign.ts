import { z } from 'zod';
import { PaginationRequestSchema } from './pagination';

// Campaign status (calculated dynamically based on last call date)
export const CampaignStatusSchema = z.enum(['active', 'inactive']);
export type CampaignStatus = z.infer<typeof CampaignStatusSchema>;

// List campaigns
export const ListCampaignsRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().min(1),
  clientId: z.string().uuid().optional(),
  status: CampaignStatusSchema.optional(),
  search: z.string().optional(),
});
export type ListCampaignsRequest = z.infer<typeof ListCampaignsRequestSchema>;

// Get campaign
export const GetCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetCampaignRequest = z.infer<typeof GetCampaignRequestSchema>;

// Create campaign
export const CreateCampaignRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255),
  clientId: z.string().uuid().optional(),
  listId: z.string().uuid().optional(), // Optional existing list to attach
  assignedUserIds: z.array(z.string().uuid()).optional(),
});
export type CreateCampaignRequest = z.infer<typeof CreateCampaignRequestSchema>;

// Update campaign
export const UpdateCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  clientId: z.string().uuid().nullable().optional(),
  assignedUserIds: z.array(z.string().uuid()).optional(),
});
export type UpdateCampaignRequest = z.infer<typeof UpdateCampaignRequestSchema>;

// Delete campaign
export const DeleteCampaignRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type DeleteCampaignRequest = z.infer<typeof DeleteCampaignRequestSchema>;

// Upload CSV to campaign
export const UploadCsvRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type UploadCsvRequest = z.infer<typeof UploadCsvRequestSchema>;

// Assign leads (round-robin)
export const AssignLeadsRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  userIds: z.array(z.string().uuid()).min(1),
});
export type AssignLeadsRequest = z.infer<typeof AssignLeadsRequestSchema>;

// Get campaign leads
export const GetCampaignLeadsRequestSchema = PaginationRequestSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  status: z.enum(['pending', 'dialed', 'completed']).optional(),
  assignedUserId: z.string().uuid().optional(),
});
export type GetCampaignLeadsRequest = z.infer<typeof GetCampaignLeadsRequestSchema>;

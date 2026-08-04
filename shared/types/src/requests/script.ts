import { z } from 'zod';
import { PaginationRequestSchema } from './pagination';

// List scripts
export const ListScriptsRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().min(1),
  campaignId: z.string().uuid().optional(),
});
export type ListScriptsRequest = z.infer<typeof ListScriptsRequestSchema>;

// Get script
export const GetScriptRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetScriptRequest = z.infer<typeof GetScriptRequestSchema>;

// Create script
export const CreateScriptRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255),
  content: z.string().min(1),
  campaignId: z.string().uuid().optional(),
  isDefault: z.boolean().optional(),
});
export type CreateScriptRequest = z.infer<typeof CreateScriptRequestSchema>;

// Update script
export const UpdateScriptRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  content: z.string().min(1).optional(),
  campaignId: z.string().uuid().nullable().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateScriptRequest = z.infer<typeof UpdateScriptRequestSchema>;

// Delete script
export const DeleteScriptRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type DeleteScriptRequest = z.infer<typeof DeleteScriptRequestSchema>;

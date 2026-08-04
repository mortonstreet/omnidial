import { z } from 'zod';

// Pipeline Stage Schemas
export const GetPipelineStagesRequestSchema = z.object({});
export type GetPipelineStagesRequest = z.infer<typeof GetPipelineStagesRequestSchema>;

export const CreatePipelineStageRequestSchema = z.object({
  label: z.string().min(1).max(100),
  color: z.string().default('#6B7280'),
  sortOrder: z.number().int().default(0),
  isDefault: z.boolean().default(false),
});
export type CreatePipelineStageRequest = z.infer<typeof CreatePipelineStageRequestSchema>;

export const UpdatePipelineStageRequestSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdatePipelineStageRequest = z.infer<typeof UpdatePipelineStageRequestSchema>;

export const DeletePipelineStageRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeletePipelineStageRequest = z.infer<typeof DeletePipelineStageRequestSchema>;

export const ReorderPipelineStagesRequestSchema = z.object({
  stages: z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int(),
  })),
});
export type ReorderPipelineStagesRequest = z.infer<typeof ReorderPipelineStagesRequestSchema>;

// Task Schemas
export const GetTasksRequestSchema = z.object({
  leadId: z.string().uuid().optional(),
  userId: z.string().min(1).optional(),
  completed: z.enum(['true', 'false', 'all']).default('all'),
  dueFrom: z.string().datetime().optional(),
  dueTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type GetTasksRequest = z.infer<typeof GetTasksRequestSchema>;

export const GetTaskRequestSchema = z.object({
  id: z.string().uuid(),
});
export type GetTaskRequest = z.infer<typeof GetTaskRequestSchema>;

export const CreateTaskRequestSchema = z.object({
  leadId: z.string().uuid(),
  title: z.string().min(1).max(255),
  dueAt: z.string().datetime().optional(),
});
export type CreateTaskRequest = z.infer<typeof CreateTaskRequestSchema>;

export const UpdateTaskRequestSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  dueAt: z.string().datetime().optional().nullable(),
  completedAt: z.string().datetime().optional().nullable(),
});
export type UpdateTaskRequest = z.infer<typeof UpdateTaskRequestSchema>;

export const CompleteTaskRequestSchema = z.object({
  id: z.string().uuid(),
});
export type CompleteTaskRequest = z.infer<typeof CompleteTaskRequestSchema>;

export const DeleteTaskRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteTaskRequest = z.infer<typeof DeleteTaskRequestSchema>;

// Note Schemas
export const GetNotesRequestSchema = z.object({
  leadId: z.string().uuid(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type GetNotesRequest = z.infer<typeof GetNotesRequestSchema>;

export const CreateNoteRequestSchema = z.object({
  leadId: z.string().uuid(),
  content: z.string().min(1),
});
export type CreateNoteRequest = z.infer<typeof CreateNoteRequestSchema>;

export const UpdateNoteRequestSchema = z.object({
  id: z.string().uuid(),
  content: z.string().min(1),
});
export type UpdateNoteRequest = z.infer<typeof UpdateNoteRequestSchema>;

export const DeleteNoteRequestSchema = z.object({
  id: z.string().uuid(),
});
export type DeleteNoteRequest = z.infer<typeof DeleteNoteRequestSchema>;

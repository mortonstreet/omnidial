import { z } from 'zod';
import { PaginationRequestSchema } from './pagination';

// List clients
export const ListClientsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type ListClientsRequest = z.infer<typeof ListClientsRequestSchema>;

// Get client
export const GetClientRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetClientRequest = z.infer<typeof GetClientRequestSchema>;

// Create client
export const CreateClientRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255),
  color: z.string().optional(),
});
export type CreateClientRequest = z.infer<typeof CreateClientRequestSchema>;

// Update client
export const UpdateClientRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  color: z.string().optional(),
});
export type UpdateClientRequest = z.infer<typeof UpdateClientRequestSchema>;

// Delete client
export const DeleteClientRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type DeleteClientRequest = z.infer<typeof DeleteClientRequestSchema>;

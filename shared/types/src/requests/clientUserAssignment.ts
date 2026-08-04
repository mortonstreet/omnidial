import { z } from 'zod';

// Get assigned clients for current user (role-aware: admins get all, members get assigned only)
export const GetMyAssignedClientsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetMyAssignedClientsRequest = z.infer<typeof GetMyAssignedClientsRequestSchema>;

// Get users assigned to a client (admin only)
export const GetClientUsersRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
});
export type GetClientUsersRequest = z.infer<typeof GetClientUsersRequestSchema>;

// Assign user to client (admin only)
export const AssignUserToClientRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
  userId: z.string().min(1), // better-auth uses nanoid, not UUID
});
export type AssignUserToClientRequest = z.infer<typeof AssignUserToClientRequestSchema>;

// Unassign user from client (admin only)
export const UnassignUserFromClientRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
  userId: z.string().min(1), // better-auth uses nanoid, not UUID
});
export type UnassignUserFromClientRequest = z.infer<typeof UnassignUserFromClientRequestSchema>;

// Bulk assign users to client (admin only)
export const BulkAssignUsersToClientRequestSchema = z.object({
  organizationId: z.string().min(1),
  clientId: z.string().uuid(),
  userIds: z.array(z.string().min(1)), // better-auth uses nanoid, not UUID
});
export type BulkAssignUsersToClientRequest = z.infer<typeof BulkAssignUsersToClientRequestSchema>;

// Get clients assigned to a specific user (admin only)
export const GetUserClientsRequestSchema = z.object({
  organizationId: z.string().min(1),
  userId: z.string().min(1), // better-auth uses nanoid, not UUID
});
export type GetUserClientsRequest = z.infer<typeof GetUserClientsRequestSchema>;

// Response types
export interface ClientUserAssignmentResponse {
  id: string;
  clientId: string;
  userId: string;
  userName: string | null;
  userEmail: string;
  createdAt: string;
}

export interface AssignedClientResponse {
  id: string;
  name: string;
  color: string | null;
}

// Response for getting clients assigned to a specific user
export interface UserClientAssignmentResponse {
  id: string;
  clientId: string;
  userId: string;
  clientName: string | null;
  clientColor: string | null;
  createdAt: string;
}

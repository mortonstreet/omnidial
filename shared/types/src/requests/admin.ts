import { z } from 'zod';
import { PaginationRequestSchema, PaginatedResponse } from './pagination';

// Admin Users
export const AdminUsersRequestSchema = PaginationRequestSchema.extend({
  search: z.string().optional(),
});

export type AdminUsersRequest = z.infer<typeof AdminUsersRequestSchema>;

export type AdminUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  role: string | null;
  emailVerified: boolean;
  organizations: string[]; // org names for search display
};

export type AdminUsersResponse = PaginatedResponse<AdminUser>;

// Admin Organizations
export const AdminOrganizationsRequestSchema = PaginationRequestSchema.extend({
  search: z.string().optional(),
});

export type AdminOrganizationsRequest = z.infer<typeof AdminOrganizationsRequestSchema>;

export type AdminOrganization = {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  memberCount: number;
  creditBalance: number;
  managedBySuperadmin?: boolean;
};

export type AdminOrganizationsResponse = PaginatedResponse<AdminOrganization>;

// Stats
export type AdminStats = {
  users: number;
  organizations: number;
};

// Add Credits
export const AddOrganizationCreditsRequestSchema = z.object({
  organizationId: z.string(),
  amount: z.number().int().min(1),
  reason: z.string().optional(),
});

export type AddOrganizationCreditsRequest = z.infer<typeof AddOrganizationCreditsRequestSchema>;

// Data Cleanup: Find leads by custom field
export const FindLeadsByCustomFieldRequestSchema = z.object({
  organizationId: z.string(),
  customFieldKey: z.string(),
});

export type FindLeadsByCustomFieldRequest = z.infer<typeof FindLeadsByCustomFieldRequestSchema>;

export type FindLeadsByCustomFieldResponse = {
  leads: {
    id: string;
    phone: string;
    customFields: Record<string, string>;
  }[];
  count: number;
};

// Data Cleanup: Bulk hard delete leads
export const BulkHardDeleteLeadsRequestSchema = z.object({
  organizationId: z.string(),
  leadIds: z.array(z.string()).min(1),
});

export type BulkHardDeleteLeadsRequest = z.infer<typeof BulkHardDeleteLeadsRequestSchema>;

export type BulkHardDeleteLeadsResponse = {
  deleted: number;
};

// Data Cleanup: Find duplicate leads by normalized phone
export const FindDuplicateLeadsRequestSchema = z.object({
  organizationId: z.string(),
});

export type FindDuplicateLeadsRequest = z.infer<typeof FindDuplicateLeadsRequestSchema>;

export type DuplicateLead = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  company: string | null;
  title: string | null;
  linkedInUrl: string | null;
  createdAt: string;
  completenessScore: number;
};

export type DuplicateGroup = {
  normalizedPhone: string;
  leads: DuplicateLead[];
  recommendedKeepId: string; // ID of the lead with highest completeness score
};

export type FindDuplicateLeadsResponse = {
  groups: DuplicateGroup[];
  totalDuplicates: number;
  totalGroups: number;
};

// Data Cleanup: Resolve duplicate leads
export const ResolveDuplicateLeadsRequestSchema = z.object({
  organizationId: z.string(),
  resolutions: z.array(
    z.object({
      normalizedPhone: z.string(),
      keepLeadId: z.string(),
      deleteLeadIds: z.array(z.string()).min(1),
      mergeData: z.boolean().default(false), // If true, merge data from deleted leads into kept lead
    })
  ).min(1),
});

export type ResolveDuplicateLeadsRequest = z.infer<typeof ResolveDuplicateLeadsRequestSchema>;

export type ResolveDuplicateLeadsResponse = {
  resolved: number;
  deleted: number;
  merged: number;
};

// ============================================================================
// Super Admin User Management
// ============================================================================

// Delete User
export const DeleteUserRequestSchema = z.object({
  userId: z.string(),
});

export type DeleteUserRequest = z.infer<typeof DeleteUserRequestSchema>;

export type DeleteUserResponse = {
  success: boolean;
  deletedUserId: string;
};

// Delete Organization
export const DeleteOrganizationRequestSchema = z.object({
  organizationId: z.string(),
});

export type DeleteOrganizationRequest = z.infer<typeof DeleteOrganizationRequestSchema>;

export type DeleteOrganizationResponse = {
  success: boolean;
  deletedOrganizationId: string;
};

// Reassign User to Different Organization
export const ReassignUserRequestSchema = z.object({
  userId: z.string(),
  fromOrganizationId: z.string().optional(), // If provided, removes user from this org first
  toOrganizationId: z.string(),
  role: z.enum(['member', 'admin', 'owner']).default('member'),
});

export type ReassignUserRequest = z.infer<typeof ReassignUserRequestSchema>;

export type ReassignUserResponse = {
  success: boolean;
  userId: string;
  newOrganizationId: string;
  role: string;
};

// Create Organization (Super Admin Only)
export const CreateOrganizationRequestSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens only'),
  provisionPhone: z.boolean().optional(),
});

export type CreateOrganizationRequest = z.infer<typeof CreateOrganizationRequestSchema>;

export type CreateOrganizationResponse = {
  success: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
  };
};

// Remove User from Organization
export const RemoveUserFromOrganizationRequestSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
});

export type RemoveUserFromOrganizationRequest = z.infer<typeof RemoveUserFromOrganizationRequestSchema>;

export type RemoveUserFromOrganizationResponse = {
  success: boolean;
  removedUserId: string;
  organizationId: string;
};

// Extended AdminUser type with organization details
export type AdminUserWithOrgs = AdminUser & {
  organizationDetails: {
    id: string;
    name: string;
    role: string;
  }[];
};

// Get organization members for admin view
export const GetOrganizationMembersRequestSchema = z.object({
  organizationId: z.string(),
});

export type GetOrganizationMembersRequest = z.infer<typeof GetOrganizationMembersRequestSchema>;

export type OrganizationMember = {
  id: string;
  userId: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
};

export type GetOrganizationMembersResponse = {
  members: OrganizationMember[];
  organizationId: string;
  organizationName: string;
};

// Admin Switch Organization (superadmin virtual access)
export const SwitchOrgRequestSchema = z.object({
  organizationId: z.string(),
});

export type SwitchOrgRequest = z.infer<typeof SwitchOrgRequestSchema>;

export type SwitchOrgResponse = {
  success: boolean;
  organizationId: string;
  organizationName: string;
};

// Admin Provision Organization (trigger Twilio provisioning)
export const AdminProvisionOrganizationRequestSchema = z.object({
  organizationId: z.string(),
});

export type AdminProvisionOrganizationRequest = z.infer<typeof AdminProvisionOrganizationRequestSchema>;

// Admin Mark Organization as Main Account (legacy orgs using ISV main account)
export const AdminMarkMainAccountRequestSchema = z.object({
  organizationId: z.string(),
});

export type AdminMarkMainAccountRequest = z.infer<typeof AdminMarkMainAccountRequestSchema>;

// Admin Release Phone Number (release number but keep subaccount infrastructure)
export const AdminReleaseNumberRequestSchema = z.object({
  organizationId: z.string(),
});

export type AdminReleaseNumberRequest = z.infer<typeof AdminReleaseNumberRequestSchema>;

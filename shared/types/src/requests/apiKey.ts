import { z } from 'zod';
import { PaginationRequestSchema } from './pagination';

// === Scopes ===
export const ApiKeyScopeSchema = z.enum([
  'read:leads',
  'write:leads',
  'delete:leads',
  'read:calls',
  'write:calls',
  'read:campaigns',
  'write:campaigns',
]);
export type ApiKeyScope = z.infer<typeof ApiKeyScopeSchema>;

// === Request Schemas ===
export const ListApiKeysRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().min(1),
});
export type ListApiKeysRequest = z.infer<typeof ListApiKeysRequestSchema>;

export const GetApiKeyRequestSchema = z.object({
  organizationId: z.string().min(1),
  id: z.string().uuid(),
});
export type GetApiKeyRequest = z.infer<typeof GetApiKeyRequestSchema>;

export const CreateApiKeyRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255),
  scopes: z.array(ApiKeyScopeSchema).min(1),
  expiresInDays: z.number().int().positive().nullable().optional(),
});
export type CreateApiKeyRequest = z.infer<typeof CreateApiKeyRequestSchema>;

export const RevokeApiKeyRequestSchema = z.object({
  organizationId: z.string().min(1),
  id: z.string().uuid(),
});
export type RevokeApiKeyRequest = z.infer<typeof RevokeApiKeyRequestSchema>;

export const GetApiKeyUsageRequestSchema = z.object({
  organizationId: z.string().min(1),
  id: z.string().uuid(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
export type GetApiKeyUsageRequest = z.infer<typeof GetApiKeyUsageRequestSchema>;

// === Response Types ===
export interface ApiKeyCreator {
  id: string;
  name: string;
  email: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: ApiKeyCreator | null;
}

export interface ApiKeyCreateResponse {
  id: string;
  key: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
}

export interface ApiKeyListResponse {
  data: ApiKeyResponse[];
  total: number;
  page: number;
  limit: number;
}

export interface ApiKeyUsageResponse {
  totalRequests: number;
  requestsByEndpoint: { endpoint: string; count: number }[];
  requestsByDay: { date: string; count: number }[];
}

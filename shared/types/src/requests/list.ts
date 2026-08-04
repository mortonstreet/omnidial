import { z } from 'zod';
import { PaginationRequestSchema } from './pagination';

// List import status
export const ListImportStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type ListImportStatus = z.infer<typeof ListImportStatusSchema>;

// ======= FOLDER SCHEMAS =======

// List all folders
export const ListFoldersRequestSchema = z.object({
  organizationId: z.string().min(1),
  parentId: z.string().uuid().nullable().optional(),
});
export type ListFoldersRequest = z.infer<typeof ListFoldersRequestSchema>;

// Create folder
export const CreateFolderRequestSchema = z.object({
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type CreateFolderRequest = z.infer<typeof CreateFolderRequestSchema>;

// Update folder
export const UpdateFolderRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  name: z.string().min(1).max(255).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  parentId: z.string().uuid().nullable().optional(),
});
export type UpdateFolderRequest = z.infer<typeof UpdateFolderRequestSchema>;

// Delete folder
export const DeleteFolderRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type DeleteFolderRequest = z.infer<typeof DeleteFolderRequestSchema>;

// Reorder folders
export const ReorderFoldersRequestSchema = z.object({
  organizationId: z.string().min(1),
  folderIds: z.array(z.string().uuid()),
});
export type ReorderFoldersRequest = z.infer<typeof ReorderFoldersRequestSchema>;

// ======= LIST SCHEMAS =======

// List all lists
export const ListListsRequestSchema = PaginationRequestSchema.extend({
  organizationId: z.string().min(1),
  folderId: z.string().uuid().optional(),
  search: z.string().optional(),
});
export type ListListsRequest = z.infer<typeof ListListsRequestSchema>;

// Get single list
export const GetListRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetListRequest = z.infer<typeof GetListRequestSchema>;

// Create list
export const CreateListRequestSchema = z.object({
  organizationId: z.string().min(1),
  folderId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
});
export type CreateListRequest = z.infer<typeof CreateListRequestSchema>;

// Update list
export const UpdateListRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  folderId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
});
export type UpdateListRequest = z.infer<typeof UpdateListRequestSchema>;

// Delete list
export const DeleteListRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type DeleteListRequest = z.infer<typeof DeleteListRequestSchema>;

// Upload CSV to list
export const UploadListCsvRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type UploadListCsvRequest = z.infer<typeof UploadListCsvRequestSchema>;

// ======= LIST LEADS SCHEMAS =======

// Get leads in list
export const GetListLeadsRequestSchema = PaginationRequestSchema.extend({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  search: z.string().optional(),
});
export type GetListLeadsRequest = z.infer<typeof GetListLeadsRequestSchema>;

// Add leads to list
export const AddLeadsToListRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1),
});
export type AddLeadsToListRequest = z.infer<typeof AddLeadsToListRequestSchema>;

// Remove leads from list
export const RemoveLeadsFromListRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
  leadIds: z.array(z.string().uuid()).min(1),
});
export type RemoveLeadsFromListRequest = z.infer<typeof RemoveLeadsFromListRequestSchema>;

// Soft-remove a single lead from list (for power dialer - preserves data)
export const SoftRemoveLeadFromListRequestSchema = z.object({
  id: z.string().uuid(), // listId
  leadId: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type SoftRemoveLeadFromListRequest = z.infer<typeof SoftRemoveLeadFromListRequestSchema>;

// ======= CAMPAIGN-LIST LINKING SCHEMAS =======

// Add list to campaign
export const AddListToCampaignRequestSchema = z.object({
  campaignId: z.string().uuid(),
  listId: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type AddListToCampaignRequest = z.infer<typeof AddListToCampaignRequestSchema>;

// Remove list from campaign
export const RemoveListFromCampaignRequestSchema = z.object({
  campaignId: z.string().uuid(),
  listId: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type RemoveListFromCampaignRequest = z.infer<typeof RemoveListFromCampaignRequestSchema>;

// Get lists for campaign
export const GetCampaignListsRequestSchema = z.object({
  campaignId: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type GetCampaignListsRequest = z.infer<typeof GetCampaignListsRequestSchema>;

// Export list leads
export const ExportListLeadsRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type ExportListLeadsRequest = z.infer<typeof ExportListLeadsRequestSchema>;

// ======= FAVORITES SCHEMAS =======

// Toggle favorite
export const ToggleFavoriteRequestSchema = z.object({
  organizationId: z.string().min(1),
  itemId: z.string().uuid(),
  type: z.enum(['list', 'folder']),
});
export type ToggleFavoriteRequest = z.infer<typeof ToggleFavoriteRequestSchema>;

// Get favorites
export const GetFavoritesRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetFavoritesRequest = z.infer<typeof GetFavoritesRequestSchema>;

// Get favorite IDs (for UI indicators)
export const GetFavoriteIdsRequestSchema = z.object({
  organizationId: z.string().min(1),
});
export type GetFavoriteIdsRequest = z.infer<typeof GetFavoriteIdsRequestSchema>;

// ======= RECENTS SCHEMAS =======

// Record list open
export const RecordListOpenRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type RecordListOpenRequest = z.infer<typeof RecordListOpenRequestSchema>;

// Record folder open
export const RecordFolderOpenRequestSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().min(1),
});
export type RecordFolderOpenRequest = z.infer<typeof RecordFolderOpenRequestSchema>;

// Get recents
export const GetRecentsRequestSchema = z.object({
  organizationId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(20).optional(),
});
export type GetRecentsRequest = z.infer<typeof GetRecentsRequestSchema>;

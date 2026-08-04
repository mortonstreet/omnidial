import { Router } from 'express'
import multer from 'multer'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  ListFoldersRequestSchema,
  CreateFolderRequestSchema,
  UpdateFolderRequestSchema,
  DeleteFolderRequestSchema,
  ReorderFoldersRequestSchema,
  ListListsRequestSchema,
  GetListRequestSchema,
  CreateListRequestSchema,
  UpdateListRequestSchema,
  DeleteListRequestSchema,
  UploadListCsvRequestSchema,
  GetListLeadsRequestSchema,
  AddLeadsToListRequestSchema,
  RemoveLeadsFromListRequestSchema,
  SoftRemoveLeadFromListRequestSchema,
  AddListToCampaignRequestSchema,
  RemoveListFromCampaignRequestSchema,
  GetCampaignListsRequestSchema,
  ExportListLeadsRequestSchema,
  ToggleFavoriteRequestSchema,
  GetFavoritesRequestSchema,
  GetFavoriteIdsRequestSchema,
  RecordListOpenRequestSchema,
  RecordFolderOpenRequestSchema,
  GetRecentsRequestSchema,
} from '@shared/types/src'
import {
  listFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  reorderFolders,
  listLists,
  getList,
  createList,
  updateList,
  deleteList,
  uploadListCsv,
  getListLeads,
  addLeadsToList,
  removeLeadsFromList,
  softRemoveLeadFromList,
  addListToCampaign,
  removeListFromCampaign,
  getCampaignLists,
  exportListLeads,
  toggleFavorite,
  getFavorites,
  getFavoriteIds,
  recordListOpen,
  recordFolderOpen,
  getRecents,
} from '@/api/controllers/list.controller'

const router = Router()

// Configure multer for CSV uploads (10MB limit)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
})

// ======= FOLDER ROUTES =======

router.get(
  '/folders',
  withBetterAuth,
  validateAndMerge(ListFoldersRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listFolders),
)

router.post(
  '/folders',
  withBetterAuth,
  validateAndMerge(CreateFolderRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(createFolder),
)

router.patch(
  '/folders/:id',
  withBetterAuth,
  validateAndMerge(UpdateFolderRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateFolder),
)

router.delete(
  '/folders/:id',
  withBetterAuth,
  validateAndMerge(DeleteFolderRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteFolder),
)

router.post(
  '/folders/reorder',
  withBetterAuth,
  validateAndMerge(ReorderFoldersRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(reorderFolders),
)

// Record folder open (for recents)
router.post(
  '/folders/:id/open',
  withBetterAuth,
  validateAndMerge(RecordFolderOpenRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(recordFolderOpen),
)

// ======= CAMPAIGN-LIST LINKING ROUTES =======
// NOTE: These must come BEFORE /:id routes to avoid "campaigns" being matched as an id

router.get(
  '/campaigns/:campaignId',
  withBetterAuth,
  validateAndMerge(GetCampaignListsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getCampaignLists),
)

router.post(
  '/campaigns/:campaignId',
  withBetterAuth,
  validateAndMerge(AddListToCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(addListToCampaign),
)

router.delete(
  '/campaigns/:campaignId/:listId',
  withBetterAuth,
  validateAndMerge(RemoveListFromCampaignRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(removeListFromCampaign),
)

// ======= FAVORITES ROUTES =======
// NOTE: These must come BEFORE /:id routes to avoid "favorites" being matched as an id

router.get(
  '/favorites',
  withBetterAuth,
  validateAndMerge(GetFavoritesRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getFavorites),
)

router.get(
  '/favorites/ids',
  withBetterAuth,
  validateAndMerge(GetFavoriteIdsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getFavoriteIds),
)

router.post(
  '/favorites',
  withBetterAuth,
  validateAndMerge(ToggleFavoriteRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(toggleFavorite),
)

// ======= RECENTS ROUTES =======
// NOTE: These must come BEFORE /:id routes to avoid "recents" being matched as an id

router.get(
  '/recents',
  withBetterAuth,
  validateAndMerge(GetRecentsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getRecents),
)

// ======= LIST ROUTES =======

router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListListsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(listLists),
)

router.post(
  '/',
  withBetterAuth,
  validateAndMerge(CreateListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(createList),
)

// ======= LIST DETAIL ROUTES (with :id param) =======
// NOTE: These must come AFTER all static routes like /campaigns, /favorites, /recents

router.get(
  '/:id',
  withBetterAuth,
  validateAndMerge(GetListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getList),
)

router.patch(
  '/:id',
  withBetterAuth,
  validateAndMerge(UpdateListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(updateList),
)

router.delete(
  '/:id',
  withBetterAuth,
  validateAndMerge(DeleteListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(deleteList),
)

// CSV upload
router.post(
  '/:id/upload',
  withBetterAuth,
  upload.single('file'),
  validateAndMerge(UploadListCsvRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(uploadListCsv),
)

// Export list leads as CSV
router.get(
  '/:id/export',
  withBetterAuth,
  validateAndMerge(ExportListLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(exportListLeads),
)

// Record list open (for recents)
router.post(
  '/:id/open',
  withBetterAuth,
  validateAndMerge(RecordListOpenRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(recordListOpen),
)

// ======= LIST LEADS ROUTES =======

router.get(
  '/:id/leads',
  withBetterAuth,
  validateAndMerge(GetListLeadsRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(getListLeads),
)

router.post(
  '/:id/leads',
  withBetterAuth,
  validateAndMerge(AddLeadsToListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(addLeadsToList),
)

router.delete(
  '/:id/leads',
  withBetterAuth,
  validateAndMerge(RemoveLeadsFromListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(removeLeadsFromList),
)

// Soft-remove a single lead from list (for power dialer - preserves data)
router.delete(
  '/:id/leads/:leadId',
  withBetterAuth,
  validateAndMerge(SoftRemoveLeadFromListRequestSchema),
  validateMemberOfOrganization,
  authenticatedRoute(softRemoveLeadFromList),
)

export default router

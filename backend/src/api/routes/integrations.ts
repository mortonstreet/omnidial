import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganizationIs,
} from '../middlewares/auth'
import {
  ListIntegrationsRequestSchema,
  GetIntegrationStatusRequestSchema,
  ConnectIntegrationRequestSchema,
  IntegrationCallbackRequestSchema,
  UpdateIntegrationConfigRequestSchema,
  DisconnectIntegrationRequestSchema,
  TestIntegrationRequestSchema,
  ListGoogleSheetsRequestSchema,
  GetSheetColumnsRequestSchema,
  ImportFromSheetRequestSchema,
  // HubSpot schemas
  ListHubSpotContactListsRequestSchema,
  ImportFromHubSpotRequestSchema,
  // EnrichEngine API Key schemas
  ConnectEnrichEngineRequestSchema,
  GetEnrichEngineStatusRequestSchema,
  DisconnectEnrichEngineRequestSchema,
  TestEnrichEngineRequestSchema,
  ListEnrichEngineListsRequestSchema,
  GetEnrichEngineListLeadsRequestSchema,
  ImportFromEnrichEngineRequestSchema,
  // Google Sheets Export schemas
  CheckSheetsWriteAccessRequestSchema,
  ExportLeadsToSheetRequestSchema,
  ExportListToSheetRequestSchema,
  ExportAnalyticsToSheetRequestSchema,
} from '@shared/types/src'
import {
  listIntegrations,
  getIntegrationStatus,
  connectIntegration,
  handleOAuthCallback,
  handleOAuthCallbackRedirect,
  updateIntegrationConfig,
  disconnectIntegration,
  testIntegration,
  listGoogleSheets,
  getSheetColumns,
  importFromSheet,
  // HubSpot controllers
  getHubSpotContactsSummary,
  importFromHubSpot,
  // EnrichEngine API Key controllers
  connectEnrichEngine,
  getEnrichEngineStatus,
  disconnectEnrichEngine,
  testEnrichEngine,
  listEnrichEngineLists,
  getEnrichEngineListLeads,
  importFromEnrichEngine,
  // Google Sheets Export controllers
  checkSheetsWriteAccess,
  exportLeadsToSheet,
  exportListToSheet,
  exportAnalyticsToSheet,
} from '@/api/controllers/integration.controller'

const router = Router()

// All routes require owner
router.get(
  '/',
  withBetterAuth,
  validateAndMerge(ListIntegrationsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(listIntegrations),
)

// === Specific Routes MUST come before generic /:provider routes ===

// === Google Sheets Specific Routes ===

router.get(
  '/google_sheets/sheets',
  withBetterAuth,
  validateAndMerge(ListGoogleSheetsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(listGoogleSheets),
)

router.get(
  '/google_sheets/columns/:sheetId',
  withBetterAuth,
  validateAndMerge(GetSheetColumnsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getSheetColumns),
)

router.post(
  '/google_sheets/import',
  withBetterAuth,
  validateAndMerge(ImportFromSheetRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(importFromSheet),
)

// Google Sheets Export Routes
router.get(
  '/google_sheets/write-access',
  withBetterAuth,
  validateAndMerge(CheckSheetsWriteAccessRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(checkSheetsWriteAccess),
)

router.post(
  '/google_sheets/export/leads',
  withBetterAuth,
  validateAndMerge(ExportLeadsToSheetRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(exportLeadsToSheet),
)

router.post(
  '/google_sheets/export/list',
  withBetterAuth,
  validateAndMerge(ExportListToSheetRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(exportListToSheet),
)

router.post(
  '/google_sheets/export/analytics',
  withBetterAuth,
  validateAndMerge(ExportAnalyticsToSheetRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(exportAnalyticsToSheet),
)

// === HubSpot Specific Routes ===

router.get(
  '/hubspot/contacts/summary',
  withBetterAuth,
  validateAndMerge(ListHubSpotContactListsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getHubSpotContactsSummary),
)

router.post(
  '/hubspot/import',
  withBetterAuth,
  validateAndMerge(ImportFromHubSpotRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(importFromHubSpot),
)

// === EnrichEngine Specific Routes (API Key Authentication) ===

// Connect with API key
router.post(
  '/enrichengine/connect',
  withBetterAuth,
  validateAndMerge(ConnectEnrichEngineRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(connectEnrichEngine),
)

// Get connection status
router.get(
  '/enrichengine/status',
  withBetterAuth,
  validateAndMerge(GetEnrichEngineStatusRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getEnrichEngineStatus),
)

// Disconnect
router.delete(
  '/enrichengine',
  withBetterAuth,
  validateAndMerge(DisconnectEnrichEngineRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(disconnectEnrichEngine),
)

// Test connection
router.post(
  '/enrichengine/test',
  withBetterAuth,
  validateAndMerge(TestEnrichEngineRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(testEnrichEngine),
)

// List available lists
router.get(
  '/enrichengine/lists',
  withBetterAuth,
  validateAndMerge(ListEnrichEngineListsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(listEnrichEngineLists),
)

// Get list with leads
router.get(
  '/enrichengine/lists/:listId/leads',
  withBetterAuth,
  validateAndMerge(GetEnrichEngineListLeadsRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getEnrichEngineListLeads),
)

// Import leads from list
router.post(
  '/enrichengine/import',
  withBetterAuth,
  validateAndMerge(ImportFromEnrichEngineRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(importFromEnrichEngine),
)

// === Generic Provider Routes (must come AFTER specific routes) ===

router.get(
  '/:provider/status',
  withBetterAuth,
  validateAndMerge(GetIntegrationStatusRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(getIntegrationStatus),
)

router.post(
  '/:provider/connect',
  withBetterAuth,
  validateAndMerge(ConnectIntegrationRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(connectIntegration),
)

// GET callback for OAuth provider redirects (e.g., Google)
// No auth middleware - state parameter contains user/org info from OAuth flow
router.get('/:provider/callback', handleOAuthCallbackRedirect)

// POST callback for frontend-initiated callbacks (optional, kept for backwards compatibility)
router.post(
  '/:provider/callback',
  withBetterAuth,
  validateAndMerge(IntegrationCallbackRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(handleOAuthCallback),
)

router.patch(
  '/:provider/config',
  withBetterAuth,
  validateAndMerge(UpdateIntegrationConfigRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(updateIntegrationConfig),
)

router.delete(
  '/:provider',
  withBetterAuth,
  validateAndMerge(DisconnectIntegrationRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(disconnectIntegration),
)

router.post(
  '/:provider/test',
  withBetterAuth,
  validateAndMerge(TestIntegrationRequestSchema),
  validateMemberOfOrganizationIs(['owner']),
  authenticatedRoute(testIntegration),
)

export default router

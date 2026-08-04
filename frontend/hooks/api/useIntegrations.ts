import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';
import {
  IntegrationListResponse,
  IntegrationResponse,
  IntegrationConfig,
  OAuthUrlResponse,
  TestConnectionResponse,
  GoogleSheet,
  SheetColumn,
  ImportResult,
  ColumnMappingInput,
  EnrichEngineConnectionStatus,
  EnrichEngineListsResponse,
  EnrichEngineListDetailResponse,
  CheckSheetsWriteAccessResponse,
  ExportTarget,
  ExportToSheetResult,
  HubSpotContactsSummary,
} from '@shared/types/src';

export function useIntegrations() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.integrations(orgId),
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);

        return await get<IntegrationListResponse>(
          `${ENDPOINTS.INTEGRATIONS.LIST}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch integrations:', error);
        return { data: [] };
      }
    },
    enabled: !!orgId,
  });
}

export function useIntegrationStatus(provider?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.integrationStatus(provider),
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams();
        searchParams.set('organizationId', orgId!);

        return await get<{ data: IntegrationResponse }>(
          `${ENDPOINTS.INTEGRATIONS.STATUS(provider!)}?${searchParams.toString()}`
        );
      } catch (error) {
        console.error('Failed to fetch integration status:', error);
        return { data: null };
      }
    },
    enabled: !!provider && !!orgId,
  });
}

export function useConnectIntegration() {
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (provider: string) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: OAuthUrlResponse }>(
        ENDPOINTS.INTEGRATIONS.CONNECT(provider),
        {
          organizationId: orgId,
          redirectUrl: window.location.href,
        }
      );
    },
  });
}

export function useUpdateIntegrationConfig() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { provider: string; config: IntegrationConfig }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return patch(ENDPOINTS.INTEGRATIONS.CONFIG(params.provider), {
        organizationId: orgId,
        config: params.config,
      });
    },
    onSuccess: (_, variables) => {
      const orgId = activeOrganization?.data?.id;
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.integrationStatus(variables.provider),
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.integrations(orgId) });
    },
  });
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (provider: string) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId);

      return del(
        `${ENDPOINTS.INTEGRATIONS.DISCONNECT(provider)}?${searchParams.toString()}`
      );
    },
    onSuccess: () => {
      const orgId = activeOrganization?.data?.id;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.integrations(orgId) });
    },
  });
}

export function useTestIntegration() {
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (provider: string) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: TestConnectionResponse }>(
        ENDPOINTS.INTEGRATIONS.TEST(provider),
        {
          organizationId: orgId,
        }
      );
    },
  });
}

// === Google Sheets Specific Hooks ===

export function useGoogleSheets() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.googleSheets(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return get<{ data: GoogleSheet[] }>(
        `${ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.LIST}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId,
  });
}

export function useGoogleSheetColumns(sheetId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.googleSheetColumns(sheetId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return get<{ data: SheetColumn[] }>(
        `${ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.COLUMNS(sheetId!)}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId && !!sheetId,
  });
}

export function useImportFromGoogleSheet() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: {
      sheetId: string;
      columnMappings: ColumnMappingInput[];
      listName?: string;
    }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: ImportResult }>(
        ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.IMPORT,
        {
          organizationId: orgId,
          sheetId: params.sheetId,
          columnMappings: params.columnMappings,
          listName: params.listName,
        }
      );
    },
    onSuccess: () => {
      // Invalidate lists to show the new imported list
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-folders'] });
    },
  });
}

// === Google Sheets Export Hooks ===

/**
 * Check if user has write access to Google Sheets (for export)
 */
export function useCheckSheetsWriteAccess() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.googleSheetsWriteAccess(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return get<{ data: CheckSheetsWriteAccessResponse }>(
        `${ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.WRITE_ACCESS}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId,
  });
}

/**
 * Export leads to Google Sheets
 */
export function useExportLeadsToSheet() {
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[];
      target: ExportTarget;
      existingSheetId?: string;
      newSheetTitle?: string;
    }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: ExportToSheetResult }>(
        ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.EXPORT_LEADS,
        {
          organizationId: orgId,
          leadIds: params.leadIds,
          target: params.target,
          existingSheetId: params.existingSheetId,
          newSheetTitle: params.newSheetTitle,
        }
      );
    },
  });
}

/**
 * Export a list to Google Sheets
 */
export function useExportListToSheet() {
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: {
      listId: string;
      target: ExportTarget;
      existingSheetId?: string;
      newSheetTitle?: string;
    }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: ExportToSheetResult }>(
        ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.EXPORT_LIST,
        {
          organizationId: orgId,
          listId: params.listId,
          target: params.target,
          existingSheetId: params.existingSheetId,
          newSheetTitle: params.newSheetTitle,
        }
      );
    },
  });
}

/**
 * Export analytics to Google Sheets
 */
export function useExportAnalyticsToSheet() {
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: {
      dateRange: { start: string; end: string };
      target: ExportTarget;
      existingSheetId?: string;
      newSheetTitle?: string;
    }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: ExportToSheetResult }>(
        ENDPOINTS.INTEGRATIONS.GOOGLE_SHEETS.EXPORT_ANALYTICS,
        {
          organizationId: orgId,
          dateRange: params.dateRange,
          target: params.target,
          existingSheetId: params.existingSheetId,
          newSheetTitle: params.newSheetTitle,
        }
      );
    },
  });
}

// === EnrichEngine Specific Hooks (API Key Authentication) ===

/**
 * Get EnrichEngine connection status
 */
export function useEnrichEngineStatus() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.enrichEngineStatus(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return get<{ data: EnrichEngineConnectionStatus }>(
        `${ENDPOINTS.INTEGRATIONS.ENRICHENGINE.STATUS}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId,
  });
}

/**
 * Connect EnrichEngine with API key
 */
export function useConnectEnrichEngine() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (apiKey: string) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: { success: boolean; message: string } }>(
        ENDPOINTS.INTEGRATIONS.ENRICHENGINE.CONNECT,
        {
          organizationId: orgId,
          apiKey,
        }
      );
    },
    onSuccess: () => {
      const orgId = activeOrganization?.data?.id;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.enrichEngineStatus(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.integrations(orgId) });
    },
  });
}

/**
 * Disconnect EnrichEngine
 */
export function useDisconnectEnrichEngine() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async () => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId);

      return del(
        `${ENDPOINTS.INTEGRATIONS.ENRICHENGINE.DISCONNECT}?${searchParams.toString()}`
      );
    },
    onSuccess: () => {
      const orgId = activeOrganization?.data?.id;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.enrichEngineStatus(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.integrations(orgId) });
    },
  });
}

/**
 * Test EnrichEngine connection
 */
export function useTestEnrichEngine() {
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async () => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: { success: boolean; message: string } }>(
        ENDPOINTS.INTEGRATIONS.ENRICHENGINE.TEST,
        {
          organizationId: orgId,
        }
      );
    },
  });
}

/**
 * Get available EnrichEngine lists
 */
export function useEnrichEngineLists(options?: { search?: string }) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.enrichEngineLists(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);
      if (options?.search) {
        searchParams.set('search', options.search);
      }

      return get<{ data: EnrichEngineListsResponse }>(
        `${ENDPOINTS.INTEGRATIONS.ENRICHENGINE.LISTS}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId,
  });
}

/**
 * Get leads from an EnrichEngine list
 */
export function useEnrichEngineListLeads(listId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.enrichEngineListLeads(listId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return get<{ data: EnrichEngineListDetailResponse }>(
        `${ENDPOINTS.INTEGRATIONS.ENRICHENGINE.LIST_LEADS(listId!)}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId && !!listId,
  });
}

/**
 * Import leads from EnrichEngine list
 */
export function useImportFromEnrichEngine() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: { listId: string; listName?: string }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: ImportResult }>(
        ENDPOINTS.INTEGRATIONS.ENRICHENGINE.IMPORT,
        {
          organizationId: orgId,
          listId: params.listId,
          listName: params.listName,
        }
      );
    },
    onSuccess: () => {
      const orgId = activeOrganization?.data?.id;
      // Invalidate lists to show the new imported list
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-folders'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.enrichEngineStatus(orgId) });
    },
  });
}

// === HubSpot Specific Hooks ===

/**
 * Get HubSpot contacts summary/preview
 */
export function useHubSpotContactsSummary(enabled = false) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.hubspotContactsSummary(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);

      return get<{ data: HubSpotContactsSummary }>(
        `${ENDPOINTS.INTEGRATIONS.HUBSPOT.CONTACTS_SUMMARY}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId && enabled,
  });
}

/**
 * Import contacts from HubSpot
 */
export function useImportFromHubSpot() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();

  return useMutation({
    mutationFn: async (params: {
      listName?: string;
      requirePhone?: boolean;
      maxContacts?: number;
    }) => {
      const orgId = activeOrganization?.data?.id;
      if (!orgId) {
        throw new Error("No active organization");
      }
      return post<{ data: ImportResult }>(
        ENDPOINTS.INTEGRATIONS.HUBSPOT.IMPORT,
        {
          organizationId: orgId,
          listName: params.listName,
          requirePhone: params.requirePhone ?? true,
          maxContacts: params.maxContacts,
        }
      );
    },
    onSuccess: () => {
      const orgId = activeOrganization?.data?.id;
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list-folders'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.integrations(orgId) });
    },
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';

interface LeadClient {
  id: string;
  name: string;
  color: string | null;
}

// Structured AI summary types
export interface AIBusinessContext {
  founded?: string | null;
  size?: string | null;
  funding?: string | null;
  recentNews?: string | null;
  targetCustomers?: string | null;
  products?: string[] | null;
}

export interface StructuredSummary {
  companyOverview: string;
  salesTalkingPoints: string[];
  businessContext: AIBusinessContext;
}

interface Lead {
  id: string;
  organizationId: string;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string;
  normalizedPhone: string | null;
  company: string | null;
  title: string | null;
  linkedInUrl: string | null;
  website: string | null;
  customFields: Record<string, string> | null;
  pipelineStageId: string | null;
  dealValue: string | null;
  aiCompanySummary: string | null;
  // Structured AI summary fields
  aiCompanyOverview: string | null;
  aiSalesTalkingPoints: string[] | null;
  aiBusinessContext: AIBusinessContext | null;
  aiSummaryGeneratedAt: Date | null;
  aiSummaryProvider: string | null;
  clientId: string | null;
  createdById: string | null;
  lastModifiedById: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  client?: LeadClient | null;
  isInCampaign?: boolean;
  enrichmentStatus: string | null;
  enrichmentSources: string[] | null;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

interface SmartFilterParam {
  operator: string;
  value: string | number | boolean | null;
}

interface ListLeadsParams {
  search?: string;
  campaignId?: string;
  clientId?: string;
  pipelineStageId?: string;
  inPipeline?: boolean;
  includeDeleted?: boolean;
  includeClient?: boolean;
  page?: number;
  limit?: number;
  // Smart query filters
  titleFilter?: SmartFilterParam;
  emailFilter?: SmartFilterParam;
  companyFilter?: SmartFilterParam;
  createdAtFilter?: SmartFilterParam;
}

export function useLeads(params: ListLeadsParams = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.leads(orgId), params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);
      if (params.search) searchParams.set('search', params.search);
      if (params.campaignId) searchParams.set('campaignId', params.campaignId);
      if (params.clientId) searchParams.set('clientId', params.clientId);
      if (params.pipelineStageId)
        searchParams.set('pipelineStageId', params.pipelineStageId);
      if (params.inPipeline)
        searchParams.set('inPipeline', 'true');
      if (params.includeDeleted)
        searchParams.set('includeDeleted', 'true');
      if (params.includeClient)
        searchParams.set('includeClient', 'true');
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());
      // Smart query filters - serialize as JSON
      if (params.titleFilter)
        searchParams.set('titleFilter', JSON.stringify(params.titleFilter));
      if (params.emailFilter)
        searchParams.set('emailFilter', JSON.stringify(params.emailFilter));
      if (params.companyFilter)
        searchParams.set('companyFilter', JSON.stringify(params.companyFilter));
      if (params.createdAtFilter)
        searchParams.set('createdAtFilter', JSON.stringify(params.createdAtFilter));

      return await get<PaginatedResponse<Lead>>(
        `${ENDPOINTS.LEADS.LIST}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId,
  });
}

export function useLead(id?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.lead(id),
    queryFn: async () => {
      return await get<Lead>(`${ENDPOINTS.LEADS.GET(id!)}?organizationId=${orgId}`);
    },
    enabled: !!id && !!orgId,
  });
}

export function useCreateLead() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone: string;
      company?: string;
      title?: string;
      linkedInUrl?: string;
      website?: string;
      customFields?: Record<string, string>;
      pipelineStageId?: string;
      dealValue?: number;
    }) => {
      return post<Lead>(ENDPOINTS.LEADS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      // Invalidate pipeline stages to update lead counts
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: {
      id: string;
      firstName?: string;
      lastName?: string;
      email?: string | null;
      phone?: string | null;
      company?: string | null;
      title?: string | null;
      linkedInUrl?: string | null;
      website?: string | null;
      customFields?: Record<string, string>;
      pipelineStageId?: string | null;
      dealValue?: number | null;
      clientId?: string | null;
    }) => {
      const { id, ...data } = params;
      return patch<Lead>(ENDPOINTS.LEADS.UPDATE(id), {
        ...data,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(variables.id) });
      // Invalidate pipeline stages to update lead counts and values
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
      // Cross-view invalidation: sync changes to Lists tab
      queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] === 'list' || query.queryKey[0] === 'listLeads'
      });
    },
  });
}

export function useDeleteLead() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(`${ENDPOINTS.LEADS.DELETE(id)}?organizationId=${orgId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      // Invalidate pipeline stages to update lead counts
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

// CRM: Move lead to different pipeline stage
export function useMoveLead() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async ({ id, pipelineStageId }: { id: string; pipelineStageId: string | null }) => {
      return patch<Lead>(ENDPOINTS.LEADS.MOVE(id), {
        pipelineStageId,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(variables.id) });
      // Invalidate pipeline stages to update lead counts when moving between stages
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

// Campaigns: Lookup lead by phone number
export function useLookupLead() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (phone: string) => {
      return get<Lead>(
        `${ENDPOINTS.LEADS.LOOKUP}?organizationId=${orgId}&phone=${encodeURIComponent(phone)}`
      );
    },
  });
}

// Smart Query types
interface SmartQueryFilters {
  [key: string]: {
    operator: string;
    value: string | number | boolean | null;
  };
}

interface SmartQueryResponse {
  interpretation: {
    filters: SmartQueryFilters;
    humanReadable: string;
  };
  previewCount: number;
  leads?: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string;
    company: string | null;
    title: string | null;
    createdAt: Date;
  }>;
}

interface BulkAddToCampaignResponse {
  success: boolean;
  added: number;
  alreadyInCampaign: number;
}

// Smart Query: Parse natural language query
export function useSmartQuery() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { query: string; previewOnly?: boolean }) => {
      return post<SmartQueryResponse>(ENDPOINTS.LEADS.SMART_QUERY, {
        ...params,
        organizationId: orgId,
      });
    },
  });
}

// Bulk add leads to campaign
export function useBulkAddToCampaign() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { leadIds: string[]; campaignId: string }) => {
      return post<BulkAddToCampaignResponse>(ENDPOINTS.LEADS.BULK_ADD_TO_CAMPAIGN, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaignLeads(variables.campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.campaign(variables.campaignId),
      });
    },
  });
}

// Bulk add to pipeline response type
interface BulkAddToPipelineResponse {
  success: boolean;
  updated: number;
  alreadyInPipeline: number;
}

// Bulk add leads to pipeline stage
export function useBulkAddToPipeline() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { leadIds: string[]; pipelineStageId: string }) => {
      return post<BulkAddToPipelineResponse>(ENDPOINTS.LEADS.BULK_ADD_TO_PIPELINE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() });
    },
  });
}

// Activity types for lead timeline
export interface ActivityItem {
  id: string;
  type: 'call' | 'note' | 'task';
  content: string;
  createdAt: string;
  metadata?: {
    duration?: number;
    recordingUrl?: string | null;
    completed?: boolean;
    status?: string;
    direction?: string;
  };
}

interface ActivityResponse {
  data: ActivityItem[];
}

// Get lead activity timeline
export function useLeadActivity(leadId: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.leadActivity(leadId),
    queryFn: async () => {
      return get<ActivityResponse>(
        `${ENDPOINTS.LEADS.ACTIVITY(leadId)}?organizationId=${orgId}`
      );
    },
    enabled: !!leadId && !!orgId,
  });
}

// Call history for a lead
export interface LeadCall {
  id: string;
  userId: string;
  leadId: string | null;
  campaignId: string | null;
  fromNumber: string;
  toNumber: string;
  direction: 'outbound' | 'inbound';
  status: string;
  duration: number;
  recordingUrl: string | null;
  voicemailDropped: boolean;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  createdAt: string;
  dispositionId: string | null;
  dispositionLabel: string | null;
  dispositionColor: string | null;
}

interface LeadCallsResponse {
  data: LeadCall[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export function useLeadCalls(leadId: string, params: { page?: number; limit?: number } = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.leadCalls(leadId), params],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        organizationId: orgId!,
      });
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());

      return get<LeadCallsResponse>(
        `${ENDPOINTS.LEADS.CALLS(leadId)}?${searchParams.toString()}`
      );
    },
    enabled: !!leadId && !!orgId,
  });
}

// Company summary response type
interface CompanySummaryResponse {
  summary: string;
  cached: boolean;
  noInfoAvailable?: boolean;
  structured?: StructuredSummary;
  provider?: string;
}

// Generate AI company summary for a lead
export function useGenerateCompanySummary() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { leadId: string; forceRegenerate?: boolean }) => {
      return post<CompanySummaryResponse>(
        ENDPOINTS.LEADS.COMPANY_SUMMARY(params.leadId),
        {
          organizationId: orgId,
          forceRegenerate: params.forceRegenerate,
        }
      );
    },
    onSuccess: (data, variables) => {
      // Cache the summary result
      queryClient.setQueryData(
        QUERY_KEYS.leadCompanySummary(variables.leadId),
        data
      );
      // Invalidate the lead to refresh cached summary
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(variables.leadId) });
    },
  });
}

// Timezone resolution response type
interface ResolveTimezoneResponse {
  timezone: string | null;
  cached: boolean;
  location?: string | null;
}

// Resolve timezone from LinkedIn location
export function useResolveTimezone() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (leadId: string) => {
      return post<ResolveTimezoneResponse>(
        ENDPOINTS.LEADS.RESOLVE_TIMEZONE(leadId),
        {
          organizationId: orgId,
        }
      );
    },
    onSuccess: (data, leadId) => {
      // Cache the timezone result
      queryClient.setQueryData(
        QUERY_KEYS.leadTimezone(leadId),
        data
      );
      // Update power dialer next-lead cache to include timezone
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'power-dialer' && query.queryKey[1] === 'next-lead',
      });
    },
  });
}

// Enrich lead response type
interface EnrichLeadResponse {
  extracted: {
    companyName: string | null;
    industry?: string | null;
    description?: string | null;
  };
  updated: boolean;
  lead?: {
    company: string | null;
  };
}

// Enrich lead with company info extracted from website (AI)
export function useEnrichLeadFromWebsite() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (leadId: string) => {
      return post<EnrichLeadResponse>(
        ENDPOINTS.LEADS.ENRICH_FROM_WEBSITE(leadId),
        {
          organizationId: orgId,
        }
      );
    },
    onSuccess: (_, leadId) => {
      // Invalidate the lead to refresh data
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(leadId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) });
    },
  });
}

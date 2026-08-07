'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, patch, del } from '@/lib/api'
import { QUERY_KEYS, ENDPOINTS } from '@/lib/config'
import { useActiveOrganization } from '@/lib/auth-client'
import type {
  VendorConnectionListResponse,
  VendorConnectionResponse,
  EnrichLeadResponse,
  BulkEnrichResponse,
  BulkProspeoListMobileEnrichResponse,
  LeadContactInfoResponse,
  EnrichmentHistoryResponse,
  VendorDataType,
} from '@shared/types/src'

// Local type for test connection response
interface TestVendorConnectionResponse {
  success: boolean
  creditsRemaining?: number
  message?: string
  error?: string
}

// List vendor connections
export function useEnrichmentVendors(enabled = true) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.enrichmentVendors(orgId),
    queryFn: async () => {
      return await get<VendorConnectionListResponse>(
        ENDPOINTS.ENRICHMENT.VENDORS,
      )
    },
    enabled: enabled && !!orgId,
  })
}

// Connect vendor
export function useConnectVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      provider:
        | 'apollo'
        | 'zoominfo'
        | 'clearbit'
        | 'lusha'
        | 'enrichengine'
        | 'prospeo'
        | 'forager'
        | 'leadmagic'
        | 'firecrawl'
      apiKey: string
      priority?: number
      creditsLimit?: number
      enabledDataTypes?: string[]
    }) => {
      return await post<VendorConnectionResponse>(
        ENDPOINTS.ENRICHMENT.VENDORS,
        params,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'vendors'] })
    },
  })
}

// Update vendor connection
export function useUpdateVendorConnection() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      ...data
    }: {
      id: string
      apiKey?: string
      isActive?: boolean
      priority?: number
      creditsLimit?: number
      enabledDataTypes?: string[]
    }) => {
      return await patch<VendorConnectionResponse>(
        ENDPOINTS.ENRICHMENT.VENDOR(id),
        data,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'vendors'] })
    },
  })
}

// Disconnect vendor
export function useDisconnectVendor() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (vendorId: string) => {
      await del(ENDPOINTS.ENRICHMENT.VENDOR(vendorId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'vendors'] })
    },
  })
}

// Test vendor connection
export function useTestVendorConnection() {
  return useMutation({
    mutationFn: async (vendorId: string) => {
      return await post<TestVendorConnectionResponse>(
        ENDPOINTS.ENRICHMENT.VENDOR_TEST(vendorId),
      )
    },
  })
}

// Enrich single lead
export function useEnrichLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      leadId,
      providers,
      dataTypes,
      forceRefresh,
    }: {
      leadId: string
      providers?: string[]
      dataTypes?: VendorDataType[]
      forceRefresh?: boolean
    }) => {
      return await post<EnrichLeadResponse>(
        ENDPOINTS.ENRICHMENT.LEAD_ENRICH(leadId),
        {
          providers,
          dataTypes,
          forceRefresh,
        },
      )
    },
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.leadContactInfo(leadId),
      })
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'history'] })
    },
  })
}

// Bulk enrich leads
export function useBulkEnrich() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[]
      providers?: string[]
      dataTypes?: VendorDataType[]
      forceRefresh?: boolean
    }) => {
      return await post<BulkEnrichResponse>(
        ENDPOINTS.ENRICHMENT.BULK_ENRICH,
        params,
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'history'] })
    },
  })
}

export function useBulkProspeoListMobileEnrich() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      listId,
      leadIds,
    }: {
      listId: string
      leadIds?: string[]
    }) => {
      return await post<BulkProspeoListMobileEnrichResponse>(
        ENDPOINTS.ENRICHMENT.PROSPEO_LIST_MOBILE(listId),
        leadIds?.length ? { leadIds } : {},
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.listLeads(variables.listId),
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.list(variables.listId),
      })
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'history'] })
      variables.leadIds?.forEach((leadId) => {
        queryClient.invalidateQueries({ queryKey: ['lead', leadId] })
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.leadContactInfo(leadId),
        })
      })
    },
  })
}

// Get lead contact info
export function useLeadContactInfo(leadId: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.leadContactInfo(leadId),
    queryFn: async () => {
      return await get<LeadContactInfoResponse>(
        ENDPOINTS.ENRICHMENT.LEAD_CONTACTS(leadId),
      )
    },
    enabled: enabled && !!leadId,
  })
}

interface EnrichmentHistoryFilters {
  leadId?: string
  provider?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

// Get enrichment history
export function useEnrichmentHistory(
  filters?: EnrichmentHistoryFilters,
  enabled = true,
) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.enrichmentHistory(
      orgId,
      filters as Record<string, unknown>,
    ),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filters?.leadId) params.set('leadId', filters.leadId)
      if (filters?.provider) params.set('provider', filters.provider)
      if (filters?.startDate) params.set('startDate', filters.startDate)
      if (filters?.endDate) params.set('endDate', filters.endDate)
      if (filters?.page) params.set('page', filters.page.toString())
      if (filters?.limit) params.set('limit', filters.limit.toString())

      const url = `${ENDPOINTS.ENRICHMENT.HISTORY}?${params.toString()}`
      return await get<EnrichmentHistoryResponse>(url)
    },
    enabled: enabled && !!orgId,
  })
}

// Enrich all leads in a list (paginated bulk enrich)
export function useEnrichList() {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useMutation({
    mutationFn: async ({
      listId,
      providers,
      dataTypes,
    }: {
      listId: string
      providers?: string[]
      dataTypes?: VendorDataType[]
    }) => {
      let page = 1
      let totalRequested = 0
      let totalEnriched = 0
      let totalFailed = 0
      let totalSkipped = 0
      let totalCredits = 0

      while (true) {
        const params = new URLSearchParams({
          organizationId: orgId!,
          page: page.toString(),
          limit: '100',
        })
        const leadsPage = await get<{
          data: { id: string }[]
          pagination: { hasNextPage: boolean }
        }>(`${ENDPOINTS.LISTS.LEADS(listId)}?${params}`)

        const leadIds = leadsPage.data.map((l) => l.id)
        if (leadIds.length === 0) break
        totalRequested += leadIds.length

        const result = await post<BulkEnrichResponse>(
          ENDPOINTS.ENRICHMENT.BULK_ENRICH,
          { leadIds, providers, dataTypes },
        )
        totalEnriched += result.totalEnriched
        totalFailed += result.totalFailed
        totalSkipped += result.results.filter(
          (leadResult) =>
            leadResult.success &&
            leadResult.fieldsEnriched.length === 0 &&
            leadResult.creditsUsed === 0,
        ).length
        totalCredits += result.totalCreditsUsed

        if (!leadsPage.pagination.hasNextPage) break
        page++
      }

      return {
        totalRequested,
        totalEnriched,
        totalFailed,
        totalSkipped,
        totalCredits,
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['enrichment', 'history'] })
    },
  })
}

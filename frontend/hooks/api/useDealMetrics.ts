import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/lib/auth-client'
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config'
import { get, post } from '@/lib/api'
import type {
  DealMetricsResponse,
  DealSignal,
  HubSpotReconcileReport,
  HubSpotSyncStatus,
  SetDealOutcomeRequest,
  SetDealOutcomeResponse,
  SyncDealSignalsRequest,
} from '@shared/types/src/requests/dealMetrics'

interface UseDealMetricsOptions {
  startDate: string
  endDate: string
  clientId?: string
  enabled?: boolean
}

/** Pipeline velocity, stage conversion, deal size, next steps, champions, win/loss. */
export function useDealMetrics({
  startDate,
  endDate,
  clientId,
  enabled = true,
}: UseDealMetricsOptions) {
  const orgId = useActiveOrganization()?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.dealMetrics(orgId, startDate, endDate, clientId),
    queryFn: async () => {
      const params = new URLSearchParams({ startDate, endDate })
      if (clientId) params.set('clientId', clientId)
      return get<{ data: DealMetricsResponse }>(
        `${ENDPOINTS.DEAL_METRICS.BASE}?${params.toString()}`,
      )
    },
    enabled: enabled && !!orgId && !!startDate && !!endDate,
    staleTime: 60_000,
  })
}

export function useLeadDealSignals(leadId: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.leadDealSignals(leadId),
    queryFn: () =>
      get<{ data: DealSignal[] }>(ENDPOINTS.DEAL_METRICS.SIGNALS(leadId!)),
    enabled: !!leadId,
  })
}

/** Close a deal as won/lost with a reason; the backend moves it to the matching stage. */
export function useSetDealOutcome() {
  const queryClient = useQueryClient()
  const orgId = useActiveOrganization()?.data?.id

  return useMutation({
    mutationFn: ({ leadId, ...body }: SetDealOutcomeRequest) =>
      post<{ data: SetDealOutcomeResponse }>(
        ENDPOINTS.DEAL_METRICS.OUTCOME(leadId),
        body,
      ),
    onSuccess: (_, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: ['deal-metrics'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(leadId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() })
    },
  })
}

export function useSyncDealSignals() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Partial<SyncDealSignalsRequest> = {}) =>
      post<{ data: Record<string, unknown> }>(ENDPOINTS.DEAL_METRICS.SYNC, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-metrics'] })
    },
  })
}

export function useConnectGrain() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (apiToken: string) =>
      post<{ data: { connected: boolean } }>(
        ENDPOINTS.DEAL_METRICS.GRAIN_CONNECT,
        { apiToken },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['deal-metrics'] })
    },
  })
}

/** HubSpot two-way sync health. Only fetched when HubSpot is connected. */
export function useHubSpotSyncStatus(enabled: boolean) {
  const orgId = useActiveOrganization()?.data?.id
  return useQuery({
    queryKey: QUERY_KEYS.hubspotSyncStatus(orgId),
    queryFn: () => get<{ data: HubSpotSyncStatus }>(ENDPOINTS.DEAL_METRICS.HUBSPOT_STATUS),
    enabled: enabled && !!orgId,
    staleTime: 30_000,
  })
}

/** Compare every linked lead with HubSpot; `fix` converges both sides. */
export function useReconcileHubSpot() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (fix: boolean) =>
      post<{ data: HubSpotReconcileReport }>(ENDPOINTS.DEAL_METRICS.HUBSPOT_RECONCILE, { fix }),
    onSuccess: (_, fix) => {
      queryClient.invalidateQueries({ queryKey: ['deal-metrics'] })
      if (fix) queryClient.invalidateQueries({ queryKey: ['leads'] })
    },
  })
}

/** Add OmniDial stages missing from HubSpot's stage dropdown, then re-map. */
export function useSyncHubSpotStages() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      post<{ data: { added: string[]; unmatched: string[] } }>(ENDPOINTS.DEAL_METRICS.HUBSPOT_STAGES_SYNC, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deal-metrics'] }),
  })
}

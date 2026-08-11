import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/lib/auth-client'
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config'
import { get, post } from '@/lib/api'
import type {
  CrmBulkPushResponse,
  CrmConnectionItem,
  CrmPresenceItem,
  CrmProvider,
  CrmPushResponse,
  CrmSyncAllResponse,
} from '@shared/types/src/requests/crmSync'

export function useConnectedCrms() {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.connectedCrms(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('organizationId', orgId!)

      return get<{ data: CrmConnectionItem[] }>(
        `${ENDPOINTS.CRM.CONNECTED}?${searchParams.toString()}`,
      )
    },
    enabled: !!orgId,
  })
}

export function useCrmPresence(leadId?: string) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.crmPresence(orgId, leadId),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('organizationId', orgId!)
      searchParams.set('leadId', leadId!)

      return get<{ data: CrmPresenceItem[] }>(
        `${ENDPOINTS.CRM.PRESENCE}?${searchParams.toString()}`,
      )
    },
    enabled: !!orgId && !!leadId,
  })
}

export function useCrmPushLead() {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useMutation({
    mutationFn: async (params: { leadId: string; provider: CrmProvider }) => {
      if (!orgId) {
        throw new Error('No active organization')
      }

      return post<{ data: CrmPushResponse }>(ENDPOINTS.CRM.PUSH, {
        organizationId: orgId,
        leadId: params.leadId,
        provider: params.provider,
      })
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.crmPresence(orgId, variables.leadId),
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.lead(variables.leadId),
      })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
    },
  })
}

export function useCrmSyncAllLeads() {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useMutation({
    mutationFn: async (params: {
      provider: CrmProvider
      clientId?: string
    }) => {
      if (!orgId) {
        throw new Error('No active organization')
      }

      return post<{ data: CrmSyncAllResponse }>(ENDPOINTS.CRM.SYNC_ALL, {
        organizationId: orgId,
        provider: params.provider,
        ...(params.clientId ? { clientId: params.clientId } : {}),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() })
    },
  })
}

export function useCrmBulkPushLeads() {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[]
      provider: CrmProvider
    }) => {
      if (!orgId) {
        throw new Error('No active organization')
      }

      return post<{ data: CrmBulkPushResponse }>(ENDPOINTS.CRM.BULK_PUSH, {
        organizationId: orgId,
        leadIds: params.leadIds,
        provider: params.provider,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.pipelineStages() })
    },
  })
}

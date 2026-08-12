'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/lib/auth-client'
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config'
import { get, post } from '@/lib/api'
import type {
  DncEntryItem,
  MarkLeadsDncResponse,
  RemoveCampaignLeadsResponse,
} from '@shared/types/src/requests/dnc'

export function useDncEntries() {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.dncEntries(orgId),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('organizationId', orgId!)

      const response = await get<{ data: DncEntryItem[] }>(
        `${ENDPOINTS.DNC.LIST}?${searchParams.toString()}`,
      )
      return response?.data ?? []
    },
    enabled: !!orgId,
  })
}

/**
 * Suppress leads org-wide and drop them from campaigns and lists.
 * Invalidates broadly because campaign counts and queues all shift.
 */
export function useMarkLeadsDnc() {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useMutation({
    mutationFn: async (params: {
      leadIds: string[]
      reason?: string | null
    }) => {
      if (!orgId) throw new Error('No active organization')

      const response = await post<{ data: MarkLeadsDncResponse }>(
        ENDPOINTS.DNC.MARK,
        { organizationId: orgId, ...params },
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.dncEntries(orgId) })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
      queryClient.invalidateQueries({ queryKey: ['campaign'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: ['lists'] })
    },
  })
}

export function useRemoveCampaignLeads() {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useMutation({
    mutationFn: async (params: {
      campaignId: string
      leadIds: string[]
    }) => {
      if (!orgId) throw new Error('No active organization')

      const response = await post<{ data: RemoveCampaignLeadsResponse }>(
        ENDPOINTS.DNC.REMOVE_CAMPAIGN_LEADS,
        { organizationId: orgId, ...params },
      )
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign'] })
      queryClient.invalidateQueries({ queryKey: ['campaigns'] })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
    },
  })
}

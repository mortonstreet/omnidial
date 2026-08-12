'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useActiveOrganization } from '@/lib/auth-client'
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config'
import { del, get, patch, post } from '@/lib/api'
import type {
  ContactMethodItem,
  ContactMethodKind,
} from '@shared/types/src/requests/leadContactMethod'

/** Every way to reach a lead: the primary email/phone plus any extras. */
export function useContactMethods(leadId?: string) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return useQuery({
    queryKey: QUERY_KEYS.leadContactMethods(leadId),
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('organizationId', orgId!)

      const response = await get<{ data: ContactMethodItem[] }>(
        `${ENDPOINTS.LEADS.CONTACT_METHODS(leadId!)}?${searchParams.toString()}`,
      )
      return response?.data ?? []
    },
    enabled: !!orgId && !!leadId,
  })
}

/** Invalidate the list plus the lead itself, whose primary may have moved. */
const useContactMethodInvalidation = (leadId?: string) => {
  const queryClient = useQueryClient()
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id

  return () => {
    queryClient.invalidateQueries({
      queryKey: QUERY_KEYS.leadContactMethods(leadId),
    })
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lead(leadId) })
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.leads(orgId) })
  }
}

export function useAddContactMethod(leadId?: string) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id
  const invalidate = useContactMethodInvalidation(leadId)

  return useMutation({
    mutationFn: async (params: {
      kind: ContactMethodKind
      value: string
      label?: string | null
    }) => {
      if (!orgId || !leadId) throw new Error('No active organization or lead')

      const response = await post<{ data: ContactMethodItem }>(
        ENDPOINTS.LEADS.CONTACT_METHODS(leadId),
        { organizationId: orgId, leadId, ...params },
      )
      return response.data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateContactMethod(leadId?: string) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id
  const invalidate = useContactMethodInvalidation(leadId)

  return useMutation({
    mutationFn: async (params: {
      id: string
      value?: string
      label?: string | null
      isPrimary?: boolean
    }) => {
      if (!orgId) throw new Error('No active organization')

      const { id, ...body } = params
      const response = await patch<{ data: ContactMethodItem }>(
        ENDPOINTS.LEADS.CONTACT_METHOD(id),
        { organizationId: orgId, id, ...body },
      )
      return response.data
    },
    onSuccess: invalidate,
  })
}

export function useDeleteContactMethod(leadId?: string) {
  const activeOrganization = useActiveOrganization()
  const orgId = activeOrganization?.data?.id
  const invalidate = useContactMethodInvalidation(leadId)

  return useMutation({
    mutationFn: async (id: string) => {
      if (!orgId) throw new Error('No active organization')

      const searchParams = new URLSearchParams()
      searchParams.set('organizationId', orgId)

      return del<{ success: boolean }>(
        `${ENDPOINTS.LEADS.CONTACT_METHOD(id)}?${searchParams.toString()}`,
      )
    },
    onSuccess: invalidate,
  })
}

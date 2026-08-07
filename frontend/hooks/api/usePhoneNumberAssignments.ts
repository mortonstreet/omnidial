'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { get, post, del } from '@/lib/api'
import { QUERY_KEYS, ENDPOINTS } from '@/lib/config'
import type {
  PhoneNumberWithAssignment,
  DialablePhoneNumber,
  UserPhoneNumberResponse,
} from '@shared/types/src'

// Hook for fetching phone numbers with assignment status (admin settings)
export function usePhoneNumberAssignments(organizationId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.phoneNumberAssignments(organizationId),
    queryFn: async () => {
      if (!organizationId) return []
      const response = await get<{ data: PhoneNumberWithAssignment[] }>(
        ENDPOINTS.DIALER.PHONE_NUMBER_ASSIGNMENTS(organizationId),
      )
      return response?.data ?? []
    },
    enabled: !!organizationId,
  })
}

// Hook for assigning a phone number to a rep. Reassigning moves the number —
// a number has exactly one owner, so this replaces any previous assignment.
export function useAssignPhoneNumber() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      organizationId: string
      userId: string
      phoneNumber: string
      friendlyName?: string
    }) => {
      const response = await post<{ data: UserPhoneNumberResponse }>(
        ENDPOINTS.DIALER.ASSIGN_PHONE_NUMBER,
        params,
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.phoneNumberAssignments(variables.organizationId),
      })
      // Invalidate all dialable phone numbers queries for this org
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'dialable-phone-numbers' &&
          query.queryKey[1] === variables.organizationId,
      })
    },
  })
}

// Hook for unassigning a phone number
export function useUnassignPhoneNumber() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      organizationId: string
      phoneNumber: string
    }) => {
      await del(
        ENDPOINTS.DIALER.UNASSIGN_PHONE_NUMBER(
          params.organizationId,
          params.phoneNumber,
        ),
      )
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.phoneNumberAssignments(variables.organizationId),
      })
      // Invalidate all dialable phone numbers queries for this org
      queryClient.invalidateQueries({
        predicate: (query) =>
          query.queryKey[0] === 'dialable-phone-numbers' &&
          query.queryKey[1] === variables.organizationId,
      })
    },
  })
}

/**
 * Caller IDs the signed-in rep may dial from.
 *
 * No client argument: numbers belong to the user, not the client being worked,
 * so two reps on the same client can no longer be handed the same number. The
 * server derives the user from the session and independently rejects any call
 * placed from a number the rep doesn't own.
 */
export function useDialablePhoneNumbers(organizationId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.dialablePhoneNumbers(organizationId),
    queryFn: async () => {
      if (!organizationId) return []
      const response = await get<{ data: DialablePhoneNumber[] }>(
        ENDPOINTS.DIALER.DIALABLE_PHONE_NUMBERS(organizationId),
      )
      return response?.data ?? []
    },
    enabled: !!organizationId,
  })
}

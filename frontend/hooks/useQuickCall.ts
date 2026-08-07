'use client'

import { useState, useCallback } from 'react'
import { useDialerContext } from '@/components/providers/DialerProvider'
import { useActiveOrganization } from '@/lib/auth-client'
import { get } from '@/lib/api'
import { ENDPOINTS } from '@/lib/config'
import { toast } from 'sonner'
import type { DialablePhoneNumber } from '@shared/types/src'

interface QuickCallParams {
  leadId: string
  leadName: string
  phone: string
  clientId?: string | null
}

export function useQuickCall() {
  const [isDialing, setIsDialing] = useState(false)

  const activeOrganization = useActiveOrganization()
  const organizationId = activeOrganization?.data?.id

  const {
    callState,
    device,
    isReady,
    initializeDevice,
    makeCall,
    setCurrentLeadInfo,
  } = useDialerContext()

  // Pre-fetch org phone numbers as fallback

  const quickCall = useCallback(
    async ({ leadId, leadName, phone, clientId }: QuickCallParams) => {
      if (callState !== 'idle' || isDialing) {
        toast.error('Already in a call', {
          description: 'Please end the current call before starting a new one',
        })
        return
      }

      setIsDialing(true)

      try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch {
        toast.error('Microphone access required', {
          description: 'Please allow microphone access to make calls',
        })
        setIsDialing(false)
        return
      }

      // Initialize device if not ready
      if (!device || !isReady) {
        const success = await initializeDevice()
        if (!success) {
          toast.error('Failed to connect to dialer', {
            description: 'Please check your Telnyx configuration and try again',
          })
          setIsDialing(false)
          return
        }
      }

      try {
        // Resolve caller ID
        let fromNumber: string | undefined

        if (organizationId) {
          try {
            const response = await get<{ data: DialablePhoneNumber[] }>(
              ENDPOINTS.DIALER.DIALABLE_PHONE_NUMBERS(organizationId),
            )
            fromNumber = response?.data?.[0]?.phoneNumber
          } catch {
            // Leave unset — handled below.
          }
        }

        // No org-number fallback: the server only accepts a caller ID assigned
        // to this rep, so falling back would just produce a rejected call.
        if (!fromNumber) {
          toast.error('No caller ID assigned to you', {
            description:
              'Ask an admin to assign you a phone number in dialer settings',
          })
          setIsDialing(false)
          return
        }

        // Set lead info for the floating widget
        setCurrentLeadInfo({
          id: leadId,
          name: leadName,
          phone,
        })

        await makeCall(phone, leadId, undefined, fromNumber)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error('Failed to place call', { description: message })
      } finally {
        setIsDialing(false)
      }
    },
    [
      callState,
      isDialing,
      device,
      isReady,
      initializeDevice,
      makeCall,
      setCurrentLeadInfo,
      organizationId,
    ],
  )

  return { quickCall, isDialing }
}

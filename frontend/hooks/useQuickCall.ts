'use client'

import { useState, useCallback } from 'react'
import { useDialerContext } from '@/components/providers/DialerProvider'
import { toast } from 'sonner'

interface QuickCallParams {
  leadId: string
  leadName: string
  phone: string
  clientId?: string | null
}

export function useQuickCall() {
  const [isDialing, setIsDialing] = useState(false)

  const {
    callState,
    device,
    isReady,
    initializeDevice,
    makeCall,
    setCurrentLeadInfo,
  } = useDialerContext()

  const quickCall = useCallback(
    async ({ leadId, leadName, phone }: QuickCallParams) => {
      const hasActiveCall =
        callState === 'initiated' ||
        callState === 'ringing' ||
        callState === 'in-progress'

      if (hasActiveCall || isDialing) {
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
        // Set lead info for the floating widget
        setCurrentLeadInfo({
          id: leadId,
          name: leadName,
          phone,
        })

        await makeCall(phone, leadId)
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
    ],
  )

  return { quickCall, isDialing }
}

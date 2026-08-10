'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Phone, PhoneOff, MicOff, Mic, Loader2, X } from 'lucide-react'
import { useDialablePhoneNumbers } from '@/hooks/api/usePhoneNumberAssignments'
import { useActiveOrganization } from '@/lib/auth-client'
import { useDialerContext } from '@/components/providers/DialerProvider'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface DirectCallDialogProps {
  isOpen: boolean
  onClose: () => void
  phoneNumber: string
  leadId: string
  leadName: string
  clientId?: string
}

export function DirectCallDialog({
  isOpen,
  onClose,
  phoneNumber,
  leadId,
  leadName,
}: DirectCallDialogProps) {
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isDialing, setIsDialing] = useState(false)

  const activeOrganization = useActiveOrganization()
  const organizationId = activeOrganization?.data?.id

  const {
    device,
    connection,
    callState,
    isReady,
    initializeDevice,
    makeCall,
    endCall,
    toggleMute,
    setCurrentLeadInfo,
  } = useDialerContext()

  // The rep's own caller IDs — not the client's. See DialerPanel for why there
  // is no fallback to every org number.
  const { data: phoneNumbers, isLoading: phoneNumbersLoading } =
    useDialablePhoneNumbers(organizationId)
  const assignedCallerIdCount = phoneNumbers?.length ?? 0
  const hasAssignedCallerIds = assignedCallerIdCount > 0

  // Reset transient call UI when the dialog opens.
  useEffect(() => {
    if (isOpen) {
      setIsMuted(false)
      setCallDuration(0)
    }
  }, [isOpen])

  // Track previous call state for transition handling
  const prevCallStateRef = useRef(callState)

  // Call duration timer
  useEffect(() => {
    const prevCallState = prevCallStateRef.current
    prevCallStateRef.current = callState

    let timer: NodeJS.Timeout
    if (callState === 'in-progress') {
      if (prevCallState !== 'in-progress') {
        timer = setInterval(() => {
          setCallDuration((prev) => (prev === 0 ? 1 : prev + 1))
        }, 1000)
      } else {
        timer = setInterval(() => {
          setCallDuration((prev) => prev + 1)
        }, 1000)
      }
    }

    // Handle state transitions
    if (prevCallState !== callState) {
      if (callState === 'idle') {
        setCallDuration(0)
      }
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [callState])

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleCall = useCallback(async () => {
    if (callState === 'idle' && phoneNumber && !isDialing) {
      setIsDialing(true)

      try {
        // Request microphone permission
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (err) {
        console.error('Microphone permission denied:', err)
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
        if (phoneNumbersLoading || !hasAssignedCallerIds) {
          toast.error('No caller ID assigned to you', {
            description: 'Ask an admin to assign you a phone number',
          })
          setIsDialing(false)
          return
        }

        // Set current lead info for the floating widget
        setCurrentLeadInfo({
          id: leadId,
          name: leadName,
          phone: phoneNumber,
        })

        await makeCall(phoneNumber, leadId)
      } catch (err) {
        console.error('Failed to make call:', err)
        const message = err instanceof Error ? err.message : 'Unknown error'
        toast.error('Failed to place call', {
          description: message,
        })
      } finally {
        setIsDialing(false)
      }
    }
  }, [
    callState,
    phoneNumber,
    leadId,
    leadName,
    makeCall,
    phoneNumbersLoading,
    hasAssignedCallerIds,
    device,
    isReady,
    initializeDevice,
    isDialing,
    setCurrentLeadInfo,
  ])

  const handleEndCall = useCallback(async () => {
    try {
      await endCall()
    } catch (err) {
      console.error('Failed to end call:', err)
      toast.error('Failed to end call', {
        description: 'The call may have already ended',
      })
    }
  }, [endCall])

  const handleToggleMute = useCallback(() => {
    toggleMute()
    setIsMuted(!isMuted)
  }, [toggleMute, isMuted])

  // Sync mute state with connection
  useEffect(() => {
    if (connection) {
      setIsMuted(connection.isAudioMuted)
    }
  }, [connection])

  const isCallActive =
    callState === 'ringing' ||
    callState === 'in-progress' ||
    callState === 'initiated'
  const canClose = !isCallActive

  const handleOpenChange = (open: boolean) => {
    if (!open && canClose) {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={canClose}
        onPointerDownOutside={(e) => {
          if (!canClose) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (!canClose) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Call {leadName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Recording indicator */}
          {isCallActive && (
            <div className="flex items-center justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 uppercase tracking-wide font-medium">
                  Recording
                </span>
              </div>
            </div>
          )}

          {/* Call duration/status */}
          <div className="text-center">
            <div className="text-4xl font-mono text-foreground tabular-nums">
              {formatDuration(callDuration)}
            </div>
            {callState !== 'idle' && (
              <div className="text-sm text-muted-foreground mt-1 capitalize">
                {callState.replace('-', ' ')}
              </div>
            )}
          </div>

          {/* Phone number display */}
          <div className="text-center">
            <div className="text-sm text-muted-foreground mb-1">
              {isCallActive ? 'Connected to' : 'Calling'}
            </div>
            <div className="text-lg font-mono">{phoneNumber}</div>
          </div>

          {/* Caller ID status - selected by the backend per call */}
          {!isCallActive && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-2">
                Caller ID
              </label>
              {phoneNumbersLoading ? (
                <div className="flex items-center justify-center py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading numbers...
                  </span>
                </div>
              ) : phoneNumbers && phoneNumbers.length > 0 ? (
                <div className="rounded-lg border border-border/50 bg-muted/60 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-foreground">
                      Auto-rotating assigned numbers
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {assignedCallerIdCount} available
                    </span>
                  </div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {phoneNumbers.map((phone) => phone.phoneNumber).join(', ')}
                  </div>
                </div>
              ) : (
                <div className="text-center py-2">
                  <span className="text-sm text-amber-500">
                    No caller ID assigned to you — ask an admin to assign one
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Call controls */}
          <div className="flex items-center justify-center gap-4">
            {isCallActive && (
              <button
                onClick={handleToggleMute}
                aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${
                  isMuted
                    ? 'bg-amber-500 ring-4 ring-amber-500/20 text-white'
                    : 'bg-muted/80 border border-border/50 hover:bg-muted text-foreground'
                }`}
              >
                {isMuted ? (
                  <MicOff className="w-6 h-6" />
                ) : (
                  <Mic className="w-6 h-6" />
                )}
              </button>
            )}

            {isCallActive ? (
              <button
                onClick={handleEndCall}
                aria-label="End call"
                className="w-16 h-16 flex items-center justify-center rounded-full bg-rose-500 hover:bg-rose-400 text-white transition-all hover:shadow-lg hover:shadow-rose-500/30"
              >
                <PhoneOff className="w-7 h-7" />
              </button>
            ) : (
              <button
                onClick={handleCall}
                disabled={
                  !phoneNumber ||
                  isDialing ||
                  phoneNumbersLoading ||
                  !hasAssignedCallerIds
                }
                aria-label={isDialing ? 'Dialing...' : 'Start call'}
                className={`w-16 h-16 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none ${
                  phoneNumber &&
                  !isDialing &&
                  !phoneNumbersLoading &&
                  hasAssignedCallerIds
                    ? 'animate-pulse'
                    : ''
                }`}
              >
                {isDialing ? (
                  <Loader2 className="w-7 h-7 animate-spin" />
                ) : (
                  <Phone className="w-7 h-7" />
                )}
              </button>
            )}

            {/* Close button when call is active - navigates to floating widget */}
            {isCallActive && (
              <button
                onClick={onClose}
                aria-label="Minimize to widget"
                className="w-14 h-14 flex items-center justify-center rounded-full bg-muted/80 border border-border/50 hover:bg-muted text-foreground transition-all"
                title="Continue call in floating widget"
              >
                <X className="w-6 h-6" />
              </button>
            )}
          </div>

          {/* Hint text */}
          {isCallActive && (
            <p className="text-xs text-muted-foreground text-center">
              Close this dialog to continue the call with the floating widget
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

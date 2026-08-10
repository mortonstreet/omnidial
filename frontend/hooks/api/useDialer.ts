'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TelnyxRTC, Call, INotification } from '@telnyx/webrtc'
import { get, post, patch } from '@/lib/api'
import { QUERY_KEYS, ENDPOINTS, env } from '@/lib/config'
import type { CapabilityTokenResponse } from '@shared/types/src'

// SIP domain of the backend's TeXML application (from the token response)
let telnyxSipDomain: string | null = null

const DIALER_TONE_URL = backendStaticUrl('/static/audio/us-ringback.ogg')

function backendStaticUrl(path: string): string {
  const url = new URL(env.API_URL)
  url.pathname = url.pathname.replace(/\/api\/?$/, '')
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`
  url.search = ''
  return url.toString()
}

function requireSipDomain(sipDomain = telnyxSipDomain): string {
  const normalized = sipDomain?.trim()
  if (!normalized) {
    throw new Error(
      'Telnyx browser calling is not configured. Please contact your administrator.',
    )
  }
  return normalized
}

function buildSipDestination(target: string): string {
  return `sip:${target}@${requireSipDomain()}`
}

type CallState =
  | 'idle'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
type TelnyxConnection = Call

const REMOTE_AUDIO_ELEMENT_ID = 'remote-audio'

interface UseDialerReturn {
  device: TelnyxRTC | null
  connection: TelnyxConnection | null
  callState: CallState
  currentCallId: string | null
  incomingCall: TelnyxConnection | null
  isReady: boolean
  error: string | null
  initializeDevice: () => Promise<boolean>
  makeCall: (
    toNumber: string,
    leadId?: string,
    campaignId?: string,
  ) => Promise<void>
  endCall: () => Promise<void>
  answerIncomingCall: () => void
  rejectIncomingCall: () => void
  toggleMute: () => void
}

export function useDialer(): UseDialerReturn {
  const [device, setDevice] = useState<TelnyxRTC | null>(null)
  const [connection, setConnection] = useState<TelnyxConnection | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<TelnyxConnection | null>(
    null,
  )
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deviceRef = useRef<TelnyxRTC | null>(null)
  const queryClient = useQueryClient()

  // Call tracking refs (Telnyx delivers call state via telnyx.notification events)
  const activeCallIdRef = useRef<string | null>(null)
  const incomingCallIdRef = useRef<string | null>(null)
  const terminatedCallIdsRef = useRef<Set<string>>(new Set())

  // Fetch capability token
  const { data: _tokenData, refetch: refetchToken } = useQuery({
    queryKey: QUERY_KEYS.dialerToken(),
    queryFn: async () => {
      const response = await get<{ data: CapabilityTokenResponse }>(
        ENDPOINTS.DIALER.TOKEN,
      )
      return response.data
    },
    enabled: false,
    staleTime: 1000 * 60 * 50, // Token is valid for 1 hour, refresh at 50 mins
  })

  // Central handler for Telnyx callUpdate notifications
  const handleCallUpdate = useCallback((call: Call) => {
    const state = call.state
    const isInbound = (call.direction as unknown as string) === 'inbound'

    // Inbound calls that haven't been answered yet
    if (isInbound && call.id !== activeCallIdRef.current) {
      if (state === 'hangup' || state === 'destroy' || state === 'purge') {
        if (incomingCallIdRef.current === call.id) {
          incomingCallIdRef.current = null
          setIncomingCall(null)
          setCallState('idle')
        }
        return
      }

      if (state === 'active' || state === 'answering') {
        if (incomingCallIdRef.current === call.id && state === 'active') {
          incomingCallIdRef.current = null
          activeCallIdRef.current = call.id
          setConnection(call)
          setCallState('in-progress')
          setIncomingCall(null)
        }
        return
      }

      if (incomingCallIdRef.current !== call.id) {
        incomingCallIdRef.current = call.id
        setIncomingCall(call)
      }
      return
    }

    // Active (outbound or answered) call
    if (call.id !== activeCallIdRef.current) return
    if (terminatedCallIdsRef.current.has(call.id)) return

    switch (state) {
      case 'ringing':
      case 'early': {
        console.log('Call ringing')
        setCallState('ringing')
        break
      }
      case 'active': {
        console.log('Call accepted')
        setCallState('in-progress')
        break
      }
      case 'hangup':
      case 'destroy': {
        terminatedCallIdsRef.current.add(call.id)
        if (terminatedCallIdsRef.current.size > 100) {
          terminatedCallIdsRef.current.clear()
          terminatedCallIdsRef.current.add(call.id)
        }
        activeCallIdRef.current = null
        // Log disconnect details to help debug abrupt call endings
        console.log('Call disconnected')
        console.log('Disconnect reason:', call.cause || 'unknown')
        setConnection(null)
        setCallState('completed')
        // Auto-reset to idle after a brief moment for disposition handling
        setTimeout(() => {
          setCallState((prev) => (prev === 'completed' ? 'idle' : prev))
          setCurrentCallId(null)
        }, 3000)
        break
      }
      default:
        break
    }
  }, [])

  // Initialize Telnyx client - returns promise that resolves when device is ready
  const initializeDevice = useCallback(async (): Promise<boolean> => {
    try {
      setError(null)
      const { data } = await refetchToken()

      if (!data?.token) {
        throw new Error('Failed to get capability token')
      }

      telnyxSipDomain = requireSipDomain(data.sipDomain)

      // Clean up existing device
      if (deviceRef.current) {
        deviceRef.current.disconnect().catch(() => {
          // Ignore disconnect errors during re-init
        })
        deviceRef.current = null
      }

      const newDevice = new TelnyxRTC({
        login_token: data.token,
        ringtoneFile: DIALER_TONE_URL,
        ringbackFile: DIALER_TONE_URL,
      })
      newDevice.remoteElement = REMOTE_AUDIO_ELEMENT_ID

      // Create a promise that resolves when the client is ready (registered)
      let settled = false
      const registeredPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          settled = true
          reject(new Error('Device registration timeout'))
        }, 10000)

        newDevice.on('telnyx.ready', () => {
          clearTimeout(timeout)
          settled = true
          setIsReady(true)
          console.log('Telnyx client registered')
          resolve()
        })

        newDevice.on('telnyx.error', (event) => {
          const telnyxErr = event?.error
          console.error('Telnyx client error:', telnyxErr ?? event)
          setError(telnyxErr?.message ?? 'Telnyx client error')
          if (!settled) {
            clearTimeout(timeout)
            settled = true
            reject(
              telnyxErr instanceof Error
                ? telnyxErr
                : new Error(telnyxErr?.message ?? 'Telnyx client error'),
            )
          }
        })
      })

      newDevice.on('telnyx.socket.close', () => {
        setIsReady(false)
        console.log('Telnyx client unregistered (socket closed)')
      })

      newDevice.on('telnyx.notification', (notification: INotification) => {
        if (notification.type === 'callUpdate' && notification.call) {
          handleCallUpdate(notification.call)
        }
      })

      Promise.resolve(newDevice.connect()).catch((err) => {
        console.error('Telnyx connect() failed:', err)
      })
      deviceRef.current = newDevice
      setDevice(newDevice)

      // Wait for the ready event
      await registeredPromise
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to initialize device'
      setError(message)
      console.error('Failed to initialize Telnyx client:', err)
      return false
    }
  }, [refetchToken, handleCallUpdate])

  // Initiate call mutation
  const initiateCallMutation = useMutation({
    mutationFn: async (params: {
      toNumber: string
      leadId?: string
      campaignId?: string
    }) => {
      const response = await post<{
        data: { id: string; twilioCallSid: string | null; fromNumber: string }
      }>(ENDPOINTS.CALLS.CREATE, params)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() })
    },
  })

  // Make outbound call - uses deviceRef to avoid stale closure issues
  const makeCall = useCallback(
    async (toNumber: string, leadId?: string, campaignId?: string) => {
      const currentDevice = deviceRef.current
      if (!currentDevice) {
        throw new Error('Device not ready')
      }

      try {
        requireSipDomain()
        setCallState('initiated')

        // First, create call record in backend
        const callData = await initiateCallMutation.mutateAsync({
          toNumber,
          leadId,
          campaignId,
        })

        setCurrentCallId(callData.id)

        // Dial via Telnyx WebRTC — the backend TeXML voice webhook parses the
        // `callid-` prefix and routes the call to the created call record
        const conn = currentDevice.newCall({
          destinationNumber: buildSipDestination(`callid-${callData.id}`),
          callerNumber: callData.fromNumber,
        })

        // Track the call — state transitions arrive via telnyx.notification
        activeCallIdRef.current = conn.id

        setConnection(conn)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to make call'
        setError(message)
        setCallState('failed')
        throw err
      }
    },
    [initiateCallMutation],
  )

  // End call mutation
  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      await post(ENDPOINTS.CALLS.END(callId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() })
    },
  })

  // End call
  const endCall = useCallback(async () => {
    // First notify backend to end the call on Telnyx's side
    if (currentCallId) {
      try {
        await endCallMutation.mutateAsync(currentCallId)
      } catch (error) {
        console.error('Error ending call on backend:', error)
      }
    }
    // Then hang up the browser call
    // The callUpdate notification handler will update state to "completed"
    if (connection) {
      connection.hangup()
    }
  }, [connection, currentCallId, endCallMutation])

  // Answer incoming call
  const answerIncomingCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.answer({ remoteElement: REMOTE_AUDIO_ELEMENT_ID })
    }
  }, [incomingCall])

  // Reject incoming call
  const rejectIncomingCall = useCallback(() => {
    if (incomingCall) {
      incomingCall.hangup()
    }
  }, [incomingCall])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (connection) {
      connection.toggleAudioMute()
    }
  }, [connection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (deviceRef.current) {
        deviceRef.current.disconnect().catch(() => {
          // Ignore disconnect errors on unmount
        })
      }
    }
  }, [])

  return {
    device,
    connection,
    callState,
    currentCallId,
    incomingCall,
    isReady,
    error,
    initializeDevice,
    makeCall,
    endCall,
    answerIncomingCall,
    rejectIncomingCall,
    toggleMute,
  }
}

interface TwilioConfig {
  id: string
  organizationId: string
  accountSid: string
  phoneNumbers: string[]
  createdAt: string
  updatedAt: string
}

// Hook for dialer configuration
export function useDialerConfig(organizationId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.dialerConfig(organizationId),
    queryFn: async () => {
      if (!organizationId) return null
      const response = await get<{ data: TwilioConfig | null }>(
        ENDPOINTS.DIALER.CONFIG(organizationId),
      )
      return response?.data ?? null
    },
    enabled: !!organizationId,
  })
}

// Hook for creating dialer config
export function useCreateDialerConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      organizationId: string
      accountSid: string
      authToken: string
      phoneNumbers?: string[]
    }) => {
      const response = await post<{ data: unknown }>(
        ENDPOINTS.DIALER.CREATE_CONFIG,
        params,
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.dialerConfig(variables.organizationId),
      })
    },
  })
}

// Hook for updating dialer config
export function useUpdateDialerConfig() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      organizationId: string
      accountSid?: string
      authToken?: string
      phoneNumbers?: string[]
    }) => {
      const { organizationId, ...data } = params
      const response = await patch<{ data: unknown }>(
        ENDPOINTS.DIALER.UPDATE_CONFIG(organizationId),
        data,
      )
      return response.data
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.dialerConfig(variables.organizationId),
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.dialerPhoneNumbers(variables.organizationId),
      })
    },
  })
}

// Hook for fetching phone numbers from the provider account
export function useTwilioPhoneNumbers(organizationId?: string, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.dialerPhoneNumbers(organizationId),
    queryFn: async () => {
      if (!organizationId) return []
      const response = await get<{ data: TwilioPhoneNumber[] }>(
        ENDPOINTS.DIALER.PHONE_NUMBERS(organizationId),
      )
      return response?.data ?? []
    },
    enabled: !!organizationId && enabled,
  })
}

interface TwilioPhoneNumber {
  phoneNumber: string
  friendlyName: string
  locality: string | null // City (e.g., "Payson")
  region: string | null // State/Province (e.g., "AZ")
  callerIdVerified?: boolean
  capabilities: {
    voice: boolean
    sms: boolean
    mms: boolean
  }
}

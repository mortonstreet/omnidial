'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  ReactNode,
} from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TelnyxRTC, Call, INotification } from '@telnyx/webrtc'
import { get, post, getAuthHeaders } from '@/lib/api'
import { QUERY_KEYS, ENDPOINTS, env } from '@/lib/config'
import { useActiveOrganization, useSession } from '@/lib/auth-client'
import { useDialerConfig } from '@/hooks/api/useDialer'
import type {
  CapabilityTokenResponse,
  PowerDialerTimezonePriority,
} from '@shared/types/src'

type CallState =
  | 'idle'
  | 'initiated'
  | 'ringing'
  | 'in-progress'
  | 'completed'
  | 'failed'
type TelnyxConnection = Call

const REMOTE_AUDIO_ELEMENT_ID = 'remote-audio'
const DIALER_TONE_URL = backendStaticUrl('/static/audio/us-ringback.ogg')

function backendStaticUrl(path: string): string {
  const url = new URL(env.API_URL)
  url.pathname = url.pathname.replace(/\/api\/?$/, '')
  url.pathname = `${url.pathname.replace(/\/$/, '')}${path}`
  url.search = ''
  return url.toString()
}

// Persisted dialer selection state (survives tab switches)
interface DialerSelection {
  clientId?: string
  campaignId?: string
  listId?: string
  timezonePriority?: PowerDialerTimezonePriority
}

// Parallel dialer session state
interface ParallelDialerSession {
  isActive: boolean
  sessionId?: string
  conferenceId?: string
}

// Current lead info for displaying in floating widget
interface CurrentLeadInfo {
  id: string
  name: string
  phone: string
  // Extended fields for mini widget
  firstName?: string | null
  lastName?: string | null
  linkedInUrl?: string | null
  website?: string | null
  timezone?: string | null
  campaignId?: string // For navigation
  listId?: string // For navigation
}

type InitStep = 'authenticating' | 'connecting' | 'registering' | 'ready' | null

interface DialerContextValue {
  device: TelnyxRTC | null
  connection: TelnyxConnection | null
  callState: CallState
  currentCallId: string | null
  incomingCall: TelnyxConnection | null
  isReady: boolean
  error: string | null
  isInitializing: boolean
  initStep: InitStep
  isInConference: boolean
  initializeDevice: () => Promise<boolean>
  makeCall: (
    toNumber: string,
    leadId?: string,
    campaignId?: string,
  ) => Promise<void>
  answerIncomingCall: () => void
  rejectIncomingCall: () => void
  endCall: () => Promise<void>
  toggleMute: () => void
  joinConference: (conferenceId: string) => Promise<void>
  leaveConference: () => void
  setConnection: (conn: TelnyxConnection | null) => void
  setCallState: (state: CallState) => void
  setCurrentCallId: (id: string | null) => void
  setError: (error: string | null) => void
  // Persisted selection state
  dialerSelection: DialerSelection
  setDialerSelection: (selection: DialerSelection) => void
  // Parallel dialer session state
  parallelSession: ParallelDialerSession
  setParallelSession: (
    session:
      | ParallelDialerSession
      | ((prev: ParallelDialerSession) => ParallelDialerSession),
  ) => void
  // Current lead info (for floating widget display)
  currentLeadInfo: CurrentLeadInfo | null
  setCurrentLeadInfo: (info: CurrentLeadInfo | null) => void
  // Widget minimized state (persisted to sessionStorage)
  isWidgetMinimized: boolean
  setIsWidgetMinimized: (minimized: boolean) => void
}

const DialerContext = createContext<DialerContextValue | null>(null)

const LEGACY_TOKEN_CACHE_KEY = 'omnidial-token'
const PREVIOUS_TOKEN_CACHE_KEY_PREFIXES = [
  'omnidial-token-v2',
  'omnidial-token-v3',
]
const TOKEN_CACHE_KEY_PREFIX = 'omnidial-token-v4'
const DIALER_SELECTION_KEY_PREFIX = 'omnidial-dialer-selection-v1'
const TIMEZONE_PRIORITY_VALUES = new Set([
  'eastern',
  'central',
  'mountain',
  'pacific',
])
const TOKEN_TTL_MS = 50 * 60 * 1000 // 50 minutes
// How long a dialed leg may sit before ringing before we call it dead and give
// the reserved caller ID back. Real SIP setup is well under a second; this is
// sized for a bad network, not for a working one.
const CONNECT_TIMEOUT_MS = 20 * 1000
// Telnyx has no in-place token update; proactively rebuild the client before the token expires
const TOKEN_REFRESH_MS = 45 * 60 * 1000 // 45 minutes

interface CachedToken {
  token: string
  expiresAt: number
  sipDomain?: string | null
}

// SIP domain of the backend's TeXML application. Browser-originated calls
// dial `sip:callid-<id>@<domain>` so the TeXML voice webhook can route them.
let telnyxSipDomain: string | null = null

function buildSipDestination(target: string): string {
  const sipDomain = requireSipDomain()
  return `sip:${target}@${sipDomain}`
}

function tokenCacheKey(
  organizationId?: string | null,
  userId?: string | null,
): string {
  if (organizationId && userId) {
    return `${TOKEN_CACHE_KEY_PREFIX}:${organizationId}:${userId}`
  }
  return organizationId
    ? `${TOKEN_CACHE_KEY_PREFIX}:${organizationId}`
    : TOKEN_CACHE_KEY_PREFIX
}

function dialerSelectionCacheKey(
  organizationId?: string | null,
  userId?: string | null,
): string | null {
  if (!organizationId || !userId) return null
  return `${DIALER_SELECTION_KEY_PREFIX}:${organizationId}:${userId}`
}

function isDialerSelection(value: unknown): value is DialerSelection {
  if (!value || typeof value !== 'object') return false
  const selection = value as Record<string, unknown>
  const keys = ['clientId', 'campaignId', 'listId', 'timezonePriority']

  return keys.every((key) => {
    if (selection[key] === undefined) return true
    if (typeof selection[key] !== 'string') return false
    return key !== 'timezonePriority' || TIMEZONE_PRIORITY_VALUES.has(selection[key])
  })
}

function removeStaleTokenCaches(
  organizationId?: string | null,
  userId?: string | null,
) {
  localStorage.removeItem(LEGACY_TOKEN_CACHE_KEY)
  for (const prefix of PREVIOUS_TOKEN_CACHE_KEY_PREFIXES) {
    localStorage.removeItem(prefix)
    if (organizationId) {
      localStorage.removeItem(`${prefix}:${organizationId}`)
      if (userId) {
        localStorage.removeItem(`${prefix}:${organizationId}:${userId}`)
      }
    }
  }
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

// Shared AudioContext used purely to unlock browser audio after a user gesture
let sharedAudioContext: AudioContext | null = null

async function resumeSharedAudioContext() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (!sharedAudioContext) {
      sharedAudioContext = new AudioContext()
    }
    if (sharedAudioContext.state !== 'running') {
      await sharedAudioContext.resume()
    }
  } catch (error) {
    console.warn('[Dialer] Unable to resume AudioContext', error)
  }
}

function getCachedToken(
  organizationId?: string | null,
  userId?: string | null,
): string | null {
  const cacheKey = tokenCacheKey(organizationId, userId)
  try {
    removeStaleTokenCaches(organizationId, userId)
    const raw = localStorage.getItem(cacheKey)
    if (!raw) return null
    const cached: CachedToken = JSON.parse(raw)
    if (Date.now() >= cached.expiresAt || !cached.sipDomain) {
      localStorage.removeItem(cacheKey)
      telnyxSipDomain = null
      return null
    }
    telnyxSipDomain = requireSipDomain(cached.sipDomain)
    return cached.token
  } catch {
    localStorage.removeItem(cacheKey)
    return null
  }
}

function setCachedToken(
  token: string,
  sipDomain?: string | null,
  organizationId?: string | null,
  userId?: string | null,
) {
  telnyxSipDomain = requireSipDomain(sipDomain)
  try {
    const data: CachedToken = {
      token,
      expiresAt: Date.now() + TOKEN_TTL_MS,
      sipDomain: telnyxSipDomain,
    }
    localStorage.removeItem(LEGACY_TOKEN_CACHE_KEY)
    removeStaleTokenCaches(organizationId, userId)
    localStorage.setItem(
      tokenCacheKey(organizationId, userId),
      JSON.stringify(data),
    )
  } catch {
    // localStorage may be unavailable
  }
}

function clearCachedToken(
  organizationId?: string | null,
  userId?: string | null,
) {
  try {
    removeStaleTokenCaches(organizationId, userId)
    localStorage.removeItem(tokenCacheKey(organizationId, userId))
  } catch {
    // noop
  }
  telnyxSipDomain = null
}

export function useDialerContext() {
  const context = useContext(DialerContext)
  if (!context) {
    throw new Error('useDialerContext must be used within a DialerProvider')
  }
  return context
}

export function DialerProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<TelnyxRTC | null>(null)
  const [connection, setConnection] = useState<TelnyxConnection | null>(null)
  const [callState, setCallState] = useState<CallState>('idle')
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)
  const [incomingCall, setIncomingCall] = useState<TelnyxConnection | null>(
    null,
  )
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  const [initStep, setInitStep] = useState<InitStep>(null)
  const [isInConference, setIsInConference] = useState(false)
  const [hasUserInteracted, setHasUserInteracted] = useState(false)

  // Persisted selection state (survives tab switches within dialer)
  const [dialerSelection, setDialerSelection] = useState<DialerSelection>({})
  const [isDialerSelectionHydrated, setIsDialerSelectionHydrated] =
    useState(false)

  // Parallel dialer session state
  const [parallelSession, setParallelSession] = useState<ParallelDialerSession>(
    {
      isActive: false,
    },
  )

  // Current lead info for floating widget display
  const [currentLeadInfo, setCurrentLeadInfo] =
    useState<CurrentLeadInfo | null>(null)

  // Widget minimized state - persisted to sessionStorage
  const WIDGET_MINIMIZED_KEY = 'floating-dialer-minimized'
  const [isWidgetMinimized, setIsWidgetMinimizedState] = useState<boolean>(
    () => {
      if (typeof window === 'undefined') return false
      try {
        return sessionStorage.getItem(WIDGET_MINIMIZED_KEY) === 'true'
      } catch {
        return false
      }
    },
  )

  const setIsWidgetMinimized = useCallback((minimized: boolean) => {
    setIsWidgetMinimizedState(minimized)
    try {
      sessionStorage.setItem(WIDGET_MINIMIZED_KEY, String(minimized))
    } catch {
      // Ignore storage errors
    }
  }, [])

  const deviceRef = useRef<TelnyxRTC | null>(null)
  const currentCallIdRef = useRef<string | null>(null)
  const queryClient = useQueryClient()

  const { data: session } = useSession()
  const userId = session?.user?.id
  const activeOrganization = useActiveOrganization()
  const organizationId = activeOrganization?.data?.id
  const dialerSelectionKey = useMemo(
    () => dialerSelectionCacheKey(organizationId, userId),
    [organizationId, userId],
  )
  const hydratedDialerSelectionKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!dialerSelectionKey) {
      hydratedDialerSelectionKeyRef.current = null
      setIsDialerSelectionHydrated(false)
      return
    }

    if (hydratedDialerSelectionKeyRef.current === dialerSelectionKey) {
      return
    }

    setIsDialerSelectionHydrated(false)
    hydratedDialerSelectionKeyRef.current = dialerSelectionKey

    try {
      const raw = localStorage.getItem(dialerSelectionKey)
      if (!raw) {
        setDialerSelection({})
        setIsDialerSelectionHydrated(true)
        return
      }

      const parsed = JSON.parse(raw)
      const isValidSelection = isDialerSelection(parsed)
      setDialerSelection(isValidSelection ? parsed : {})
      if (!isValidSelection) {
        localStorage.removeItem(dialerSelectionKey)
      }
    } catch {
      localStorage.removeItem(dialerSelectionKey)
      setDialerSelection({})
    }
    setIsDialerSelectionHydrated(true)
  }, [dialerSelectionKey])

  const updateDialerSelection = useCallback(
    (selection: DialerSelection) => {
      setDialerSelection(selection)

      if (
        !dialerSelectionKey ||
        hydratedDialerSelectionKeyRef.current !== dialerSelectionKey ||
        !isDialerSelectionHydrated
      ) {
        return
      }

      try {
        localStorage.setItem(dialerSelectionKey, JSON.stringify(selection))
      } catch {
        // Ignore storage errors
      }
    },
    [dialerSelectionKey, isDialerSelectionHydrated],
  )

  // Keep refs so closures always read the latest auth scope.
  const organizationIdRef = useRef(organizationId)
  organizationIdRef.current = organizationId
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  // Check if dialer is configured
  const { data: dialerConfig } = useDialerConfig(organizationId)

  // Fetch capability token
  const { refetch: refetchToken } = useQuery({
    queryKey: [...QUERY_KEYS.dialerToken(), organizationId, userId],
    queryFn: async () => {
      const response = await get<{ data: CapabilityTokenResponse }>(
        ENDPOINTS.DIALER.TOKEN,
      )
      return response.data
    },
    enabled: false,
    staleTime: 1000 * 60 * 50,
  })

  // Track initialization attempts to prevent race conditions
  const initializationPromiseRef = useRef<Promise<boolean> | null>(null)

  // Call tracking refs (Telnyx delivers all call state via telnyx.notification events,
  // so we track the active/incoming call ids and react to state transitions)
  const activeCallIdRef = useRef<string | null>(null)
  const activeCallModeRef = useRef<'call' | 'conference' | null>(null)
  const incomingCallIdRef = useRef<string | null>(null)
  const terminatedCallIdsRef = useRef<Set<string>>(new Set())
  const conferencePendingRef = useRef<{
    resolve: () => void
    reject: (err: Error) => void
    timeout: ReturnType<typeof setTimeout>
  } | null>(null)
  const tokenRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  const attemptInitRef = useRef<((token: string) => Promise<boolean>) | null>(
    null,
  )
  // Fires when a reserved call never gets a Telnyx leg off the ground, so the
  // reservation can be released instead of holding the caller ID hostage.
  const connectWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isReadyRef = useRef(false)
  isReadyRef.current = isReady
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initializeDeviceRef = useRef<(() => Promise<boolean>) | null>(null)

  // Pre-authorized release request for a reservation that has not connected
  // yet. Built up front because the unload handler has no chance to await a
  // fresh Clerk token before the document goes away.
  const pendingReleaseRef = useRef<{
    url: string
    headers: Record<string, string>
  } | null>(null)

  const clearConnectWatchdog = useCallback(() => {
    if (connectWatchdogRef.current) {
      clearTimeout(connectWatchdogRef.current)
      connectWatchdogRef.current = null
    }
    pendingReleaseRef.current = null
  }, [])

  // Central handler for Telnyx callUpdate notifications (replaces Twilio's per-call events)
  const handleCallUpdate = useCallback((call: Call) => {
    const state = call.state
    const isInbound = (call.direction as unknown as string) === 'inbound'

    // ----- Inbound calls that haven't been answered yet -----
    if (isInbound && call.id !== activeCallIdRef.current) {
      if (state === 'hangup' || state === 'destroy' || state === 'purge') {
        // Caller hung up / call canceled before answer
        if (incomingCallIdRef.current === call.id) {
          incomingCallIdRef.current = null
          setIncomingCall(null)
          setCallState('idle')
        }
        return
      }

      if (state === 'active' || state === 'answering') {
        if (incomingCallIdRef.current === call.id && state === 'active') {
          // Incoming call accepted
          incomingCallIdRef.current = null
          activeCallIdRef.current = call.id
          activeCallModeRef.current = 'call'
          setConnection(call)
          setCallState('in-progress')
          setIncomingCall(null)
        }
        return
      }

      // Any other pre-answer state ('new', 'ringing', ...) -> show incoming call UI
      if (incomingCallIdRef.current !== call.id) {
        console.log('Incoming call detected')
        incomingCallIdRef.current = call.id
        setIncomingCall(call)
      }
      return
    }

    // ----- Active (outbound or answered) call -----
    if (call.id !== activeCallIdRef.current) return
    if (terminatedCallIdsRef.current.has(call.id)) return

    const mode = activeCallModeRef.current

    switch (state) {
      case 'ringing':
      case 'early': {
        // The leg reached the carrier, so the reservation is no longer orphaned.
        clearConnectWatchdog()
        if (mode === 'call') {
          console.log('Call ringing')
          setCallState('ringing')
        }
        break
      }
      case 'active': {
        clearConnectWatchdog()
        if (mode === 'conference') {
          const pending = conferencePendingRef.current
          console.log('[DialerProvider] Conference call accepted - connected!')
          setCallState('in-progress')
          setIsInConference(true)
          if (pending) {
            clearTimeout(pending.timeout)
            conferencePendingRef.current = null
            pending.resolve()
          }
        } else {
          console.log('Call accepted')
          setCallState('in-progress')
        }
        break
      }
      case 'hangup':
      case 'destroy': {
        clearConnectWatchdog()
        terminatedCallIdsRef.current.add(call.id)
        if (terminatedCallIdsRef.current.size > 100) {
          terminatedCallIdsRef.current.clear()
          terminatedCallIdsRef.current.add(call.id)
        }
        activeCallIdRef.current = null
        activeCallModeRef.current = null
        setConnection(null)

        if (mode === 'conference') {
          const pending = conferencePendingRef.current
          if (pending) {
            clearTimeout(pending.timeout)
            conferencePendingRef.current = null
            console.error(
              '[DialerProvider] Conference call ended before connecting:',
              call.cause || 'unknown',
            )
            setCallState('failed')
            setIsInConference(false)
            pending.reject(new Error('Conference call was rejected'))
          } else {
            console.log('[DialerProvider] Conference disconnected')
            setCallState('idle')
            setIsInConference(false)
          }
        } else {
          console.log('Call disconnected')
          console.log('Disconnect reason:', call.cause || 'unknown')
          const callId = currentCallIdRef.current
          if (callId) {
            void post(ENDPOINTS.CALLS.END(callId)).catch((cleanupError) => {
              console.error(
                '[Dialer] Failed to release backend call after Telnyx disconnect:',
                cleanupError,
              )
            })
          }
          setCallState('completed')
          setTimeout(() => {
            setCallState((prev) => (prev === 'completed' ? 'idle' : prev))
            setCurrentCallId(null)
            currentCallIdRef.current = null
          }, 3000)
        }
        break
      }
      default:
        break
    }
  }, [clearConnectWatchdog])

  // Single attempt to initialize device with a given token
  const attemptInit = useCallback(
    async (token: string): Promise<boolean> => {
      // Clean up existing device
      if (deviceRef.current) {
        deviceRef.current.disconnect().catch(() => {
          // Ignore disconnect errors during re-init
        })
        deviceRef.current = null
      }

      setInitStep('connecting')
      const newDevice = new TelnyxRTC({
        login_token: token,
        ringtoneFile: DIALER_TONE_URL,
        ringbackFile: DIALER_TONE_URL,
      })
      newDevice.remoteElement = REMOTE_AUDIO_ELEMENT_ID

      // Create a promise that resolves when the client is ready (registered)
      setInitStep('registering')
      let settled = false
      const registeredPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error('[Dialer] Device registration timeout after 10s')
          console.error(
            '[Dialer] This usually means Telnyx credentials are invalid or missing.',
          )
          console.error('[Dialer] Check: TELNYX_API_KEY, TELNYX_TEXML_APP_ID')
          console.error(
            '[Dialer] Organization ID:',
            organizationIdRef.current ?? 'none',
          )
          settled = true
          reject(
            new Error(
              'Device registration timeout — check Telnyx configuration (TELNYX_API_KEY, TELNYX_TEXML_APP_ID)',
            ),
          )
        }, 10000)

        newDevice.on('telnyx.ready', () => {
          clearTimeout(timeout)
          settled = true
          setIsReady(true)
          setError(null)
          setInitStep('ready')
          console.log('[Dialer] Telnyx client registered successfully')
          resolve()
        })

        newDevice.on('telnyx.error', (event) => {
          const telnyxErr = event?.error
          console.error(
            '[Dialer] Telnyx client error:',
            telnyxErr?.code ?? 'no code',
            telnyxErr?.message ?? event,
          )
          console.error(
            '[Dialer] Organization ID:',
            organizationIdRef.current ?? 'none',
          )
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
        isReadyRef.current = false
        console.log('Telnyx client unregistered (socket closed)')

        // Without this the dialer sits unregistered until a full page reload:
        // the banner says "Unable to Connect" and every Call click reserves a
        // caller ID for a leg that can never leave the browser.
        if (deviceRef.current !== newDevice) return
        if (reconnectTimerRef.current) return
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null
          if (deviceRef.current !== newDevice || isReadyRef.current) return
          console.log('[Dialer] Socket closed — rebuilding Telnyx client')
          deviceRef.current = null
          void initializeDeviceRef.current?.()
        }, 3000)
      })

      newDevice.on('telnyx.notification', (notification: INotification) => {
        if (notification.type === 'callUpdate' && notification.call) {
          handleCallUpdate(notification.call)
        }
      })

      deviceRef.current = newDevice
      setDevice(newDevice)

      Promise.resolve(newDevice.connect()).catch((err) => {
        console.error('[Dialer] Telnyx connect() failed:', err)
      })
      await registeredPromise

      // Telnyx login tokens can't be refreshed in place — schedule a client rebuild before expiry
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
      }
      const scheduleRefresh = (delayMs: number) => {
        tokenRefreshTimerRef.current = setTimeout(async () => {
          // Don't drop an in-progress or incoming call — retry shortly
          if (activeCallIdRef.current || incomingCallIdRef.current) {
            scheduleRefresh(60 * 1000)
            return
          }
          console.log('Token expiring, refreshing...')
          try {
            clearCachedToken(organizationIdRef.current, userIdRef.current)
            const { data: newData } = await refetchToken()
            if (newData?.token) {
              setCachedToken(
                newData.token,
                newData.sipDomain,
                organizationIdRef.current,
                userIdRef.current,
              )
              await attemptInitRef.current?.(newData.token)
            }
          } catch (err) {
            console.error('[Dialer] Failed to refresh Telnyx token:', err)
          }
        }, delayMs)
      }
      scheduleRefresh(TOKEN_REFRESH_MS)

      return true
    },
    [refetchToken, handleCallUpdate],
  )

  attemptInitRef.current = attemptInit

  // Initialize Telnyx client with caching + retry
  const initializeDevice = useCallback(async (): Promise<boolean> => {
    // If already ready, return true
    if (isReady) return true

    // If there's already an initialization in progress, wait for it
    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current
    }

    // Create the initialization promise
    const initPromise = (async (): Promise<boolean> => {
      if (isInitializing) return false

      const MAX_RETRIES = 2

      try {
        if (!organizationIdRef.current || !userIdRef.current) {
          throw new Error('Dialer is still loading your user session')
        }

        setIsInitializing(true)
        setError(null)
        setInitStep('authenticating')

        // Try cached token first
        let token = getCachedToken(
          organizationIdRef.current,
          userIdRef.current,
        )

        if (!token) {
          const { data } = await refetchToken()
          if (!data?.token) {
            throw new Error('Failed to get capability token')
          }
          token = data.token
          setCachedToken(
            token,
            data.sipDomain,
            organizationIdRef.current,
            userIdRef.current,
          )
        }

        // Attempt init with retries
        let lastError: Error | null = null
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (attempt > 0) {
              // On retry, wait 1s then re-fetch a fresh token (cached one may be bad)
              await new Promise((r) => setTimeout(r, 1000))
              clearCachedToken(organizationIdRef.current, userIdRef.current)
              setInitStep('authenticating')
              const { data } = await refetchToken()
              if (!data?.token) {
                throw new Error('Failed to get capability token')
              }
              token = data.token
              setCachedToken(
                token,
                data.sipDomain,
                organizationIdRef.current,
                userIdRef.current,
              )
            }
            await attemptInit(token!)
            return true
          } catch (err) {
            lastError =
              err instanceof Error
                ? err
                : new Error('Failed to initialize device')
            console.warn(
              `Telnyx init attempt ${attempt + 1} failed:`,
              lastError.message,
            )
          }
        }

        throw lastError || new Error('Failed to initialize device')
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to initialize device'
        setError(message)
        setInitStep(null)
        console.error('Failed to initialize Telnyx client:', err)
        return false
      } finally {
        setIsInitializing(false)
        initializationPromiseRef.current = null
      }
    })()

    initializationPromiseRef.current = initPromise
    return initPromise
  }, [refetchToken, isInitializing, isReady, attemptInit])

  initializeDeviceRef.current = initializeDevice

  // Clear cached token on org/user switch.
  const prevOrgRef = useRef<string | undefined>(undefined)
  const prevUserRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const orgChanged =
      !!prevOrgRef.current &&
      !!organizationId &&
      prevOrgRef.current !== organizationId
    const userChanged =
      !!prevUserRef.current && !!userId && prevUserRef.current !== userId

    if (orgChanged || userChanged) {
      clearCachedToken(prevOrgRef.current, prevUserRef.current)
      clearCachedToken(organizationId, userId)
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
        tokenRefreshTimerRef.current = null
      }
      deviceRef.current?.disconnect().catch(() => {
        // Ignore disconnect errors during org switch cleanup
      })
      deviceRef.current = null
      setDevice(null)
      setConnection(null)
      setIncomingCall(null)
      setIsReady(false)
      setCallState('idle')
      setCurrentCallId(null)
      currentCallIdRef.current = null
      setError(null)
    }
    prevOrgRef.current = organizationId
    prevUserRef.current = userId
  }, [organizationId, userId])

  // Hand back a caller ID reserved for a call that never connected when the tab
  // goes away. A connected call needs no such handling — Telnyx reports the
  // hangup and the webhook closes the row out.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const releaseOnUnload = () => {
      const pending = pendingReleaseRef.current
      if (!pending) return
      pendingReleaseRef.current = null
      try {
        void fetch(pending.url, {
          method: 'POST',
          credentials: 'include',
          headers: pending.headers,
          keepalive: true,
        })
      } catch {
        // Best effort — the server-side sweep is the backstop.
      }
    }

    window.addEventListener('pagehide', releaseOnUnload)
    return () => {
      window.removeEventListener('pagehide', releaseOnUnload)
    }
  }, [])

  // Track first user gesture to satisfy browser autoplay policies.
  useEffect(() => {
    if (hasUserInteracted || typeof window === 'undefined') {
      return
    }

    const markInteracted = () => {
      setHasUserInteracted(true)
      void resumeSharedAudioContext()
    }
    window.addEventListener('pointerdown', markInteracted, {
      once: true,
      passive: true,
    })
    window.addEventListener('keydown', markInteracted, { once: true })

    return () => {
      window.removeEventListener('pointerdown', markInteracted)
      window.removeEventListener('keydown', markInteracted)
    }
  }, [hasUserInteracted])

  // Auto-initialize after config is loaded. Registration does not require a
  // user gesture; only audio playback does.
  useEffect(() => {
    if (
      dialerConfig &&
      organizationId &&
      userId &&
      !isReady &&
      !isInitializing &&
      !deviceRef.current
    ) {
      initializeDevice()
    }
  }, [
    dialerConfig,
    organizationId,
    userId,
    isReady,
    isInitializing,
    initializeDevice,
  ])

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

  // End call mutation
  const endCallMutation = useMutation({
    mutationFn: async (callId: string) => {
      await post(ENDPOINTS.CALLS.END(callId))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.calls() })
    },
  })

  // Make outbound call
  const makeCall = useCallback(
    async (toNumber: string, leadId?: string, campaignId?: string) => {
      const sanitizedToNumber = toNumber.trim()

      if (!sanitizedToNumber) {
        throw new Error('Phone number is required')
      }

      // Reserving a caller ID before the client is registered is what strands
      // reservations: the backend hands out a number, `newCall()` returns a
      // Call object, no INVITE ever leaves the browser, and no webhook ever
      // arrives to close the row out. Register first, reserve second.
      if (!deviceRef.current || !isReadyRef.current) {
        const reconnected = await (initializeDeviceRef.current?.() ??
          Promise.resolve(false))
        if (!reconnected || !deviceRef.current) {
          throw new Error(
            'Dialer is not connected. Wait a moment and try again.',
          )
        }
      }

      const currentDevice = deviceRef.current
      if (!currentDevice) {
        throw new Error('Device not ready')
      }

      let reservedCallId: string | null = null
      let telnyxCallStarted = false

      try {
        requireSipDomain()
        await resumeSharedAudioContext()
        setCallState('initiated')
        setError(null)

        // Create call record in backend
        const callData = await initiateCallMutation.mutateAsync({
          toNumber: sanitizedToNumber,
          leadId,
          campaignId,
        })

        reservedCallId = callData.id
        currentCallIdRef.current = callData.id
        setCurrentCallId(callData.id)

        // Dial via Telnyx WebRTC — the backend TeXML voice webhook parses the
        // `callid-` prefix and routes the call to the created call record
        const conn = currentDevice.newCall({
          destinationNumber: buildSipDestination(`callid-${callData.id}`),
          callerNumber: callData.fromNumber,
        })
        telnyxCallStarted = true

        // Track the call — state transitions arrive via telnyx.notification
        activeCallIdRef.current = conn.id
        activeCallModeRef.current = 'call'

        // `newCall()` resolving proves nothing — the SDK hands back a Call
        // object even when the socket is dead. If the leg never reaches
        // ringing, tear it down and hand the caller ID back rather than
        // leaving it reserved until the server-side sweep notices.
        clearConnectWatchdog()
        void getAuthHeaders()
          .then((headers) => {
            // Only arm the unload release while the leg is still unconnected.
            if (connectWatchdogRef.current === null) return
            pendingReleaseRef.current = {
              url: `${env.API_URL.toString()}${ENDPOINTS.CALLS.END(callData.id)}`,
              headers: Object.fromEntries(headers.entries()),
            }
          })
          .catch(() => {
            // Without a token the unload release is simply skipped; the
            // server-side sweep still reclaims the reservation.
          })
        connectWatchdogRef.current = setTimeout(() => {
          connectWatchdogRef.current = null
          if (activeCallIdRef.current !== conn.id) return

          console.error(
            '[Dialer] Call never reached the carrier — releasing reservation',
          )
          try {
            conn.hangup()
          } catch (hangupError) {
            console.error(
              '[Dialer] Failed to hang up stalled Telnyx leg:',
              hangupError,
            )
          }

          activeCallIdRef.current = null
          activeCallModeRef.current = null
          setConnection(null)
          setCallState('failed')
          setError('Call could not be connected. Please try again.')

          const stalledCallId = currentCallIdRef.current
          currentCallIdRef.current = null
          setCurrentCallId(null)
          if (stalledCallId) {
            endCallMutation.mutate(stalledCallId, {
              onError: (cleanupError) => {
                console.error(
                  '[Dialer] Failed to release stalled call reservation:',
                  cleanupError,
                )
              },
            })
          }
        }, CONNECT_TIMEOUT_MS)

        setConnection(conn)
      } catch (err) {
        let message = err instanceof Error ? err.message : 'Failed to make call'

        // Check for billing guard errors from the API response
        const errAny = err as Record<string, unknown>
        const resp = errAny?.response as Record<string, unknown> | undefined
        const respData = resp?.data as Record<string, unknown> | undefined
        const apiError =
          (respData?.error as string) || (errAny?.message as string) || ''
        if (apiError.includes('OVERAGE_CAP_HIT')) {
          message =
            'Your organization has reached its overage spending cap. Please visit Settings > Billing to raise the cap or upgrade your plan.'
        } else if (apiError.includes('ACCOUNT_SUSPENDED')) {
          message =
            'Your account has been suspended. Please visit Settings > Billing to resolve payment issues.'
        } else if (apiError.includes('ACCOUNT_CANCELED')) {
          message =
            'Your subscription has been canceled. Please visit Settings > Billing to reactivate.'
        } else if (apiError.includes('DAILY_LIMIT_REACHED')) {
          message =
            "You've reached the daily call limit (200 calls). This limit resets at midnight."
        } else if (apiError.includes('NO_ACTIVE_SUBSCRIPTION')) {
          message =
            'No active subscription found. Please visit Settings > Billing to choose a plan.'
        } else if (apiError.includes('BILLING_GUARD_UNAVAILABLE')) {
          message =
            'Billing verification is temporarily unavailable. Please retry in a moment.'
        }

        clearConnectWatchdog()
        setError(message)
        setCallState('failed')
        currentCallIdRef.current = null
        setCurrentCallId(null)
        activeCallIdRef.current = null
        activeCallModeRef.current = null

        if (reservedCallId && !telnyxCallStarted) {
          endCallMutation.mutate(reservedCallId, {
            onError: (cleanupError) => {
              console.error(
                '[Dialer] Failed to release reserved call after Telnyx start error:',
                cleanupError,
              )
            },
          })
        }
        throw err
      }
    },
    [initiateCallMutation, endCallMutation, clearConnectWatchdog],
  )

  // End call
  const endCall = useCallback(async () => {
    clearConnectWatchdog()
    // First notify backend
    if (currentCallId) {
      try {
        await endCallMutation.mutateAsync(currentCallId)
      } catch (error) {
        console.error('Error ending call on backend:', error)
      }
    }
    currentCallIdRef.current = null
    // Then hang up the browser call
    if (connection) {
      connection.hangup()
    }
  }, [connection, currentCallId, endCallMutation, clearConnectWatchdog])

  // Answer incoming call
  const answerIncomingCall = useCallback(() => {
    if (incomingCall) {
      resumeSharedAudioContext()
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

  // Join a parallel dial conference
  const joinConference = useCallback(async (conferenceId: string) => {
    console.log('[DialerProvider] joinConference called with:', conferenceId)
    const currentDevice = deviceRef.current
    if (!currentDevice) {
      console.error(
        '[DialerProvider] Device not ready - deviceRef.current is null',
      )
      throw new Error('Device not ready')
    }

    try {
      requireSipDomain()
      setCallState('initiated')
      setError(null)
      await resumeSharedAudioContext()

      console.log(
        '[DialerProvider] Dialing conference with conferenceId:',
        conferenceId,
      )
      // Dial the conference via the TeXML voice webhook — the backend parses the
      // `conf-` prefix and joins us to the conference room
      const conn = currentDevice.newCall({
        destinationNumber: buildSipDestination(`conf-${conferenceId}`),
      })
      console.log('[DialerProvider] newCall() returned, call initiated')

      // Track the call — state transitions arrive via telnyx.notification
      activeCallIdRef.current = conn.id
      activeCallModeRef.current = 'conference'

      // Set connection immediately so it can be used for disconnect if needed
      setConnection(conn)

      // Return a promise that resolves when connected or rejects on error
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          console.error(
            '[DialerProvider] Conference connection timeout after 15s',
          )
          console.error(
            '[DialerProvider] This usually means the TeXML Application Voice URL is not configured correctly',
          )
          console.error(
            '[DialerProvider] Check that TELNYX_TEXML_APP_ID env var is set and the TeXML Application Voice URL points to your backend webhook',
          )
          conferencePendingRef.current = null
          // Try to hang up the call
          try {
            conn.hangup()
          } catch (e) {
            console.error(
              '[DialerProvider] Error hanging up timed out call:',
              e,
            )
          }
          reject(
            new Error(
              'Conference connection timeout - check Telnyx TeXML Application configuration',
            ),
          )
        }, 15000)

        conferencePendingRef.current = { resolve, reject, timeout }
      })

      console.log('[DialerProvider] Successfully connected to conference')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to join conference'
      console.error('[DialerProvider] joinConference failed:', message, err)
      setError(message)
      setCallState('failed')
      setIsInConference(false)
      throw err
    }
  }, [])

  // Leave the current conference
  const leaveConference = useCallback(() => {
    if (connection) {
      connection.hangup()
    }
    setIsInConference(false)
  }, [connection])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (tokenRefreshTimerRef.current) {
        clearTimeout(tokenRefreshTimerRef.current)
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      if (connectWatchdogRef.current) {
        clearTimeout(connectWatchdogRef.current)
      }
      if (deviceRef.current) {
        deviceRef.current.disconnect().catch(() => {
          // Ignore disconnect errors on unmount
        })
      }
    }
  }, [])

  // Clear current lead info when call ends
  useEffect(() => {
    if (callState === 'idle') {
      setCurrentLeadInfo(null)
    }
  }, [callState])

  const value: DialerContextValue = {
    device,
    connection,
    callState,
    currentCallId,
    incomingCall,
    isReady,
    error,
    isInitializing,
    initStep,
    isInConference,
    initializeDevice,
    makeCall,
    answerIncomingCall,
    rejectIncomingCall,
    endCall,
    toggleMute,
    joinConference,
    leaveConference,
    setConnection,
    setCallState,
    setCurrentCallId,
    setError,
    // Persisted selection state
    dialerSelection,
    setDialerSelection: updateDialerSelection,
    // Parallel dialer session state
    parallelSession,
    setParallelSession,
    // Current lead info
    currentLeadInfo,
    setCurrentLeadInfo,
    // Widget minimized state
    isWidgetMinimized,
    setIsWidgetMinimized,
  }

  return (
    <DialerContext.Provider value={value}>
      {children}
      {/* Remote audio playback element for the Telnyx WebRTC client */}
      <audio id={REMOTE_AUDIO_ELEMENT_ID} autoPlay />
    </DialerContext.Provider>
  )
}

'use client'

import { useState, useEffect, useCallback, useRef, type UIEvent } from 'react'
import Link from 'next/link'
import {
  Play,
  Pause,
  ChevronRight,
  ChevronDown,
  Loader2,
  Phone,
  ChevronLeft,
  UserMinus,
  Globe,
  List,
} from 'lucide-react'
import { CompanySummaryCard } from '@/components/leads/CompanySummaryCard'
import { ProspectLocalTime } from '@/components/dialer/ProspectLocalTime'
import {
  usePowerDialerProgress,
  useNextLead,
  useStartPowerDialer,
  useStopPowerDialer,
  useSkipLead,
  useAdvanceToNext,
  useGoToPrevious,
  useUpdatePowerDialerProgress,
  usePowerDialerQueue,
  useJumpToPowerDialerLead,
  type Lead,
  type TimezonePriority,
} from '@/hooks/api/usePowerDialer'
import { useSoftRemoveLeadFromList } from '@/hooks/api/useLists'
import { useGenerateCompanySummary } from '@/hooks/api/useLeads'
import { useRemoveCampaignLeads } from '@/hooks/api/useDnc'
import {
  getTimezoneBucket,
  TIMEZONE_BUCKET_LABELS,
} from '@shared/types/src/constants/timezones'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'

const TIMEZONE_PRIORITY_OPTIONS: Array<{
  value: TimezonePriority | undefined
  label: string
  order: string
}> = [
  { value: undefined, label: 'List', order: 'List order' },
  { value: 'eastern', label: 'EST', order: 'EST -> CST -> MST -> PST' },
  { value: 'central', label: 'CST', order: 'CST -> MST -> PST -> EST' },
  { value: 'mountain', label: 'MST', order: 'MST -> PST -> EST -> CST' },
  { value: 'pacific', label: 'PST', order: 'PST -> EST -> CST -> MST' },
]

const getLeadDisplayName = (lead: Lead) =>
  [lead.firstName, lead.lastName].filter(Boolean).join(' ').trim() ||
  lead.company ||
  'Unnamed lead'

interface PowerDialerControlsProps {
  campaignId?: string
  listId?: string // Optional - if not provided, uses campaign leads
  onLeadSelect?: (lead: Lead) => void
  onCallInitiated?: (lead: Lead) => void
  onEndCall?: () => Promise<void> // Callback to end current call (for skipping during active call)
  callEndedCount?: number // Counter that increments when call ends - triggers advance
  callState?: string // Current call state from dialer context - wait for idle before next call
  delaySeconds?: number
  timezonePriority?: TimezonePriority
  onTimezonePriorityChange?: (timezonePriority?: TimezonePriority) => void
}

export function PowerDialerControls({
  campaignId,
  listId,
  onLeadSelect,
  onCallInitiated,
  onEndCall,
  callEndedCount = 0,
  callState = 'idle',
  delaySeconds = 5,
  timezonePriority: initialTimezonePriority,
  onTimezonePriorityChange,
}: PowerDialerControlsProps) {
  const [isRunning, setIsRunning] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [selectedDelay, setSelectedDelay] = useState(delaySeconds)
  const [timezonePriority, setTimezonePriorityState] = useState<
    TimezonePriority | undefined
  >(initialTimezonePriority)
  const [isLeadGridOpen, setIsLeadGridOpen] = useState(false)
  const queueScrollRef = useRef<HTMLDivElement>(null)

  // Track the last processed call end count to detect new call ends
  const lastProcessedCallEndRef = useRef(callEndedCount)
  // Track pending countdown (waiting for call to end before starting countdown)
  const pendingCountdownRef = useRef(false)

  const { data: progress } = usePowerDialerProgress(
    campaignId,
    listId,
    timezonePriority,
  )
  const { data: nextLeadData } = useNextLead(
    campaignId,
    listId,
    timezonePriority,
  )
  const startMutation = useStartPowerDialer()
  const stopMutation = useStopPowerDialer()
  const skipMutation = useSkipLead()
  const advanceMutation = useAdvanceToNext()
  const previousMutation = useGoToPrevious()
  const updateProgressMutation = useUpdatePowerDialerProgress()
  const jumpToLeadMutation = useJumpToPowerDialerLead()
  const softRemoveMutation = useSoftRemoveLeadFromList()
  const removeCampaignLeadsMutation = useRemoveCampaignLeads()
  const generateSummaryMutation = useGenerateCompanySummary()

  // Enable power dialer when campaign is selected (listId is now optional)
  const isEnabled = !!campaignId
  const currentLead = nextLeadData?.lead
  const canRemoveFromList = Boolean(listId || currentLead?.listId)
  const isRemovingLead =
    softRemoveMutation.isPending || removeCampaignLeadsMutation.isPending
  const progressData = nextLeadData?.progress || progress
  const currentLeadTimezone = currentLead?.timezone || null
  const currentLeadTimezoneBucket = getTimezoneBucket(currentLeadTimezone)
  const selectedTimezoneOrder = TIMEZONE_PRIORITY_OPTIONS.find(
    (option) => option.value === timezonePriority,
  )?.order
  const totalQueueLeads = progressData?.totalLeads ?? 0
  const effectiveCurrentIndex =
    totalQueueLeads > 0
      ? (progressData?.currentIndex ?? 0) % totalQueueLeads
      : 0
  const queueInitialPage = Math.max(
    1,
    Math.floor(effectiveCurrentIndex / 50) + 1,
  )
  const {
    data: queueData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: isQueueLoading,
  } = usePowerDialerQueue(
    campaignId,
    listId,
    timezonePriority,
    isLeadGridOpen,
    queueInitialPage,
  )
  const queueLeads = queueData?.pages.flatMap((page) => page.data) ?? []
  const queueTotal =
    queueData?.pages[0]?.pagination.total ?? progressData?.totalLeads ?? 0
  const activeQueueIndex =
    queueTotal > 0 ? (progressData?.currentIndex ?? 0) % queueTotal : 0

  // Track the previous lead ID to detect lead changes
  const previousLeadIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    setTimezonePriorityState(initialTimezonePriority)
  }, [initialTimezonePriority])

  // Reset mutation state when lead changes to prevent showing stale summary data
  useEffect(() => {
    if (currentLead?.id !== previousLeadIdRef.current) {
      previousLeadIdRef.current = currentLead?.id
      generateSummaryMutation.reset()
    }
  }, [currentLead?.id, generateSummaryMutation])

  // Notify parent of current lead
  useEffect(() => {
    if (currentLead && onLeadSelect) {
      onLeadSelect(currentLead)
    }
  }, [currentLead, onLeadSelect])

  // Countdown timer for auto-dial
  useEffect(() => {
    if (!isRunning || countdown === null) return

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }

    // Countdown finished, initiate call
    if (countdown === 0 && currentLead) {
      onCallInitiated?.(currentLead)
      queueMicrotask(() => setCountdown(null))
    }
  }, [countdown, isRunning, currentLead, onCallInitiated])

  const handleTimezonePriorityChange = useCallback(
    (nextPriority?: TimezonePriority) => {
      if (isRunning) return

      setTimezonePriorityState(nextPriority)
      onTimezonePriorityChange?.(nextPriority)
      setCountdown(null)

      if (campaignId) {
        updateProgressMutation.mutate({
          campaignId,
          listId,
          currentIndex: 0,
        })
      }
    },
    [
      campaignId,
      listId,
      isRunning,
      onTimezonePriorityChange,
      updateProgressMutation,
    ],
  )

  const handleStart = useCallback(async () => {
    if (!campaignId) return

    try {
      await startMutation.mutateAsync({
        campaignId,
        listId,
        delaySeconds: selectedDelay,
        timezonePriority,
      })
      setIsRunning(true)
      // Start countdown for first call
      setCountdown(selectedDelay)
    } catch (error) {
      console.error('Failed to start power dialer:', error)
      const rawMessage = error instanceof Error ? error.message : ''
      let userMessage = 'Failed to start power dialer. Please try again.'

      if (rawMessage.includes('session')) {
        userMessage =
          'Could not create dialer session. Please refresh and try again.'
      } else if (
        rawMessage.includes('network') ||
        rawMessage.includes('fetch')
      ) {
        userMessage = 'Network error. Please check your connection.'
      } else if (
        rawMessage.includes('No dialable leads found') ||
        rawMessage.includes('No leads found')
      ) {
        userMessage =
          'No dialable leads found. Add named leads with phone numbers first.'
      }

      toast.error(userMessage)
    }
  }, [campaignId, listId, startMutation, selectedDelay, timezonePriority])

  const handleStop = useCallback(async () => {
    if (!campaignId) return

    try {
      await stopMutation.mutateAsync({ campaignId, listId, timezonePriority })
      setIsRunning(false)
      setCountdown(null)
    } catch (error) {
      console.error('Failed to stop power dialer:', error)
      toast.error(
        'Failed to stop power dialer. You can refresh the page to reset.',
      )
    }
  }, [campaignId, listId, stopMutation, timezonePriority])

  const handleSkip = useCallback(() => {
    if (!campaignId) return

    // If a call is active, end it first
    const isCallActive = callState === 'ringing' || callState === 'in-progress'
    if (isCallActive && onEndCall) {
      onEndCall()
    }

    skipMutation.mutate(
      { campaignId, listId, timezonePriority },
      {
        onSuccess: () => {
          // Reset countdown for next lead
          if (isRunning) {
            setCountdown(selectedDelay)
          }
        },
        onError: (error) => {
          console.error('Failed to skip lead:', error)
          toast.error('Failed to skip to next lead. Please try again.')
        },
      },
    )
  }, [
    campaignId,
    listId,
    skipMutation,
    isRunning,
    selectedDelay,
    callState,
    onEndCall,
    timezonePriority,
  ])

  // Handle "Call Now" - immediately initiate call, canceling countdown
  const handleCallNow = useCallback(() => {
    if (!currentLead) return
    setCountdown(null)
    onCallInitiated?.(currentLead)
  }, [currentLead, onCallInitiated])

  // Handle "Previous" - go back to previous lead
  const handlePrevious = useCallback(() => {
    if (!campaignId) return

    previousMutation.mutate(
      { campaignId, listId, timezonePriority },
      {
        onSuccess: () => {
          // If running, don't auto-start countdown for previous lead
          // Let user decide when to call
          setCountdown(null)
        },
        onError: (error) => {
          console.error('Failed to go to previous lead:', error)
          toast.error('Failed to go to previous lead. Please try again.')
        },
      },
    )
  }, [campaignId, listId, previousMutation, timezonePriority])

  const handleQueueScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const element = event.currentTarget
      const remaining =
        element.scrollHeight - element.scrollTop - element.clientHeight

      if (remaining < 96 && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  )

  const handleJumpToLead = useCallback(
    (currentIndex: number) => {
      if (!campaignId) return

      const isCallActive =
        callState === 'ringing' || callState === 'in-progress'
      if (isCallActive && onEndCall) {
        onEndCall()
      }

      jumpToLeadMutation.mutate(
        {
          campaignId,
          listId,
          currentIndex,
          timezonePriority,
        },
        {
          onSuccess: () => {
            setCountdown(isRunning ? selectedDelay : null)
          },
          onError: (error) => {
            console.error('Failed to jump to lead:', error)
            toast.error('Failed to jump to that lead. Please try again.')
          },
        },
      )
    },
    [
      campaignId,
      callState,
      isRunning,
      jumpToLeadMutation,
      listId,
      onEndCall,
      selectedDelay,
      timezonePriority,
    ],
  )

  // Called when a call ends to advance to next lead
  const handleCallComplete = useCallback(async () => {
    if (!campaignId) return

    try {
      await advanceMutation.mutateAsync({
        campaignId,
        listId,
        timezonePriority,
      })
      // Mark that we're waiting for call state to be idle before starting countdown
      pendingCountdownRef.current = true
    } catch (error) {
      console.error('Failed to advance to next:', error)
      toast.error(
        'Failed to advance to next lead. Use the Next button to continue.',
      )
    }
  }, [campaignId, listId, advanceMutation, timezonePriority])

  // When call ends and power dialer is running, advance to next lead
  useEffect(() => {
    // Check if this is a new call end (counter increased)
    if (callEndedCount > lastProcessedCallEndRef.current && isRunning) {
      // Mark this call end as processed
      lastProcessedCallEndRef.current = callEndedCount
      // Use queueMicrotask to avoid synchronous setState within effect
      queueMicrotask(() => handleCallComplete())
    }
  }, [callEndedCount, isRunning, handleCallComplete])

  // Wait for call state to be idle before starting countdown (prevents overlapping calls)
  useEffect(() => {
    if (pendingCountdownRef.current && callState === 'idle' && isRunning) {
      pendingCountdownRef.current = false
      // Use queueMicrotask to avoid synchronous setState within effect
      queueMicrotask(() => setCountdown(selectedDelay))
    }
  }, [callState, isRunning, selectedDelay])

  // Handle removing the lead from the current dialer queue.
  const handleRemoveFromQueue = useCallback(async () => {
    const effectiveListId = listId || currentLead?.listId
    if (!currentLead || !campaignId) return

    try {
      if (effectiveListId) {
        await softRemoveMutation.mutateAsync({
          listId: effectiveListId,
          leadId: currentLead.id,
        })
        toast.success('Lead removed from list')
      } else {
        await removeCampaignLeadsMutation.mutateAsync({
          campaignId,
          leadIds: [currentLead.id],
        })
        toast.success('Lead removed from campaign')
      }

      // Always skip to next lead after removing for better UX
      await skipMutation.mutateAsync({ campaignId, listId, timezonePriority })
      // Only start countdown if power dialer is running
      if (isRunning) {
        setCountdown(selectedDelay)
      }
    } catch (error) {
      console.error('Failed to remove lead from dialer queue:', error)
      const rawMessage = error instanceof Error ? error.message : ''
      let userMessage = 'Failed to remove lead. Please try again.'

      if (rawMessage.includes('not found') || rawMessage.includes('404')) {
        userMessage = 'Lead not found. Please refresh the page.'
      } else if (
        rawMessage.includes('permission') ||
        rawMessage.includes('403')
      ) {
        userMessage = "You don't have permission to remove this lead."
      }

      toast.error(userMessage)
    }
  }, [
    listId,
    currentLead,
    campaignId,
    softRemoveMutation,
    removeCampaignLeadsMutation,
    isRunning,
    skipMutation,
    selectedDelay,
    timezonePriority,
  ])

  // Handle generating AI company summary
  const handleGenerateSummary = useCallback(
    async (forceRegenerate = false) => {
      if (!currentLead) return

      try {
        await generateSummaryMutation.mutateAsync({
          leadId: currentLead.id,
          forceRegenerate,
        })
        toast.success(
          forceRegenerate ? 'Summary regenerated' : 'Company summary generated',
        )
      } catch (error) {
        console.error('Failed to generate summary:', error)
        const rawMessage = error instanceof Error ? error.message : ''

        // Convert technical errors to user-friendly messages
        let userMessage = 'Failed to generate summary. Please try again.'

        if (
          rawMessage.includes('API key not configured') ||
          rawMessage.includes('503')
        ) {
          userMessage =
            'AI service is not configured. Please contact your administrator.'
        } else if (
          rawMessage.includes('no company name') ||
          rawMessage.includes('400')
        ) {
          userMessage =
            'Unable to research: no company name or website available for this lead.'
        } else if (
          rawMessage.includes('not found') ||
          rawMessage.includes('404')
        ) {
          userMessage = 'Lead not found. Please refresh and try again.'
        } else if (
          rawMessage.includes('rate limit') ||
          rawMessage.includes('429')
        ) {
          userMessage = 'Too many requests. Please wait a moment and try again.'
        } else if (
          rawMessage.includes('timeout') ||
          rawMessage.includes('ETIMEDOUT')
        ) {
          userMessage =
            'Request timed out. The AI service may be busy - please try again.'
        } else if (
          rawMessage.includes('network') ||
          rawMessage.includes('fetch')
        ) {
          userMessage =
            'Network error. Please check your connection and try again.'
        }

        toast.error(userMessage)
      }
    },
    [currentLead, generateSummaryMutation],
  )

  // Keyboard navigation: Arrow keys, Cmd+L (LinkedIn), Cmd+J (website), Enter (call/end)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      // Only handle if we have a campaign selected
      if (!campaignId) return

      const metaKey = e.metaKey || e.ctrlKey

      // Cmd/Ctrl+L = Open LinkedIn profile in new tab
      if (metaKey && e.key === 'l') {
        if (currentLead?.linkedInUrl) {
          e.preventDefault()
          window.open(currentLead.linkedInUrl, '_blank', 'noopener,noreferrer')
        }
        return
      }

      // Cmd/Ctrl+J = Open website in new tab
      if (metaKey && e.key === 'j') {
        if (currentLead?.website) {
          e.preventDefault()
          const url = currentLead.website.startsWith('http')
            ? currentLead.website
            : `https://${currentLead.website}`
          window.open(url, '_blank', 'noopener,noreferrer')
        }
        return
      }

      // Enter = Start call (if idle) or End call (if active)
      if (e.key === 'Enter') {
        e.preventDefault()
        const isCallActive =
          callState === 'ringing' || callState === 'in-progress'
        if (isCallActive && onEndCall) {
          onEndCall()
        } else if (callState === 'idle' && currentLead) {
          handleCallNow()
        }
        return
      }

      // Up/Right arrow or + or = = Next lead (fire-and-forget for instant response)
      if (
        e.key === 'ArrowUp' ||
        e.key === 'ArrowRight' ||
        e.key === '+' ||
        e.key === '='
      ) {
        e.preventDefault()
        handleSkip()
      }

      // Down/Left arrow or - = Previous lead (wraps to end if at beginning)
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') {
        e.preventDefault()
        handlePrevious()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    campaignId,
    handleSkip,
    handlePrevious,
    currentLead,
    callState,
    onEndCall,
    handleCallNow,
  ])

  if (!isEnabled) {
    return (
      <div className="p-5 bg-muted/50 border border-border/50 rounded-xl text-center text-muted-foreground text-sm">
        Select a client and campaign to start power dialing
      </div>
    )
  }

  return (
    <div className="p-5 bg-card border border-border/50 rounded-xl space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">Power Dialer</h3>
        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={stopMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/30 hover:bg-rose-500/20 rounded-lg transition-all duration-200 text-sm disabled:opacity-50"
            >
              {stopMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Pause className="w-4 h-4" />
              )}
              Stop
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 text-white rounded-lg transition-all duration-200 text-sm disabled:opacity-50"
            >
              {startMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start
            </button>
          )}
        </div>
      </div>

      {/* Delay selector */}
      {!isRunning && (
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">
            Delay between calls:
          </label>
          <select
            value={selectedDelay}
            onChange={(e) => setSelectedDelay(Number(e.target.value))}
            className="px-3 py-1.5 bg-muted/60 border border-border/50 rounded-lg text-xs hover:border-foreground/20 transition-all duration-200"
          >
            {[0, 3, 5, 10, 15, 20, 30].map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds}s
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label className="text-xs text-muted-foreground">
            Timezone priority
          </label>
          {selectedTimezoneOrder && (
            <span className="text-[11px] text-muted-foreground truncate">
              {selectedTimezoneOrder}
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {TIMEZONE_PRIORITY_OPTIONS.map((option) => {
            const isSelected = option.value === timezonePriority
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => handleTimezonePriorityChange(option.value)}
                disabled={isRunning || updateProgressMutation.isPending}
                title={
                  isRunning
                    ? 'Stop the dialer to change timezone priority'
                    : option.order
                }
                className={`h-8 rounded-md border text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border/60 bg-muted/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Empty list state */}
      {progressData?.isEmpty && (
        <div className="p-4 bg-muted/50 border border-border/50 rounded-xl">
          <div className="flex items-center gap-3 text-muted-foreground">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium text-foreground">No leads available</p>
              <p className="text-sm">
                Add named leads with phone numbers to continue dialing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current lead display - elevated card */}
      {currentLead && !progressData?.isEmpty && (
        <div className="p-4 bg-card border border-border/50 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Next up
            </span>
            <div className="flex items-center gap-2">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    disabled={isRemovingLead}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-destructive hover:text-destructive/80 border border-transparent hover:border-destructive/30 rounded-lg transition-all duration-150 disabled:opacity-50"
                    title={
                      canRemoveFromList
                        ? 'Remove from list'
                        : 'Remove from campaign'
                    }
                  >
                    {isRemovingLead ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserMinus className="w-3 h-3" />
                    )}
                    Remove
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {canRemoveFromList
                        ? 'Remove from list?'
                        : 'Remove from campaign?'}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will remove {getLeadDisplayName(currentLead)} from
                      the current {canRemoveFromList ? 'list' : 'campaign'}. The
                      lead data will be preserved and can still be found in the
                      global leads view.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleRemoveFromQueue}>
                      {canRemoveFromList
                        ? 'Remove from list'
                        : 'Remove from campaign'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <button
                onClick={handlePrevious}
                disabled={previousMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous lead (−/↓/←)"
              >
                {previousMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ChevronLeft className="w-3 h-3" />
                )}
                Previous
              </button>
              <button
                onClick={handleSkip}
                disabled={skipMutation.isPending}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground border border-transparent hover:border-border/50 rounded-lg transition-all duration-150"
                title="Next lead (+/↑/→)"
              >
                {skipMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Next
              </button>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-3">
              <Link
                href={`/dashboard/leads/${currentLead.id}`}
                className="font-semibold text-base hover:text-primary hover:underline transition-colors"
              >
                {getLeadDisplayName(currentLead)}
              </Link>
              {currentLead.linkedInUrl && (
                <a
                  href={currentLead.linkedInUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#0A66C2] hover:text-[#004182] transition-colors"
                  title="View LinkedIn profile (⌘L)"
                >
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                  </svg>
                </a>
              )}
              {currentLead.website && (
                <a
                  href={
                    currentLead.website.startsWith('http')
                      ? currentLead.website
                      : `https://${currentLead.website}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground transition-colors"
                  title="Visit company website (⌘J)"
                >
                  <Globe className="w-4 h-4" />
                </a>
              )}
              {/* Prospect local time */}
              {currentLeadTimezoneBucket && (
                <span
                  className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
                  title="Lead timezone bucket"
                >
                  {TIMEZONE_BUCKET_LABELS[currentLeadTimezoneBucket]}
                </span>
              )}
              {currentLeadTimezone && (
                <ProspectLocalTime timezone={currentLeadTimezone} />
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-0.5">
              {currentLead.company}{' '}
              {currentLead.title && `• ${currentLead.title}`}
            </div>
            <div className="text-base font-mono mt-2">{currentLead.phone}</div>

            {/* AI Company Summary - always show, use contact name as fallback */}
            <div className="mt-2 pt-2 border-t border-border">
              <CompanySummaryCard
                summary={
                  currentLead.aiCompanySummary ||
                  generateSummaryMutation.data?.summary ||
                  null
                }
                companyName={
                  currentLead.company ||
                  `${currentLead.firstName || ''} ${currentLead.lastName || ''}`.trim() ||
                  'this contact'
                }
                isGenerating={generateSummaryMutation.isPending}
                onGenerate={() => handleGenerateSummary(false)}
                onRegenerate={() => handleGenerateSummary(true)}
                compact
                structuredData={
                  currentLead.aiCompanyOverview
                    ? {
                        overview: currentLead.aiCompanyOverview,
                        talkingPoints: currentLead.aiSalesTalkingPoints,
                        businessContext: currentLead.aiBusinessContext,
                      }
                    : generateSummaryMutation.data?.structured
                      ? {
                          overview:
                            generateSummaryMutation.data.structured
                              .companyOverview,
                          talkingPoints:
                            generateSummaryMutation.data.structured
                              .salesTalkingPoints,
                          businessContext:
                            generateSummaryMutation.data.structured
                              .businessContext,
                        }
                      : undefined
                }
              />
            </div>
          </div>
        </div>
      )}

      {currentLead && !progressData?.isEmpty && (
        <div className="border border-border/50 rounded-xl overflow-hidden">
          <button
            type="button"
            onClick={() => setIsLeadGridOpen((open) => !open)}
            className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/40 transition-colors"
          >
            <span className="min-w-0 flex items-center gap-2 font-medium">
              <List className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="truncate">Lead grid</span>
            </span>
            <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
              {queueTotal > 0
                ? `${activeQueueIndex + 1} / ${queueTotal}`
                : '0 leads'}
              <ChevronDown
                className={`w-4 h-4 transition-transform ${
                  isLeadGridOpen ? 'rotate-180' : ''
                }`}
              />
            </span>
          </button>

          {isLeadGridOpen && (
            <div className="border-t border-border/50 bg-muted/10">
              <div className="grid grid-cols-[3.25rem_minmax(0,1fr)_4.75rem] border-b border-border/50 text-[11px] font-medium uppercase text-muted-foreground">
                <div className="border-r border-border/50 px-2 py-2 text-center">
                  #
                </div>
                <div className="px-3 py-2">Lead</div>
                <div className="px-2 py-2 text-right">Jump</div>
              </div>
              <div
                ref={queueScrollRef}
                onScroll={handleQueueScroll}
                className="max-h-72 overflow-y-auto"
              >
                {isQueueLoading && queueLeads.length === 0 ? (
                  <div className="space-y-1 p-2">
                    {[1, 2, 3, 4].map((index) => (
                      <div
                        key={index}
                        className="h-12 rounded-md bg-muted/70 animate-pulse"
                      />
                    ))}
                  </div>
                ) : queueLeads.length === 0 ? (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No dialable leads in this queue
                  </div>
                ) : (
                  queueLeads.map((lead) => {
                    const isActive = lead.queueIndex === activeQueueIndex
                    const displayName = getLeadDisplayName(lead)
                    const secondary = [lead.company, lead.title]
                      .filter(Boolean)
                      .join(' - ')

                    return (
                      <button
                        key={`${lead.id}-${lead.queueIndex}`}
                        type="button"
                        onClick={() => handleJumpToLead(lead.queueIndex)}
                        disabled={jumpToLeadMutation.isPending}
                        className={`grid w-full grid-cols-[3.25rem_minmax(0,1fr)_4.75rem] text-left transition-colors disabled:opacity-60 ${
                          isActive
                            ? 'bg-primary/10 text-foreground'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div
                          className={`flex items-center justify-center border-r border-border/50 px-2 py-2 text-xs tabular-nums ${
                            isActive
                              ? 'font-semibold text-primary'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {lead.queueIndex + 1}
                        </div>
                        <div className="min-w-0 px-3 py-2">
                          <div className="truncate text-sm font-medium">
                            {displayName}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {secondary || lead.phone}
                          </div>
                        </div>
                        <div className="flex items-center justify-end px-2 py-2 text-xs text-muted-foreground">
                          {isActive ? (
                            <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-primary">
                              Current
                            </span>
                          ) : jumpToLeadMutation.isPending ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Select</span>
                          )}
                        </div>
                      </button>
                    )
                  })
                )}

                {isFetchingNextPage && queueLeads.length > 0 && (
                  <div className="flex items-center justify-center gap-2 px-3 py-3 text-xs text-muted-foreground">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading leads
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Countdown display with circular progress ring */}
      {isRunning && countdown !== null && countdown > 0 && (
        <div className="flex flex-col items-center py-6 space-y-4">
          <div className="relative w-32 h-32 flex items-center justify-center">
            {/* Background ring */}
            <svg
              className="absolute inset-0 w-full h-full countdown-ring"
              viewBox="0 0 100 100"
            >
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                className="text-border"
              />
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * countdown) / selectedDelay}
                className="text-emerald-500 transition-all duration-1000 ease-linear"
              />
            </svg>
            {/* Countdown number */}
            <span
              className="text-6xl font-mono tabular-nums text-foreground animate-number-tick"
              key={countdown}
            >
              {countdown}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Calling in {countdown}s
          </div>
          <button
            onClick={handleCallNow}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 text-white rounded-lg transition-all duration-200 text-sm"
          >
            <Phone className="w-4 h-4" />
            Call Now
          </button>
        </div>
      )}
    </div>
  )
}

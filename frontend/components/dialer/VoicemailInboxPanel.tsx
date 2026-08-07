'use client'

import { useState } from 'react'
import {
  Phone,
  CheckCheck,
  Loader2,
  Voicemail,
  User,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AudioPlayer } from '@/components/ui/audio-player'
import {
  useVoicemailInbox,
  useMarkVoicemailRead,
  useMarkAllVoicemailsRead,
} from '@/hooks/api/useVoicemailInbox'
import type { VoicemailInboxItem } from '@shared/types/src'

interface VoicemailInboxPanelProps {
  onCallBack?: (phoneNumber: string, leadId?: string) => void
}

export function VoicemailInboxPanel({ onCallBack }: VoicemailInboxPanelProps) {
  const [page, setPage] = useState(1)
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { data, isLoading } = useVoicemailInbox({ page, limit: 20, unreadOnly })
  const markRead = useMarkVoicemailRead()
  const markAllRead = useMarkAllVoicemailsRead()

  const voicemails = data?.data || []
  const total = data?.total || 0
  const unreadCount = data?.unreadCount || 0
  const totalPages = Math.ceil(total / 20)

  const handleMarkAllRead = () => {
    markAllRead.mutate()
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const getCallerDisplay = (vm: VoicemailInboxItem) => {
    if (vm.leadFirstName || vm.leadLastName) {
      return `${vm.leadFirstName || ''} ${vm.leadLastName || ''}`.trim()
    }
    return vm.fromNumber
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Voicemail Inbox</h2>
          {unreadCount > 0 && (
            <span className="px-2.5 py-0.5 text-xs font-medium bg-primary text-primary-foreground rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setUnreadOnly(!unreadOnly)}
            className={unreadOnly ? 'text-primary' : 'text-muted-foreground'}
          >
            {unreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck className="w-4 h-4 mr-1.5" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {/* Voicemail List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : voicemails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Voicemail className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium mb-1">No voicemails</h3>
          <p className="text-sm text-muted-foreground">
            {unreadOnly
              ? 'No unread voicemails. Try showing all.'
              : "When callers leave messages, they'll appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {voicemails.map((vm) => {
            const isUnread = !vm.voicemailReadAt

            return (
              <div
                key={vm.id}
                className={`flex flex-col gap-3 p-3 rounded-xl border transition-colors ${
                  isUnread
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-card border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Caller info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isUnread && (
                        <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm truncate ${
                          isUnread ? 'font-semibold' : 'font-medium'
                        }`}
                      >
                        {getCallerDisplay(vm)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      {vm.leadFirstName && (
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {vm.fromNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(vm.duration)}
                      </span>
                      <span>{formatTime(vm.startedAt)}</span>
                    </div>
                  </div>

                  {/* Callback button */}
                  {onCallBack && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        onCallBack(vm.fromNumber, vm.leadId || undefined)
                      }
                      className="flex-shrink-0"
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                {/* Full player with a seekable scrubber — same component the
                    call recordings use, so voicemails get identical playback
                    controls (drag to seek, hover preview, speed, download). */}
                <AudioPlayer
                  callId={vm.id}
                  leadName={getCallerDisplay(vm)}
                  callDate={vm.startedAt}
                  className="w-full min-w-0"
                  onPlayStateChange={(playing) => {
                    if (playing && !vm.voicemailReadAt) {
                      markRead.mutate(vm.id)
                    }
                  }}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

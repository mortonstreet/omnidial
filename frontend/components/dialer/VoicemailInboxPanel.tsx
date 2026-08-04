"use client";

import { useState, useRef, useCallback } from "react";
import {
  Phone,
  Play,
  Pause,
  CheckCheck,
  Loader2,
  Voicemail,
  User,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useVoicemailInbox,
  useMarkVoicemailRead,
  useMarkAllVoicemailsRead,
} from "@/hooks/api/useVoicemailInbox";
import { ENDPOINTS } from "@/lib/config";
import { env } from "@/lib/config";
import type { VoicemailInboxItem } from "@shared/types/src";

interface VoicemailInboxPanelProps {
  onCallBack?: (phoneNumber: string, leadId?: string) => void;
}

export function VoicemailInboxPanel({ onCallBack }: VoicemailInboxPanelProps) {
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data, isLoading } = useVoicemailInbox({ page, limit: 20, unreadOnly });
  const markRead = useMarkVoicemailRead();
  const markAllRead = useMarkAllVoicemailsRead();

  const voicemails = data?.data || [];
  const total = data?.total || 0;
  const unreadCount = data?.unreadCount || 0;
  const totalPages = Math.ceil(total / 20);

  const handlePlay = useCallback(async (vm: VoicemailInboxItem) => {
    if (playingId === vm.id) {
      // Pause
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    // Play the voicemail using the recording proxy endpoint
    // Fetch with credentials then create blob URL (audio elements don't send cookies)
    const recordingUrl = `${env.API_URL}${ENDPOINTS.CALLS.RECORDING(vm.id)}`;
    try {
      const response = await fetch(recordingUrl, { credentials: 'include' });
      if (!response.ok) {
        console.error('Failed to load voicemail recording:', response.status);
        return;
      }
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const audio = new Audio(blobUrl);
      audio.onended = () => {
        setPlayingId(null);
        audioRef.current = null;
        URL.revokeObjectURL(blobUrl);
      };
      audio.onerror = () => {
        setPlayingId(null);
        audioRef.current = null;
        URL.revokeObjectURL(blobUrl);
      };
      audioRef.current = audio;
      await audio.play();
      setPlayingId(vm.id);
    } catch (err) {
      console.error('Failed to play voicemail:', err);
      setPlayingId(null);
      return;
    }

    // Mark as read when played
    if (!vm.voicemailReadAt) {
      markRead.mutate(vm.id);
    }
  }, [playingId, markRead]);

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getCallerDisplay = (vm: VoicemailInboxItem) => {
    if (vm.leadFirstName || vm.leadLastName) {
      return `${vm.leadFirstName || ""} ${vm.leadLastName || ""}`.trim();
    }
    return vm.fromNumber;
  };

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
            className={unreadOnly ? "text-primary" : "text-muted-foreground"}
          >
            {unreadOnly ? "Show All" : "Unread Only"}
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
              ? "No unread voicemails. Try showing all."
              : "When callers leave messages, they'll appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {voicemails.map((vm) => {
            const isUnread = !vm.voicemailReadAt;
            const isPlaying = playingId === vm.id;

            return (
              <div
                key={vm.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                  isUnread
                    ? "bg-primary/5 border-primary/20"
                    : "bg-card border-border"
                }`}
              >
                {/* Play button */}
                <button
                  onClick={() => handlePlay(vm)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition ${
                    isPlaying
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted hover:bg-muted/80"
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>

                {/* Caller info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isUnread && (
                      <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
                    )}
                    <span
                      className={`text-sm truncate ${
                        isUnread ? "font-semibold" : "font-medium"
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
            );
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
  );
}

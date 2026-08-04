"use client";

import { useState, useRef } from "react";
import {
  Play,
  Pause,
  Trash2,
  Loader2,
  Check,
  Voicemail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useVoicemailGreetings,
  useActivateVoicemailGreeting,
  useDeleteVoicemailGreeting,
} from "@/hooks/api/useVoicemailInbox";
import { toast } from "sonner";
import type { VoicemailGreetingResponse } from "@shared/types/src";

export function VoicemailGreetingManager() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data, isLoading } = useVoicemailGreetings();
  const activateGreeting = useActivateVoicemailGreeting();
  const deleteGreeting = useDeleteVoicemailGreeting();

  const greetings = data?.data || [];

  const handlePlay = (greeting: VoicemailGreetingResponse) => {
    if (playingId === greeting.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio(greeting.recordingUrl);
    audio.onended = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audio.onerror = () => {
      setPlayingId(null);
      audioRef.current = null;
    };
    audioRef.current = audio;
    audio.play();
    setPlayingId(greeting.id);
  };

  const handleActivate = async (id: string) => {
    try {
      await activateGreeting.mutateAsync(id);
      toast.success("Greeting activated");
    } catch {
      toast.error("Failed to activate greeting");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGreeting.mutateAsync(id);
      toast.success("Greeting deleted");
    } catch {
      toast.error("Failed to delete greeting");
    }
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : greetings.length > 0 ? (
        greetings.map((greeting) => {
          const isPlaying = playingId === greeting.id;

          return (
            <div
              key={greeting.id}
              className={`flex items-center justify-between p-3 rounded-xl border group transition-colors ${
                greeting.isActive
                  ? "bg-primary/5 border-primary/30"
                  : "bg-muted/50 border-border"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handlePlay(greeting)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center transition ${
                    isPlaying
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 hover:bg-primary/20"
                  }`}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5" />
                  ) : (
                    <Play className="w-5 h-5" />
                  )}
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {greeting.name}
                    </p>
                    {greeting.isActive && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary rounded">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDuration(greeting.duration)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {!greeting.isActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleActivate(greeting.id)}
                    disabled={activateGreeting.isPending}
                    className="opacity-0 group-hover:opacity-100 transition"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Activate
                  </Button>
                )}
                <button
                  onClick={() => handleDelete(greeting.id)}
                  disabled={deleteGreeting.isPending}
                  className="p-2 text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="text-center py-4">
          <Voicemail className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No custom greetings configured. The default message will play for
            missed calls.
          </p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        The active greeting plays for callers when no one answers. If no greeting is active, a default message is used.
      </p>
    </div>
  );
}

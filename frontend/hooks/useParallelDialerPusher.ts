"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Channel } from "pusher-js";
import { useActiveOrganization } from "@/lib/auth-client";
import { getPusherClient, isPusherEnabled } from "@/lib/pusher-client";
import {
  channels,
  PUSHER_EVENTS,
  ParallelDialStartedEvent,
  ParallelDialAttemptUpdateEvent,
  ParallelDialConnectedEvent,
  ParallelDialEndedEvent,
  ParallelDialAttemptResponse,
} from "@shared/types/src";
import { QUERY_KEYS } from "@/lib/config";

export interface ParallelDialerState {
  sessionId: string | null;
  conferenceId: string | null;
  lineCount: number;
  currentAttempts: ParallelDialAttemptResponse[];
  connectedAttempt: ParallelDialAttemptResponse | null;
  isConnected: boolean;
  stats: {
    totalAttempts: number;
    totalConnects: number;
    totalAbandoned: number;
  };
}

interface UseParallelDialerPusherOptions {
  sessionId?: string;
  onStarted?: (event: ParallelDialStartedEvent) => void;
  onAttemptUpdate?: (event: ParallelDialAttemptUpdateEvent) => void;
  onConnected?: (event: ParallelDialConnectedEvent) => void;
  onEnded?: (event: ParallelDialEndedEvent) => void;
}

export function useParallelDialerPusher(options: UseParallelDialerPusherOptions = {}) {
  const { sessionId, onStarted, onAttemptUpdate, onConnected, onEnded } = options;
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;
  const queryClient = useQueryClient();
  const channelRef = useRef<Channel | null>(null);
  const [isChannelSubscribed, setIsChannelSubscribed] = useState(false);

  // Handle parallel dial started
  const handleStarted = useCallback(
    (event: ParallelDialStartedEvent) => {
      console.log("[ParallelDialer] Session started:", event);
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["parallel-dialer"] });
      onStarted?.(event);
    },
    [queryClient, onStarted]
  );

  // Handle attempt status update
  const handleAttemptUpdate = useCallback(
    (event: ParallelDialAttemptUpdateEvent) => {
      console.log("[ParallelDialer] Attempt update:", event);
      // Only process if it's for our session (or we're not filtering)
      if (sessionId && event.sessionId !== sessionId) return;

      // Invalidate session query to get updated data
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.parallelDialerSession(event.sessionId),
      });
      onAttemptUpdate?.(event);
    },
    [queryClient, sessionId, onAttemptUpdate]
  );

  // Handle call connected
  const handleConnected = useCallback(
    (event: ParallelDialConnectedEvent) => {
      console.log("[ParallelDialer] Call connected:", event);
      // Only process if it's for our session (or we're not filtering)
      if (sessionId && event.sessionId !== sessionId) return;

      // Invalidate session query
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.parallelDialerSession(event.sessionId),
      });
      onConnected?.(event);
    },
    [queryClient, sessionId, onConnected]
  );

  // Handle session ended
  const handleEnded = useCallback(
    (event: ParallelDialEndedEvent) => {
      console.log("[ParallelDialer] Session ended:", event);
      // Invalidate all parallel dialer queries
      queryClient.invalidateQueries({ queryKey: ["parallel-dialer"] });
      queryClient.invalidateQueries({ queryKey: ["dialer", "sessions"] });
      onEnded?.(event);
    },
    [queryClient, onEnded]
  );

  useEffect(() => {
    // Skip if Pusher is disabled or no org
    if (!isPusherEnabled() || !orgId) return;

    const pusher = getPusherClient();
    if (!pusher) return;

    // Subscribe to organization's presence channel
    const channelName = channels.presenceOrg(orgId);
    const channel = pusher.subscribe(channelName);
    channelRef.current = channel;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- necessary to track subscription status
    setIsChannelSubscribed(true);

    // Bind to parallel dialer events
    channel.bind(PUSHER_EVENTS.PARALLEL_DIAL_STARTED, handleStarted);
    channel.bind(PUSHER_EVENTS.PARALLEL_DIAL_ATTEMPT_UPDATE, handleAttemptUpdate);
    channel.bind(PUSHER_EVENTS.PARALLEL_DIAL_CONNECTED, handleConnected);
    channel.bind(PUSHER_EVENTS.PARALLEL_DIAL_ENDED, handleEnded);

    // Cleanup on unmount
    return () => {
      channel.unbind(PUSHER_EVENTS.PARALLEL_DIAL_STARTED, handleStarted);
      channel.unbind(PUSHER_EVENTS.PARALLEL_DIAL_ATTEMPT_UPDATE, handleAttemptUpdate);
      channel.unbind(PUSHER_EVENTS.PARALLEL_DIAL_CONNECTED, handleConnected);
      channel.unbind(PUSHER_EVENTS.PARALLEL_DIAL_ENDED, handleEnded);
      pusher.unsubscribe(channelName);
      channelRef.current = null;
      setIsChannelSubscribed(false);
    };
  }, [orgId, handleStarted, handleAttemptUpdate, handleConnected, handleEnded]);

  return {
    isSubscribed: isPusherEnabled() && !!orgId && isChannelSubscribed,
  };
}

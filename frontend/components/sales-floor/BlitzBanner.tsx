"use client";

import { useState, useEffect } from "react";
import { Zap, Clock, Target, Users } from "lucide-react";
import { useJoinBlitz } from "@/hooks/api/useSalesFloor";
import type { BlitzResponse } from "@shared/types/src/requests/salesFloor";

interface BlitzBannerProps {
  blitz: BlitzResponse;
}

export function BlitzBanner({ blitz }: BlitzBannerProps) {
  const [timeRemaining, setTimeRemaining] = useState("");
  const joinBlitz = useJoinBlitz();

  useEffect(() => {
    const updateTimer = () => {
      const end = new Date(blitz.endAt);
      const now = new Date();
      const diffMs = end.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeRemaining("Ended");
        return;
      }

      const minutes = Math.floor(diffMs / 60000);
      const seconds = Math.floor((diffMs % 60000) / 1000);

      if (minutes < 60) {
        setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
      } else {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        setTimeRemaining(
          `${hours}:${remainingMinutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`
        );
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [blitz.endAt]);

  const handleJoin = async () => {
    try {
      await joinBlitz.mutateAsync(blitz.id);
    } catch (error) {
      console.error("Failed to join blitz:", error);
    }
  };

  // Calculate current value based on goal type
  const getCurrentValue = () => {
    switch (blitz.goalType) {
      case "calls":
        return blitz.totalCalls;
      case "connects":
        return blitz.totalConnects;
      case "meetings":
        return blitz.totalMeetings;
      default:
        return blitz.totalCalls;
    }
  };

  const currentValue = getCurrentValue();
  const goalValue = blitz.goalTarget || 100;
  const progress = blitz.goalProgress ?? Math.min((currentValue / goalValue) * 100, 100);

  const formatGoalLabel = () => {
    switch (blitz.goalType) {
      case "calls":
        return `${goalValue} calls`;
      case "connects":
        return `${goalValue} connections`;
      case "meetings":
        return `${goalValue} meetings`;
      default:
        return `${goalValue} calls`;
    }
  };

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-4 text-white">
      {/* Animated background effect */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute top-1/2 right-1/4 w-24 h-24 bg-white/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "500ms" }}
        />
      </div>

      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 bg-white/20 rounded-full">
            <Zap className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold">{blitz.name}</h3>
              <span className="px-2 py-0.5 text-xs bg-white/20 rounded-full">
                LIVE
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-white/80">
              <div className="flex items-center gap-1">
                <Target className="w-4 h-4" />
                <span>Goal: {formatGoalLabel()}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{blitz.totalParticipants} participants</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Progress */}
          <div className="text-center">
            <div className="text-3xl font-bold">
              {currentValue}
              <span className="text-lg text-white/60">/{goalValue}</span>
            </div>
            <div className="w-32 h-2 bg-white/20 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-white transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Timer */}
          <div className="text-center">
            <div className="flex items-center gap-1 text-sm text-white/80 mb-1">
              <Clock className="w-4 h-4" />
              Time Remaining
            </div>
            <div className="text-2xl font-mono font-bold">{timeRemaining}</div>
          </div>

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={joinBlitz.isPending}
            className="px-6 py-2 bg-white text-amber-600 font-bold rounded-md hover:bg-white/90 transition-colors disabled:opacity-50"
          >
            {joinBlitz.isPending ? "Joining..." : "Join Blitz"}
          </button>
        </div>
      </div>
    </div>
  );
}

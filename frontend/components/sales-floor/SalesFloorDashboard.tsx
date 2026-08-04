"use client";

import { useState } from "react";
import { Users, Trophy, Zap } from "lucide-react";
import { useSalesFloorStatus, useSalesFloorLeaderboard, type LeaderboardPeriod } from "@/hooks/api/useSalesFloor";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import { useSession } from "@/lib/auth-client";
import { LiveLeaderboard } from "./LiveLeaderboard";
import { ActiveRepsFeed } from "./ActiveRepsFeed";
import { BlitzBanner } from "./BlitzBanner";
import { RepProfileModal } from "./RepProfileModal";
import type { ActiveRepStatus } from "@shared/types/src/requests/salesFloor";

interface Member {
  id: string;
  userId: string;
  role: string;
}

interface SalesFloorDashboardProps {
  organizationId: string;
}

export function SalesFloorDashboard({ organizationId }: SalesFloorDashboardProps) {
  const [metricType, setMetricType] = useState<"calls" | "connections" | "talk_time" | "conversions">("calls");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>("all");
  const [selectedRepProfile, setSelectedRepProfile] = useState<{
    userId: string;
    userName: string;
    userImage?: string | null;
  } | null>(null);
  const { data: session } = useSession();

  const { data: status, isLoading: statusLoading, refetch: refetchStatus } = useSalesFloorStatus();

  // Get organization members to check user role
  const { data: membersData } = useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];

  // Check if current user is admin or owner (can use manager features)
  const currentUserMember = members.find((m) => m.userId === session?.user?.id);
  const isManager = currentUserMember?.role === 'admin' || currentUserMember?.role === 'owner';

  const { data: leaderboard, isLoading: leaderboardLoading } = useSalesFloorLeaderboard({
    period: leaderboardPeriod,
    metricType,
  });

  const activeReps = status?.activeReps || [];
  const onCallReps = activeReps.filter((rep) => rep.status === 'on_call');

  const handleRepClickFromFeed = (rep: ActiveRepStatus) => {
    setSelectedRepProfile({
      userId: rep.userId,
      userName: rep.userName,
      userImage: rep.userImage,
    });
  };

  const handleRepClickFromLeaderboard = (userId: string, userName: string, userImage?: string | null) => {
    setSelectedRepProfile({ userId, userName, userImage });
  };

  return (
    <div className="space-y-6">
      {/* Active Blitz Banner */}
      {status?.activeBlitz && (
        <BlitzBanner blitz={status.activeBlitz} />
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            <span className="text-sm">Active Reps</span>
          </div>
          <div className="text-2xl font-bold">{activeReps.length}</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm">On Calls Now</span>
          </div>
          <div className="text-2xl font-bold text-green-500">{onCallReps.length}</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Trophy className="w-4 h-4" />
            <span className="text-sm">Total Calls Today</span>
          </div>
          <div className="text-2xl font-bold">{status?.totalCallsToday || 0}</div>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Zap className="w-4 h-4" />
            <span className="text-sm">Connections Today</span>
          </div>
          <div className="text-2xl font-bold">{status?.totalConnectsToday || 0}</div>
        </div>
      </div>

      {/* Main Content: Leaderboard (prominent, left) + Active Reps (compact, right) */}
      <div className="grid grid-cols-3 gap-6">
        {/* Leaderboard - Primary Feature (2/3 width) */}
        <div className="col-span-2">
          <LiveLeaderboard
            leaderboard={leaderboard?.entries || []}
            isLoading={leaderboardLoading}
            metricType={metricType}
            onMetricChange={setMetricType}
            period={leaderboardPeriod}
            onPeriodChange={setLeaderboardPeriod}
            onRepClick={handleRepClickFromLeaderboard}
          />
        </div>

        {/* Active Reps - Live Feed (1/3 width) */}
        <div>
          <ActiveRepsFeed
            reps={activeReps}
            isLoading={statusLoading}
            isManager={isManager}
            onRepClick={handleRepClickFromFeed}
            onRefresh={() => refetchStatus()}
          />
        </div>
      </div>

      {/* Rep Profile Modal */}
      <RepProfileModal
        open={!!selectedRepProfile}
        onOpenChange={(open) => !open && setSelectedRepProfile(null)}
        organizationId={organizationId}
        userId={selectedRepProfile?.userId || ""}
        userName={selectedRepProfile?.userName || ""}
        userImage={selectedRepProfile?.userImage}
      />
    </div>
  );
}

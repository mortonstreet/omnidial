"use client";

import { useState } from "react";
import { Sparkles, TrendingUp, Award, Target, Phone, Clock, Play, Loader2, User } from "lucide-react";
import Link from "next/link";
import { useRecentCoaching, useCoachingStats, useUncoachedCalls, useGenerateCoaching } from "@/hooks/api/useCoaching";
import { CoachingCard } from "@/components/coaching";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import type { UncoachedCall } from "@shared/types/src/requests/coaching";

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: typeof Sparkles;
}) {
  return (
    <div className="p-6 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <p className="text-3xl font-bold text-foreground">{value}</p>
      {subtitle && (
        <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function UncoachedCallCard({
  call,
  onAnalyze,
  isAnalyzing,
}: {
  call: UncoachedCall;
  onAnalyze: (callId: string) => void;
  isAnalyzing: boolean;
}) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {call.leadId && call.leadName ? (
              <>
                <User className="w-4 h-4 text-muted-foreground" />
                <Link
                  href={`/dashboard/leads/${call.leadId}`}
                  className="font-medium text-primary hover:underline truncate"
                >
                  {call.leadName}
                </Link>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-foreground truncate">
                  {call.leadName || call.phoneNumber}
                </span>
              </>
            )}
            {call.leadCompany && (
              <span className="text-sm text-muted-foreground truncate">
                @ {call.leadCompany}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDuration(call.duration)}
            </span>
            <span className="capitalize">{call.direction}</span>
            {call.userName && <span>by {call.userName}</span>}
            <span>{formatDistanceToNow(new Date(call.createdAt), { addSuffix: true })}</span>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => onAnalyze(call.id)}
          disabled={isAnalyzing}
          className="shrink-0"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              Analyze
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function ScoreDistributionChart({
  distribution,
}: {
  distribution: Record<string, number>;
}) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
  const maxCount = Math.max(...Object.values(distribution), 1);

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Good";
    if (score >= 6) return "Average";
    return "Needs improvement";
  };

  return (
    <div className="space-y-3" role="list" aria-label="Score distribution">
      {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((score) => {
        const count = distribution[String(score)] || 0;
        const percentage = total > 0 ? (count / total) * 100 : 0;
        const barWidth = (count / maxCount) * 100;

        return (
          <div
            key={score}
            className="flex items-center gap-3"
            role="listitem"
            aria-label={`Score ${score} (${getScoreLabel(score)}): ${count} calls, ${percentage.toFixed(0)}%`}
          >
            <span className="text-sm font-medium text-muted-foreground w-8">
              {score}
            </span>
            <div
              className="flex-1 h-6 bg-muted rounded-md overflow-hidden"
              role="progressbar"
              aria-valuenow={barWidth}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${getScoreLabel(score)} score`}
            >
              <div
                className={`h-full rounded-md transition-all ${
                  score >= 8
                    ? "bg-green-500"
                    : score >= 6
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <span className="text-sm text-muted-foreground w-12 text-right">
              {count} ({percentage.toFixed(0)}%)
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function CoachingPage() {
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"recent" | "uncoached">("uncoached");
  const [analyzingCallId, setAnalyzingCallId] = useState<string | null>(null);

  const minScore =
    scoreFilter === "high"
      ? 8
      : scoreFilter === "medium"
      ? 6
      : scoreFilter === "low"
      ? undefined
      : undefined;
  const maxScore =
    scoreFilter === "low" ? 5 : scoreFilter === "medium" ? 7 : undefined;

  const {
    data: recentCoaching,
    isLoading: isLoadingRecent,
  } = useRecentCoaching({ limit: 10, minScore, maxScore });

  const { data: stats, isLoading: isLoadingStats } = useCoachingStats();

  const {
    data: uncoachedCalls,
    isLoading: isLoadingUncoached,
    refetch: refetchUncoached,
  } = useUncoachedCalls({ limit: 20 });

  const generateCoaching = useGenerateCoaching();

  const handleAnalyze = async (callId: string) => {
    setAnalyzingCallId(callId);
    try {
      await generateCoaching.mutateAsync(callId);
      refetchUncoached();
    } catch (error) {
      console.error("Failed to generate coaching:", error);
    } finally {
      setAnalyzingCallId(null);
    }
  };

  const isLoading = isLoadingRecent || isLoadingStats || isLoadingUncoached;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-semibold text-2xl md:text-3xl tracking-tight text-foreground">
            Sales Coach
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            AI-powered call coaching and performance insights
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Coached"
          value={stats?.totalCoached || 0}
          subtitle="Calls analyzed"
          icon={Sparkles}
        />
        <StatCard
          title="Average Score"
          value={stats?.averageScore?.toFixed(1) || "0.0"}
          subtitle="Out of 10"
          icon={TrendingUp}
        />
        <StatCard
          title="High Performers"
          value={
            Object.entries(stats?.scoreDistribution || {})
              .filter(([score]) => parseInt(score) >= 8)
              .reduce((sum, [, count]) => sum + count, 0)
          }
          subtitle="Score 8+"
          icon={Award}
        />
        <StatCard
          title="Needs Improvement"
          value={
            Object.entries(stats?.scoreDistribution || {})
              .filter(([score]) => parseInt(score) < 6)
              .reduce((sum, [, count]) => sum + count, 0)
          }
          subtitle="Score < 6"
          icon={Target}
        />
      </div>

      {/* Main Content */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Calls Section with Tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 p-1 rounded-lg bg-muted">
              <button
                onClick={() => setActiveTab("uncoached")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "uncoached"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ready to Analyze
                {uncoachedCalls && uncoachedCalls.length > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary">
                    {uncoachedCalls.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("recent")}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === "recent"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Recent Coaching
              </button>
            </div>
            {activeTab === "recent" && (
              <Select value={scoreFilter} onValueChange={setScoreFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by score" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scores</SelectItem>
                  <SelectItem value="high">High (8-10)</SelectItem>
                  <SelectItem value="medium">Medium (6-7)</SelectItem>
                  <SelectItem value="low">Low (1-5)</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Uncoached Calls Tab */}
          {activeTab === "uncoached" && (
            <>
              {isLoadingUncoached ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-20 bg-muted rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : uncoachedCalls?.length === 0 ? (
                <div className="text-center py-16 border rounded-xl bg-card">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                    <Award className="w-8 h-8 text-green-500" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    All caught up!
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto">
                    No eligible calls waiting for analysis. New calls over 60 seconds will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    These calls are ready for AI coaching analysis. Click &quot;Analyze&quot; to get feedback.
                  </p>
                  {uncoachedCalls?.map((call) => (
                    <UncoachedCallCard
                      key={call.id}
                      call={call}
                      onAnalyze={handleAnalyze}
                      isAnalyzing={analyzingCallId === call.id}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* Recent Coaching Tab */}
          {activeTab === "recent" && (
            <>
              {isLoadingRecent ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-48 bg-muted rounded-xl animate-pulse"
                    />
                  ))}
                </div>
              ) : recentCoaching?.length === 0 ? (
                <div className="text-center py-16 border rounded-xl bg-card">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground mb-2">
                    No coaching yet
                  </h3>
                  <p className="text-muted-foreground max-w-sm mx-auto mb-4">
                    Start getting AI-powered feedback on your calls. Switch to the
                    &quot;Ready to Analyze&quot; tab to analyze your first call.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentCoaching?.map((coaching) => (
                    <CoachingCard key={coaching.id} coaching={coaching} showLeadLink />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Score Distribution */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Score Distribution
          </h2>
          <div className="p-6 rounded-xl border border-border bg-card">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-6 bg-muted rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <ScoreDistributionChart
                distribution={stats?.scoreDistribution || {}}
              />
            )}
          </div>

          {/* Tips */}
          <div className="p-6 rounded-xl border border-border bg-card">
            <h3 className="text-sm font-medium text-foreground mb-3">
              How to Improve
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-primary">1.</span>
                <span>Review calls scoring below 6 first</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">2.</span>
                <span>Focus on one improvement area per week</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">3.</span>
                <span>Practice specific objection handling</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">4.</span>
                <span>Track your talk-to-listen ratio</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

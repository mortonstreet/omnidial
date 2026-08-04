"use client";

import { TrendingUp, Clock, Phone, HelpCircle } from "lucide-react";
import { useLeadPredictiveScore } from "@/hooks/api/usePredictiveScoring";

interface PredictiveScoreIndicatorProps {
  leadId: string;
  showDetails?: boolean;
}

export function PredictiveScoreIndicator({
  leadId,
  showDetails = false,
}: PredictiveScoreIndicatorProps) {
  const { data: score, isLoading } = useLeadPredictiveScore(leadId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <div className="w-4 h-4 bg-muted rounded-full animate-pulse" />
        <span className="text-xs">Loading...</span>
      </div>
    );
  }

  if (!score) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <HelpCircle className="w-4 h-4" />
        <span className="text-xs">No score</span>
      </div>
    );
  }

  const percentage = Math.round(score.score * 100);
  const getScoreColor = () => {
    if (percentage >= 70) return "text-green-500";
    if (percentage >= 40) return "text-amber-500";
    return "text-red-500";
  };

  const getScoreLabel = () => {
    if (percentage >= 70) return "High";
    if (percentage >= 40) return "Medium";
    return "Low";
  };

  const getScoreBgColor = () => {
    if (percentage >= 70) return "bg-green-500";
    if (percentage >= 40) return "bg-amber-500";
    return "bg-red-500";
  };

  if (!showDetails) {
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${getScoreBgColor()}`} />
        <span className={`text-xs font-medium ${getScoreColor()}`}>
          {percentage}%
        </span>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className={`w-4 h-4 ${getScoreColor()}`} />
          <span className="text-sm font-medium">Answer Likelihood</span>
        </div>
        <div className={`text-lg font-bold ${getScoreColor()}`}>
          {percentage}%
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full ${getScoreBgColor()} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className={getScoreColor()}>{getScoreLabel()} likelihood</span>
        <span>Updated {new Date(score.calculatedAt).toLocaleDateString()}</span>
      </div>

      {/* Score factors */}
      {(score.bestHourOfDay !== null || score.bestDayOfWeek !== null || score.phoneType || score.totalAttempts > 0) && (
        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <span className="text-xs font-medium text-muted-foreground">
            Scoring Factors
          </span>

          {score.bestHourOfDay !== null && (
            <div className="flex items-center gap-2 text-xs">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span>Best time: {score.bestHourOfDay}:00</span>
            </div>
          )}

          {score.bestDayOfWeek !== null && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span>Best day: {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][score.bestDayOfWeek]}</span>
            </div>
          )}

          {score.phoneType && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span>Phone type: {score.phoneType}</span>
            </div>
          )}

          {score.totalAttempts > 0 && (
            <div className="flex items-center gap-2 text-xs">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span>Previous attempts: {score.totalAttempts}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

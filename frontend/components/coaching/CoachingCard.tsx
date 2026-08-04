"use client";

import { useState } from "react";
import {
  Star,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Quote,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Coaching, CoachingFeedback } from "@shared/types/src/requests/coaching";

interface CoachingCardProps {
  coaching: Coaching;
  showExpanded?: boolean;
  showLeadLink?: boolean;
  className?: string;
}

const FEEDBACK_CATEGORIES = [
  { key: "opening", label: "Opening/Hook" },
  { key: "discovery", label: "Discovery" },
  { key: "objectionHandling", label: "Objection Handling" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "callControl", label: "Call Control" },
  { key: "closing", label: "Closing" },
  { key: "toneAndEnergy", label: "Tone & Energy" },
  { key: "talkListenRatio", label: "Talk/Listen Ratio" },
] as const;

function ScoreBadge({ score }: { score: number }) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "bg-green-500/10 text-green-600 border-green-500/20";
    if (score >= 6) return "bg-amber-500/10 text-amber-600 border-amber-500/20";
    return "bg-red-500/10 text-red-600 border-red-500/20";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Good";
    if (score >= 6) return "Average";
    return "Needs improvement";
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-semibold border",
        getScoreColor(score)
      )}
      aria-label={`Score: ${score} out of 10 (${getScoreLabel(score)})`}
    >
      <Star className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
      {score}/10
    </span>
  );
}

function CategoryScore({
  label,
  score,
  comment,
}: {
  label: string;
  score: number;
  comment: string;
}) {
  const getBarColor = (score: number) => {
    if (score >= 8) return "bg-green-500";
    if (score >= 6) return "bg-amber-500";
    return "bg-red-500";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 8) return "Good";
    if (score >= 6) return "Average";
    return "Needs improvement";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm text-muted-foreground">
          {score}/10
          <span className="sr-only"> ({getScoreLabel(score)})</span>
        </span>
      </div>
      <div
        className="h-2 bg-muted rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={10}
        aria-label={`${label}: ${score} out of 10, ${getScoreLabel(score)}`}
      >
        <div
          className={cn("h-full rounded-full transition-all", getBarColor(score))}
          style={{ width: `${score * 10}%` }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{comment}</p>
    </div>
  );
}

export function CoachingCard({
  coaching,
  showExpanded = false,
  showLeadLink = false,
  className,
}: CoachingCardProps) {
  const [expanded, setExpanded] = useState(showExpanded);
  const feedback = coaching.feedback as CoachingFeedback;

  // Build lead display name
  const leadName =
    coaching.leadFirstName || coaching.leadLastName
      ? `${coaching.leadFirstName || ""} ${coaching.leadLastName || ""}`.trim()
      : null;

  return (
    <div
      className={cn(
        "p-6 rounded-xl border border-border bg-card space-y-6",
        className
      )}
    >
      {/* Header with Score */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="font-semibold text-lg text-foreground">
              Sales Coach Feedback
            </h3>
          </div>
          {showLeadLink && leadName && coaching.leadId ? (
            <Link
              href={`/dashboard/leads/${coaching.leadId}`}
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <User className="w-3.5 h-3.5" />
              <span>{leadName}</span>
              {coaching.leadCompany && (
                <span className="text-muted-foreground">@ {coaching.leadCompany}</span>
              )}
            </Link>
          ) : showLeadLink && leadName ? (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <User className="w-3.5 h-3.5" />
              <span>{leadName}</span>
              {coaching.leadCompany && <span>@ {coaching.leadCompany}</span>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              AI-powered call analysis
            </p>
          )}
        </div>
        <ScoreBadge score={coaching.overallScore} />
      </div>

      {/* Unhinged Quote */}
      {coaching.unhingedQuote && (
        <div className="relative bg-primary/5 border border-primary/10 rounded-lg p-4">
          <Quote className="absolute top-3 left-3 w-4 h-4 text-primary/40" />
          <p className="text-sm font-medium text-foreground pl-6 pr-2 italic">
            &quot;{coaching.unhingedQuote}&quot;
          </p>
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Strengths */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <h4 className="text-sm font-medium text-foreground">Strengths</h4>
          </div>
          <ul className="space-y-2">
            {coaching.strengths.map((strength, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-green-500 mt-1">+</span>
                <span>{strength}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Improvements */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            <h4 className="text-sm font-medium text-foreground">Areas to Improve</h4>
          </div>
          <ul className="space-y-2">
            {coaching.improvements.map((improvement, index) => (
              <li
                key={index}
                className="flex items-start gap-2 text-sm text-muted-foreground"
              >
                <span className="text-amber-500 mt-1">→</span>
                <span>{improvement}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Expand/Collapse Button */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
      >
        {expanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            Hide detailed breakdown
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            Show detailed breakdown
          </>
        )}
      </button>

      {/* Detailed Breakdown */}
      {expanded && (
        <div className="space-y-6 pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-foreground">
            Category Breakdown
          </h4>
          <div className="grid gap-6 sm:grid-cols-2">
            {FEEDBACK_CATEGORIES.map(({ key, label }) => {
              const category = feedback[key as keyof CoachingFeedback];
              if (!category) return null;
              return (
                <CategoryScore
                  key={key}
                  label={label}
                  score={category.score}
                  comment={category.comment}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Metadata Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-border">
        <span>
          Generated {new Date(coaching.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}
        </span>
        <span>Model: {coaching.modelUsed}</span>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { X, ThumbsUp, ThumbsDown, Lightbulb, ChevronRight } from "lucide-react";
import { useSubmitTriggerFeedback } from "@/hooks/api/useLiveCoach";

interface CoachCardOverlayProps {
  card: {
    id: string;
    triggerId: string;
    title: string;
    category: string;
    content: string;
    tips?: string[];
    triggerPhrase: string;
  };
  onDismiss: () => void;
}

export function CoachCardOverlay({ card, onDismiss }: CoachCardOverlayProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const submitFeedback = useSubmitTriggerFeedback();

  // Auto-dismiss after 30 seconds if minimized
  useEffect(() => {
    if (isMinimized) {
      const timer = setTimeout(onDismiss, 30000);
      return () => clearTimeout(timer);
    }
  }, [isMinimized, onDismiss]);

  const handleFeedback = async (wasHelpful: boolean) => {
    try {
      await submitFeedback.mutateAsync({
        triggerId: card.triggerId,
        wasHelpful,
      });
      setFeedbackGiven(true);
      setTimeout(onDismiss, 1500);
    } catch (error) {
      console.error("Failed to submit feedback:", error);
    }
  };

  const getCategoryColor = () => {
    switch (card.category) {
      case "objection":
        return "border-red-500 bg-red-500/5";
      case "question":
        return "border-blue-500 bg-blue-500/5";
      case "closing":
        return "border-green-500 bg-green-500/5";
      case "discovery":
        return "border-purple-500 bg-purple-500/5";
      default:
        return "border-amber-500 bg-amber-500/5";
    }
  };

  const getCategoryIcon = () => {
    return <Lightbulb className="w-5 h-5" />;
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-lg border-2 shadow-lg z-50 transition-all hover:scale-105 ${getCategoryColor()}`}
      >
        {getCategoryIcon()}
        <span className="font-medium">{card.title}</span>
        <ChevronRight className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 w-96 rounded-lg border-2 shadow-xl z-50 overflow-hidden ${getCategoryColor()}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          {getCategoryIcon()}
          <div>
            <h3 className="font-medium">{card.title}</h3>
            <span className="text-xs text-muted-foreground capitalize">
              {card.category}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="Minimize"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-muted rounded-md transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Trigger phrase indicator */}
      <div className="px-4 py-2 bg-muted/50 text-xs text-muted-foreground">
        Triggered by: &quot;{card.triggerPhrase}&quot;
      </div>

      {/* Content */}
      <div className="p-4 bg-background">
        <p className="text-sm leading-relaxed mb-4">{card.content}</p>

        {/* Tips */}
        {card.tips && card.tips.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Quick Tips
            </h4>
            <ul className="space-y-1.5">
              {card.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Feedback */}
      <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
        {feedbackGiven ? (
          <span className="text-sm text-green-500">Thanks for your feedback!</span>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">
              Was this helpful?
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleFeedback(true)}
                disabled={submitFeedback.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-500/10 text-green-500 rounded-md hover:bg-green-500/20 transition-colors disabled:opacity-50"
              >
                <ThumbsUp className="w-4 h-4" />
                Yes
              </button>
              <button
                onClick={() => handleFeedback(false)}
                disabled={submitFeedback.isPending}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-500/10 text-red-500 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-50"
              >
                <ThumbsDown className="w-4 h-4" />
                No
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useSetCallDisposition, useSuggestDisposition } from "@/hooks/api/useCalls";
import type { DispositionResponse } from "@shared/types/src";
import { Sparkles, Loader2 } from "lucide-react";

interface DispositionSuggestion {
  dispositionId: string;
  dispositionLabel: string;
  confidence: number;
  reasoning: string;
}

interface DispositionSelectorProps {
  callId: string;
  dispositions: DispositionResponse[];
  onSelect?: (dispositionId: string) => void;
  enableSuggestions?: boolean;
  transcript?: string;
}

export function DispositionSelector({
  callId,
  dispositions,
  onSelect,
  enableSuggestions = true,
  transcript,
}: DispositionSelectorProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DispositionSuggestion[]>([]);
  const { mutate: setDisposition, isPending } = useSetCallDisposition();
  const { mutate: getSuggestions, isPending: isLoadingSuggestions } = useSuggestDisposition();

  // Fetch AI suggestions when component mounts or callId changes
  useEffect(() => {
    if (enableSuggestions && callId && dispositions.length > 0) {
      getSuggestions(
        { callId, transcript },
        {
          onSuccess: (data) => {
            if (data?.suggestions) {
              setSuggestions(data.suggestions);
            }
          },
          onError: () => {
            // Silently fail - suggestions are optional
            setSuggestions([]);
          },
        }
      );
    }
  }, [callId, enableSuggestions, transcript, dispositions.length, getSuggestions]);

  const handleSelect = (dispositionId: string) => {
    setSelectedId(dispositionId);
    setDisposition(
      { callId, dispositionId },
      {
        onSuccess: () => {
          onSelect?.(dispositionId);
        },
      }
    );
  };

  // Get the top suggestion
  const topSuggestion = suggestions[0];
  const suggestedDisposition = topSuggestion
    ? dispositions.find((d) => d.id === topSuggestion.dispositionId)
    : null;

  return (
    <div className="space-y-3">
      {/* AI Suggestion Section */}
      {enableSuggestions && (
        <div className="mb-4">
          {isLoadingSuggestions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Getting AI suggestion...</span>
            </div>
          ) : topSuggestion && suggestedDisposition ? (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">AI Suggestion</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {Math.round(topSuggestion.confidence * 100)}% confident
                </span>
              </div>
              <button
                onClick={() => handleSelect(suggestedDisposition.id)}
                disabled={isPending}
                className={`w-full px-4 py-2 rounded-lg font-medium text-sm transition text-left ${
                  selectedId === suggestedDisposition.id
                    ? "ring-2 ring-primary"
                    : "hover:opacity-80"
                } disabled:opacity-50`}
                style={{
                  backgroundColor: suggestedDisposition.color + "20",
                  color: suggestedDisposition.color,
                }}
              >
                {suggestedDisposition.label}
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                {topSuggestion.reasoning}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* All Dispositions */}
      <div className="flex flex-wrap gap-2">
        {dispositions.map((disposition) => {
          const isSuggested = topSuggestion?.dispositionId === disposition.id;
          return (
            <button
              key={disposition.id}
              onClick={() => handleSelect(disposition.id)}
              disabled={isPending}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition ${
                selectedId === disposition.id
                  ? "ring-2 ring-primary"
                  : "hover:opacity-80"
              } disabled:opacity-50 ${isSuggested && !selectedId ? "ring-1 ring-primary/50" : ""}`}
              style={{
                backgroundColor: disposition.color + "20",
                color: disposition.color,
                borderColor: disposition.color,
              }}
            >
              {disposition.label}
              {isSuggested && (
                <Sparkles className="inline-block h-3 w-3 ml-1" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

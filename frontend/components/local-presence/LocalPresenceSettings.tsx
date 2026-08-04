"use client";

import { useState } from "react";
import { MapPin, AlertTriangle, Check, Loader2 } from "lucide-react";
import {
  useAreaCodeCoverage,
  useMissingAreaCodes,
} from "@/hooks/api/useLocalPresence";

interface LocalPresenceSettingsProps {
  listId?: string;
}

export function LocalPresenceSettings({ listId }: LocalPresenceSettingsProps) {
  const [enabled, setEnabled] = useState(true);

  const { data: coverage, isLoading: coverageLoading } = useAreaCodeCoverage();
  const { data: missingCodes, isLoading: missingLoading } = useMissingAreaCodes(
    listId,
    !!listId
  );

  // Calculate coverage percentage based on area codes with at least one active number
  const coveredAreaCodes = coverage?.coverage.filter(c => c.activeNumberCount > 0) || [];
  const uncoveredAreaCodes = coverage?.coverage.filter(c => c.activeNumberCount === 0) || [];
  const coveragePercentage = coverage && coverage.totalAreaCodes > 0
    ? Math.round((coveredAreaCodes.length / coverage.totalAreaCodes) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Enable toggle */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h3 className="font-medium">Local Presence Dialing</h3>
              <p className="text-sm text-muted-foreground">
                Automatically match caller ID area codes to lead locations
              </p>
            </div>
          </div>
          <button
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              enabled ? "bg-green-500" : "bg-muted"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                enabled ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Coverage stats */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h4 className="font-medium mb-4">Area Code Coverage</h4>

        {coverageLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : coverage ? (
          <>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">
                    Coverage
                  </span>
                  <span className="font-bold">{coveragePercentage}%</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      coveragePercentage >= 80
                        ? "bg-green-500"
                        : coveragePercentage >= 50
                        ? "bg-amber-500"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${coveragePercentage}%` }}
                  />
                </div>
              </div>

              <div className="text-center px-4 border-l border-border">
                <div className="text-2xl font-bold text-green-500">
                  {coveredAreaCodes.length}
                </div>
                <div className="text-xs text-muted-foreground">Covered</div>
              </div>

              <div className="text-center px-4 border-l border-border">
                <div className="text-2xl font-bold text-red-500">
                  {uncoveredAreaCodes.length}
                </div>
                <div className="text-xs text-muted-foreground">Missing</div>
              </div>
            </div>

            {/* Covered area codes */}
            <div className="mb-4">
              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                Covered Area Codes
              </h5>
              <div className="flex flex-wrap gap-1">
                {coveredAreaCodes.slice(0, 20).map((item) => (
                  <span
                    key={item.areaCode}
                    className="px-2 py-0.5 text-xs bg-green-500/10 text-green-500 rounded"
                  >
                    {item.areaCode}
                  </span>
                ))}
                {coveredAreaCodes.length > 20 && (
                  <span className="px-2 py-0.5 text-xs text-muted-foreground">
                    +{coveredAreaCodes.length - 20} more
                  </span>
                )}
              </div>
            </div>

            {/* Uncovered area codes */}
            {uncoveredAreaCodes.length > 0 && (
              <div>
                <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Missing Area Codes
                </h5>
                <div className="flex flex-wrap gap-1">
                  {uncoveredAreaCodes.slice(0, 20).map((item) => (
                    <span
                      key={item.areaCode}
                      className="px-2 py-0.5 text-xs bg-red-500/10 text-red-500 rounded"
                    >
                      {item.areaCode}
                    </span>
                  ))}
                  {uncoveredAreaCodes.length > 20 && (
                    <span className="px-2 py-0.5 text-xs text-muted-foreground">
                      +{uncoveredAreaCodes.length - 20} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            No coverage data available
          </p>
        )}
      </div>

      {/* List-specific missing codes */}
      {listId && (
        <div className="bg-card border border-border rounded-lg p-4">
          <h4 className="font-medium mb-4">Missing for This List</h4>

          {missingLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : missingCodes?.missingAreaCodes?.length ? (
            <>
              <p className="text-sm text-muted-foreground mb-3">
                These area codes appear in your list but you don&apos;t have
                matching phone numbers:
              </p>
              <div className="flex flex-wrap gap-2">
                {missingCodes.missingAreaCodes.map((item) => (
                  <div
                    key={item.areaCode}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md"
                  >
                    <span className="font-mono text-sm">{item.areaCode}</span>
                    <span className="text-xs text-muted-foreground">
                      ({item.leadCount} leads)
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Consider purchasing numbers with these area codes to improve
                answer rates.
              </p>
            </>
          ) : (
            <div className="flex items-center gap-2 text-green-500">
              <Check className="w-5 h-5" />
              <span className="text-sm">
                All area codes in this list are covered!
              </span>
            </div>
          )}
        </div>
      )}

      {/* Fallback settings */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h4 className="font-medium mb-4">Fallback Behavior</h4>
        <p className="text-sm text-muted-foreground mb-3">
          When no matching local number is available:
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="fallback"
              defaultChecked
              className="w-4 h-4"
            />
            <span className="text-sm">Use default outbound number</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="fallback" className="w-4 h-4" />
            <span className="text-sm">Use closest geographic match</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="radio" name="fallback" className="w-4 h-4" />
            <span className="text-sm">Skip lead (manual dial only)</span>
          </label>
        </div>
      </div>
    </div>
  );
}

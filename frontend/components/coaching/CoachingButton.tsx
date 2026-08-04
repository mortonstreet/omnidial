"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCoachingEligibility,
  useCallCoaching,
  useGenerateCoaching,
} from "@/hooks/api/useCoaching";
import { CoachingCard } from "./CoachingCard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CoachingButtonProps {
  callId: string;
  callDuration?: number;
  className?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function CoachingButton({
  callId,
  callDuration = 0,
  className,
  variant = "outline",
  size = "sm",
}: CoachingButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Quick client-side check - don't even show button for short calls
  const minimumDuration = 60;
  if (callDuration < minimumDuration) {
    return null;
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setIsOpen(true)}
        className={cn("gap-2", className)}
        aria-label="Coaching"
      >
        <Sparkles className="w-4 h-4" aria-hidden="true" />
        <span className="hidden sm:inline">Coaching</span>
      </Button>

      <CoachingDialog
        callId={callId}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}

interface CoachingDialogProps {
  callId: string;
  isOpen: boolean;
  onClose: () => void;
}

function CoachingDialog({ callId, isOpen, onClose }: CoachingDialogProps) {
  const {
    data: eligibility,
    isLoading: isLoadingEligibility,
    error: _eligibilityError,
  } = useCoachingEligibility(callId, isOpen);

  const {
    data: existingCoaching,
    isLoading: isLoadingExisting,
    error: _existingError,
  } = useCallCoaching(callId, isOpen);

  const generateMutation = useGenerateCoaching();

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync(callId);
      toast.success("Coaching generated successfully!");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate coaching";
      toast.error(message);
    }
  };

  const isLoading = isLoadingEligibility || isLoadingExisting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Sales Coach
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Checking coaching status...
              </p>
            </div>
          ) : existingCoaching ? (
            // Show existing coaching
            <CoachingCard coaching={existingCoaching.coaching} showExpanded />
          ) : eligibility?.eligible ? (
            // Can generate coaching
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg text-foreground">
                  Ready for Coaching
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Get AI-powered feedback on this call. Our &quot;Unhinged Sales Coach&quot;
                  will analyze your conversation and provide actionable insights.
                </p>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="gap-2"
              >
                {generateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Generate Coaching
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Not eligible for coaching
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="font-semibold text-lg text-foreground">
                  Not Available
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  {eligibility?.reason ||
                    "This call is not eligible for coaching analysis."}
                </p>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Compact version for call history rows
export function CoachingIndicator({ callId }: { callId: string }) {
  const { data: coaching } = useCallCoaching(callId);

  if (!coaching) return null;

  return (
    <div className="flex items-center gap-1 text-primary" title="Has coaching feedback">
      <CheckCircle className="w-4 h-4" />
      <span className="text-xs font-medium">{coaching.coaching.overallScore}/10</span>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSetDealOutcome } from "@/hooks/api/useDealMetrics";
import {
  DEAL_LOSS_REASONS,
  DEAL_WIN_REASONS,
  type DealOutcome,
} from "@shared/types/src/requests/dealMetrics";

interface DealOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName?: string;
  outcome: DealOutcome;
}

/**
 * Captures why a deal was won or lost. Opened when a deal lands in a won/lost
 * stage, or from the lead page. Skipping is allowed; the deal metrics then
 * flag it as missing a reason.
 */
export function DealOutcomeDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  outcome,
}: DealOutcomeDialogProps) {
  const setOutcome = useSetDealOutcome();
  const [reason, setReason] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const reasons = outcome === "won" ? DEAL_WIN_REASONS : DEAL_LOSS_REASONS;
  const Icon = outcome === "won" ? Trophy : XCircle;

  const close = () => {
    setReason(null);
    setNotes("");
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!reason) return;
    try {
      const { data } = await setOutcome.mutateAsync({
        leadId,
        outcome,
        reason,
        notes: notes.trim() || null,
      });
      if (data.crmSync === "failed") {
        toast.warning("Reason saved, but HubSpot sync failed");
      } else {
        toast.success(
          data.crmSync === "synced" ? "Reason saved and synced to HubSpot" : "Reason saved"
        );
      }
      close();
    } catch (error) {
      toast.error("Failed to save reason", {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon
              className={`w-5 h-5 ${outcome === "won" ? "text-emerald-500" : "text-red-500"}`}
            />
            {outcome === "won" ? "Why did we win" : "Why did we lose"}
            {leadName ? ` ${leadName}?` : "?"}
          </DialogTitle>
          <DialogDescription>
            {outcome === "won"
              ? "Knowing what closes deals tells you what to repeat."
              : "Tracking why deals die is how you stop losing them the same way."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-2">
          {reasons.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setReason(option.value)}
              className={`text-sm text-left rounded-lg border px-3 py-2 transition-colors ${
                reason === option.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            outcome === "won"
              ? "What made the difference? (optional)"
              : "What would you do differently? (optional)"
          }
          rows={3}
          maxLength={2000}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={close}>
            Skip for now
          </Button>
          <Button onClick={handleSave} disabled={!reason || setOutcome.isPending}>
            {setOutcome.isPending ? "Saving..." : "Save reason"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

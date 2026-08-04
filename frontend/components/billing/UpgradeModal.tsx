"use client";

import { useState } from "react";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useActiveOrganization } from "@/lib/auth-client";
import { useCreateCheckoutSession } from "@/hooks/api/useStripe";
import { toast } from "sonner";
import {
  BillingInterval,
} from "@shared/types/src/stripe";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const { data: activeOrganization } = useActiveOrganization();
  const createCheckout = useCreateCheckoutSession();

  const price = interval === "month" ? 25 : 250;
  const monthlyEquivalent = interval === "year" ? "$20.83" : "$25";
  const planName = interval === "month" ? "pro-monthly" : "pro-annual";

  const handleUpgrade = () => {
    if (!activeOrganization) {
      toast.error("No active organization");
      return;
    }

    createCheckout.mutate(
      { planName, organizationId: activeOrganization.id },
      {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onSuccess: (data: any) => {
          if (data?.error) {
            toast.error(
              data.error.message || "Failed to create checkout session"
            );
          } else if (data?.data?.url) {
            window.location.href = data.data.url;
          }
        },
        onError: () => {
          toast.error("Failed to start checkout");
        },
      }
    );
  };

  const proFeatures = [
    "Everything in Starter",
    "AI Sales Coaching",
    "Call Intelligence",
    "Priority Support",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Upgrade to Pro
          </DialogTitle>
          <DialogDescription>
            Unlock advanced AI features for your sales team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-2 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setInterval("month")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                interval === "month"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("year")}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                interval === "year"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="ml-1 text-xs text-green-600">Save 17%</span>
            </button>
          </div>

          {/* Price */}
          <div className="text-center">
            <span className="text-4xl font-bold text-foreground">${price}</span>
            <span className="text-muted-foreground ml-1">
              /seat/{interval === "month" ? "mo" : "yr"}
            </span>
            {interval === "year" && (
              <p className="text-sm text-muted-foreground mt-1">
                {monthlyEquivalent}/seat/mo billed annually
              </p>
            )}
          </div>

          {/* Features */}
          <ul className="space-y-3">
            {proFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-sm text-foreground">{feature}</span>
              </li>
            ))}
          </ul>

          <Button
            onClick={handleUpgrade}
            disabled={createCheckout.isPending}
            className="w-full"
            size="lg"
          >
            {createCheckout.isPending ? "Redirecting..." : "Start 14-day free trial"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Credit card required. Cancel anytime during your trial.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

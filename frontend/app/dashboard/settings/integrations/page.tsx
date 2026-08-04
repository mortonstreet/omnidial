"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Page } from "@/components/dashboard/Page";
import { Button } from "@/components/ui/button";
import { IntegrationsSettings } from "@/components/settings/IntegrationsSettings";
import { SlackSettings } from "@/components/settings/SlackSettings";
import { CheckCircle2, XCircle, AlertCircle, ArrowLeft } from "lucide-react";

type SlackStatus = "connected" | "reconnected" | "denied" | "error" | null;

function IntegrationsPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(true);

  const slackStatus = searchParams.get("slack") as SlackStatus;
  const errorReason = searchParams.get("reason");

  // Clear the query params from URL after showing the banner (without navigation)
  useEffect(() => {
    if (slackStatus) {
      const timer = setTimeout(() => {
        // Use replaceState to clean up URL without triggering navigation
        window.history.replaceState({}, "", "/dashboard/settings/integrations");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [slackStatus]);

  const getBannerConfig = () => {
    switch (slackStatus) {
      case "connected":
        return {
          icon: CheckCircle2,
          iconColor: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          title: "Slack Connected Successfully",
          description:
            "Your Slack workspace is now connected to OmniDial. You can configure notifications below.",
        };
      case "reconnected":
        return {
          icon: CheckCircle2,
          iconColor: "text-green-600",
          bgColor: "bg-green-50 border-green-200",
          title: "Slack Reconnected",
          description:
            "Your Slack connection has been refreshed. All existing settings are preserved.",
        };
      case "denied":
        return {
          icon: XCircle,
          iconColor: "text-amber-600",
          bgColor: "bg-amber-50 border-amber-200",
          title: "Connection Cancelled",
          description:
            "You cancelled the Slack authorization. Click 'Add to Slack' below to try again.",
        };
      case "error":
        return {
          icon: AlertCircle,
          iconColor: "text-red-600",
          bgColor: "bg-red-50 border-red-200",
          title: "Connection Failed",
          description: errorReason
            ? `Unable to connect Slack: ${errorReason.replace(/_/g, " ")}`
            : "Something went wrong while connecting Slack. Please try again.",
        };
      default:
        return null;
    }
  };

  const bannerConfig = getBannerConfig();

  return (
    <Page
      title="Integrations"
      subtitle="Connect external services to OmniDial"
    >
      <div className="space-y-6">
        {/* Back to settings link */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/dashboard/settings")}
          className="gap-2 -ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </Button>

        {/* Status Banner */}
        {bannerConfig && showBanner && (
          <div
            className={`${bannerConfig.bgColor} border rounded-lg p-4 flex items-start gap-3`}
          >
            <bannerConfig.icon
              className={`w-5 h-5 ${bannerConfig.iconColor} flex-shrink-0 mt-0.5`}
            />
            <div className="flex-1">
              <h3 className="font-medium text-foreground">
                {bannerConfig.title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {bannerConfig.description}
              </p>
            </div>
            <button
              onClick={() => setShowBanner(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Slack Settings */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Slack</h2>
          <SlackSettings />
        </section>

        {/* Other Integrations */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Data Integrations</h2>
          <IntegrationsSettings />
        </section>
      </div>
    </Page>
  );
}

function LoadingState() {
  return (
    <div className="py-24 text-center text-muted-foreground">Loading...</div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <IntegrationsPageContent />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink, Loader2 } from "lucide-react";

function SlackInstalledContent() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("teamId");
  const appId = searchParams.get("appId");

  const attemptedDeepLink = useRef(false);

  useEffect(() => {
    // Attempt to open Slack app via deep link
    if (teamId && appId && !attemptedDeepLink.current) {
      attemptedDeepLink.current = true;
      const deepLink = `slack://app?team=${teamId}&id=${appId}&tab=home`;

      // Try to open the deep link
      const link = document.createElement("a");
      link.href = deepLink;
      link.click();
    }
  }, [teamId, appId]);

  const slackWebUrl = teamId ? `https://app.slack.com/client/${teamId}` : "https://slack.com";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
            <Check className="h-6 w-6 text-green-500" />
          </div>
          <CardTitle>OmniDial Installed!</CardTitle>
          <CardDescription>
            The app has been added to your Slack workspace. One more step to go!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4">
            <h3 className="font-medium mb-2">Next Step</h3>
            <p className="text-sm text-muted-foreground">
              Open the <strong>OmniDial</strong> app in Slack and click the{" "}
              <strong>&quot;Connect to OmniDial&quot;</strong> button to link your organization.
            </p>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                if (teamId && appId) {
                  window.location.href = `slack://app?team=${teamId}&id=${appId}&tab=home`;
                }
              }}
            >
              Open in Slack App
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(slackWebUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Open Slack in Browser
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Can&apos;t find the app? Search for &quot;OmniDial&quot; in your Slack sidebar.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SlackInstalledPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <SlackInstalledContent />
    </Suspense>
  );
}

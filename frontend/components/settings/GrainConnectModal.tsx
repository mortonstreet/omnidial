"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConnectGrain } from "@/hooks/api/useDealMetrics";
import { toast } from "sonner";
import { Loader2, Key, ExternalLink, CheckCircle2 } from "lucide-react";

interface GrainConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function GrainConnectModal({ isOpen, onClose, onSuccess }: GrainConnectModalProps) {
  const [apiToken, setApiToken] = useState("");
  const connectMutation = useConnectGrain();

  const handleClose = () => {
    setApiToken("");
    onClose();
  };

  const handleConnect = async () => {
    if (apiToken.trim().length < 10) {
      toast.error("Please paste your Grain API token");
      return;
    }
    try {
      await connectMutation.mutateAsync(apiToken.trim());
      toast.success("Connected to Grain");
      setApiToken("");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to connect. Please check your token."
      );
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect Grain"
      subtitle="Score recorded sales meetings for next steps, champion engagement and rep execution"
    >
      <div className="space-y-6">
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
            How to get your API token:
          </p>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
            <li>
              Open{" "}
              <a
                href="https://support.grain.com/en/articles/15507288-grain-api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1 hover:text-blue-600"
              >
                Grain API guide
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>In Grain, go to Workspace settings → Integrations → API and create a Personal or Workspace access token</li>
            <li>Paste it below</li>
          </ol>
          <p className="text-xs text-blue-800/80 dark:text-blue-200/80 mt-3">
            Personal tokens only see meetings you can access; a Workspace token covers the whole team.
            Meetings are matched to leads by attendee email.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="grain-token" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Grain API token
          </Label>
          <Input
            id="grain-token"
            type="password"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="grain_pat_..."
            className="font-mono text-sm"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && apiToken && !connectMutation.isPending) {
                handleConnect();
              }
            }}
          />
        </div>

        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p>
            The token is verified with Grain, then encrypted at rest. OmniDial only reads
            recordings and transcripts.
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={!apiToken || connectMutation.isPending}>
            {connectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Connect
          </Button>
        </div>
      </div>
    </Modal>
  );
}

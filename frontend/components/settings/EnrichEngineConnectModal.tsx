"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConnectEnrichEngine } from "@/hooks/api/useIntegrations";
import { toast } from "sonner";
import { Loader2, Key, ExternalLink, CheckCircle2 } from "lucide-react";

interface EnrichEngineConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EnrichEngineConnectModal({
  isOpen,
  onClose,
  onSuccess,
}: EnrichEngineConnectModalProps) {
  const [apiKey, setApiKey] = useState("");
  const connectMutation = useConnectEnrichEngine();

  const handleConnect = async () => {
    // Client-side validation
    if (!apiKey.trim()) {
      toast.error("Please enter your API key");
      return;
    }

    if (!apiKey.startsWith("ee_")) {
      toast.error('Invalid API key format. Key should start with "ee_"');
      return;
    }

    if (apiKey.length < 40) {
      toast.error("API key appears too short. Please check and try again.");
      return;
    }

    try {
      const result = await connectMutation.mutateAsync(apiKey);
      if (result.data?.success) {
        toast.success("Connected to EnrichEngine!");
        setApiKey("");
        onSuccess();
        onClose();
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to connect. Please check your API key."
      );
    }
  };

  const handleClose = () => {
    setApiKey("");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Connect to EnrichEngine"
      subtitle="Enter your API key to connect your EnrichEngine account"
    >
      <div className="space-y-6">
        {/* Instructions */}
        <div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
            How to get your API key:
          </p>
          <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-2 list-decimal list-inside">
            <li>
              Go to{" "}
              <a
                href="https://app.enrichengine.xyz/dashboard/settings"
                target="_blank"
                rel="noopener noreferrer"
                className="underline inline-flex items-center gap-1 hover:text-blue-600"
              >
                app.enrichengine.xyz/settings
                <ExternalLink className="h-3 w-3" />
              </a>
            </li>
            <li>Navigate to &quot;External API Keys&quot;</li>
            <li>Click &quot;Create API Key&quot;</li>
            <li>Name it &quot;OmniDial&quot; and select &quot;Read Lists&quot; permission</li>
            <li>
              Copy the key (it starts with{" "}
              <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded text-xs">
                ee_
              </code>
              )
            </li>
          </ol>
        </div>

        {/* API Key Input */}
        <div className="space-y-2">
          <Label htmlFor="api-key" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            EnrichEngine API Key
          </Label>
          <Input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="ee_xxxxxxxx_xxxxxxxxxxxxxxxxxxxxx"
            className="font-mono text-sm"
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && apiKey && !connectMutation.isPending) {
                handleConnect();
              }
            }}
          />
          <p className="text-xs text-muted-foreground">
            Your API key is stored securely and encrypted.
          </p>
        </div>

        {/* Security Note */}
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
          <p>
            This is a direct API connection. Your key is encrypted at rest and
            never shared. You can revoke it anytime from EnrichEngine settings.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            disabled={connectMutation.isPending || !apiKey}
          >
            {connectMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Verifying...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

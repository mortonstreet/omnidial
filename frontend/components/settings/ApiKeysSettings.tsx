"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useApiKeys, useRevokeApiKey } from "@/hooks/api/useApiKeys";
import { ApiKeyResponse } from "@shared/types/src";
import { GenerateApiKeyModal } from "./GenerateApiKeyModal";
import { ApiKeyCreatedModal } from "./ApiKeyCreatedModal";

export function ApiKeysSettings() {
  const { data: apiKeysData, isLoading } = useApiKeys();
  const revokeApiKeyMutation = useRevokeApiKey();

  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<{
    key: string;
    name: string;
  } | null>(null);

  const apiKeys = apiKeysData?.data || [];

  const handleRevoke = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to revoke "${name}"? This action cannot be undone.`)) {
      return;
    }

    revokeApiKeyMutation.mutate(id, {
      onSuccess: () => {
        toast.success("API key revoked");
      },
      onError: () => {
        toast.error("Failed to revoke API key");
      },
    });
  };

  const handleKeyCreated = (key: string, name: string) => {
    setGenerateModalOpen(false);
    setCreatedKey({ key, name });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading API keys...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
          <CardAction>
            <Button size="sm" onClick={() => setGenerateModalOpen(true)}>
              Generate Key
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Your API keys grant access to your organization&apos;s data. Keep them secure.
          </p>

          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No API keys yet. Generate your first key to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <ApiKeyCard
                  key={apiKey.id}
                  apiKey={apiKey}
                  onRevoke={() => handleRevoke(apiKey.id, apiKey.name)}
                  isRevoking={revokeApiKeyMutation.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <GenerateApiKeyModal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onKeyCreated={handleKeyCreated}
      />

      {createdKey && (
        <ApiKeyCreatedModal
          isOpen={true}
          onClose={() => setCreatedKey(null)}
          apiKey={createdKey.key}
          name={createdKey.name}
        />
      )}
    </div>
  );
}

interface ApiKeyCardProps {
  apiKey: ApiKeyResponse;
  onRevoke: () => void;
  isRevoking: boolean;
}

function ApiKeyCard({ apiKey, onRevoke, isRevoking }: ApiKeyCardProps) {
  return (
    <div className="p-4 border border-border rounded-lg">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="font-medium text-foreground">{apiKey.name}</p>
          <p className="text-sm font-mono text-muted-foreground">
            {apiKey.keyPrefix}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Created: {new Date(apiKey.createdAt).toLocaleDateString()}
            </span>
            {apiKey.lastUsedAt && (
              <span>
                Last used: {new Date(apiKey.lastUsedAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {apiKey.scopes.map((scope) => (
              <span
                key={scope}
                className="inline-flex px-2 py-0.5 text-xs rounded bg-muted text-muted-foreground"
              >
                {scope}
              </span>
            ))}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRevoke}
          disabled={isRevoking}
          className="text-red-600 hover:text-red-700"
        >
          Revoke
        </Button>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Modal from "@/components/ui/modal";
import { FormInput } from "@/components/ui/form-input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useCreateApiKey } from "@/hooks/api/useApiKeys";
import { ApiKeyScope } from "@shared/types/src";

interface GenerateApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onKeyCreated: (key: string, name: string) => void;
}

const AVAILABLE_SCOPES: { value: ApiKeyScope; label: string; description: string }[] = [
  { value: "read:leads", label: "read:leads", description: "View leads and contact info" },
  { value: "write:leads", label: "write:leads", description: "Create and update leads" },
  { value: "delete:leads", label: "delete:leads", description: "Delete leads" },
  { value: "read:calls", label: "read:calls", description: "View call history and recordings" },
  { value: "write:calls", label: "write:calls", description: "Log calls" },
  { value: "read:campaigns", label: "read:campaigns", description: "View campaigns" },
  { value: "write:campaigns", label: "write:campaigns", description: "Create and update campaigns" },
];

const EXPIRATION_OPTIONS = [
  { value: null, label: "Never" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

export function GenerateApiKeyModal({
  isOpen,
  onClose,
  onKeyCreated,
}: GenerateApiKeyModalProps) {
  const createApiKeyMutation = useCreateApiKey();

  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<ApiKeyScope[]>([
    "read:leads",
    "read:calls",
    "read:campaigns",
  ]);
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null);

  const handleScopeToggle = (scope: ApiKeyScope) => {
    setSelectedScopes((current) =>
      current.includes(scope)
        ? current.filter((s) => s !== scope)
        : [...current, scope]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Please enter a name for the API key");
      return;
    }

    if (selectedScopes.length === 0) {
      toast.error("Please select at least one scope");
      return;
    }

    createApiKeyMutation.mutate(
      { name: name.trim(), scopes: selectedScopes, expiresInDays },
      {
        onSuccess: (data) => {
          if (data?.data) {
            onKeyCreated(data.data.key, data.data.name);
            setName("");
            setSelectedScopes(["read:leads", "read:calls", "read:campaigns"]);
            setExpiresInDays(null);
          }
        },
        onError: () => {
          toast.error("Failed to generate API key");
        },
      }
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Generate API Key"
      subtitle="Create a new API key with specific permissions"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <FormInput
          label="Name"
          placeholder="e.g., Zapier Integration"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Scopes (permissions)
          </label>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {AVAILABLE_SCOPES.map((scope) => (
              <label
                key={scope.value}
                className="flex items-start gap-3 p-2 rounded hover:bg-muted cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedScopes.includes(scope.value)}
                  onChange={() => handleScopeToggle(scope.value)}
                  className="mt-0.5 rounded border-border"
                />
                <div>
                  <span className="text-sm font-mono text-foreground">
                    {scope.label}
                  </span>
                  <p className="text-xs text-muted-foreground">
                    {scope.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium text-foreground">
            Expiration
          </label>
          <div className="space-y-2">
            {EXPIRATION_OPTIONS.map((option) => (
              <label key={option.label} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="expiration"
                  checked={expiresInDays === option.value}
                  onChange={() => setExpiresInDays(option.value)}
                  className="border-border"
                />
                <span className="text-sm text-foreground">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createApiKeyMutation.isPending}>
            Generate
          </Button>
        </div>
      </form>
    </Modal>
  );
}

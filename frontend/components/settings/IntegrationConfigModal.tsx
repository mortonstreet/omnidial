"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { toast } from "sonner";
import {
  useUpdateIntegrationConfig,
  useTestIntegration,
  useDisconnectIntegration,
} from "@/hooks/api/useIntegrations";
import { IntegrationResponse, IntegrationConfig, SyncDirection } from "@shared/types/src";

interface IntegrationConfigModalProps {
  integration: IntegrationResponse;
  isOpen: boolean;
  onClose: () => void;
}

export function IntegrationConfigModal({
  integration,
  isOpen,
  onClose,
}: IntegrationConfigModalProps) {
  const updateConfigMutation = useUpdateIntegrationConfig();
  const testMutation = useTestIntegration();
  const disconnectMutation = useDisconnectIntegration();

  const [config, setConfig] = useState<IntegrationConfig>({
    syncLeads: true,
    logCalls: true,
    syncPipeline: false,
    importContacts: true,
    syncDirection: "two_way",
    fieldMappings: [],
    webhookUrl: "",
    webhookEvents: [],
  });

  useEffect(() => {
    const integrationConfig = integration.config;
    if (integrationConfig) {
      queueMicrotask(() => setConfig(integrationConfig));
    }
  }, [integration.config]);

  const handleSave = () => {
    updateConfigMutation.mutate(
      { provider: integration.provider, config },
      {
        onSuccess: () => {
          toast.success("Configuration saved");
          onClose();
        },
        onError: () => {
          toast.error("Failed to save configuration");
        },
      }
    );
  };

  const handleTest = () => {
    testMutation.mutate(integration.provider, {
      onSuccess: (data) => {
        if (data?.data?.success) {
          toast.success(data.data.message || "Connection successful");
        } else {
          toast.error(data?.data?.message || "Connection test failed");
        }
      },
      onError: () => {
        toast.error("Failed to test connection");
      },
    });
  };

  const handleDisconnect = () => {
    if (!confirm("Are you sure you want to disconnect this integration?")) {
      return;
    }

    disconnectMutation.mutate(integration.provider, {
      onSuccess: () => {
        toast.success("Integration disconnected");
        onClose();
      },
      onError: () => {
        toast.error("Failed to disconnect integration");
      },
    });
  };

  const isWebhook = integration.provider === "webhook";
  const isGoogleSheets = integration.provider === "google_sheets";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure ${integration.name}`}
      subtitle="Manage your integration settings"
    >
      <div className="space-y-6">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
            Connected
          </span>
          {integration.connectedBy && (
            <span className="text-sm text-muted-foreground">
              by {integration.connectedBy.email}
            </span>
          )}
        </div>

        {/* Webhook-specific settings */}
        {isWebhook && (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Webhook URL</h4>
              <FormInput
                placeholder="https://hooks.slack.com/services/..."
                value={config.webhookUrl || ""}
                onChange={(e) =>
                  setConfig({ ...config, webhookUrl: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Events will be sent to this URL via HTTP POST
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Events to Send</h4>
              <div className="space-y-2">
                {[
                  { key: "call.completed", label: "Call completed" },
                  { key: "call.started", label: "Call started" },
                  { key: "lead.created", label: "Lead created" },
                  { key: "lead.updated", label: "Lead updated" },
                  { key: "campaign.completed", label: "Campaign completed" },
                ].map((event) => (
                  <label key={event.key} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={config.webhookEvents?.includes(event.key) ?? false}
                      onChange={(e) => {
                        const events = config.webhookEvents || [];
                        if (e.target.checked) {
                          setConfig({ ...config, webhookEvents: [...events, event.key] });
                        } else {
                          setConfig({
                            ...config,
                            webhookEvents: events.filter((ev) => ev !== event.key),
                          });
                        }
                      }}
                      className="rounded border-border"
                    />
                    <span className="text-sm text-foreground">{event.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Google Sheets-specific settings */}
        {isGoogleSheets && (
          <>
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Sync Settings</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.syncLeads ?? true}
                    onChange={(e) =>
                      setConfig({ ...config, syncLeads: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">
                    Export new leads to Google Sheets
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.logCalls ?? true}
                    onChange={(e) =>
                      setConfig({ ...config, logCalls: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">
                    Log calls to spreadsheet
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.importContacts ?? true}
                    onChange={(e) =>
                      setConfig({ ...config, importContacts: e.target.checked })
                    }
                    className="rounded border-border"
                  />
                  <span className="text-sm text-foreground">
                    Import contacts from Google Sheets
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Sync Direction</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="syncDirection"
                    checked={config.syncDirection === "one_way"}
                    onChange={() =>
                      setConfig({ ...config, syncDirection: "one_way" as SyncDirection })
                    }
                    className="border-border"
                  />
                  <span className="text-sm text-foreground">
                    One-way: OmniDial → Google Sheets
                  </span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="syncDirection"
                    checked={config.syncDirection === "two_way"}
                    onChange={() =>
                      setConfig({ ...config, syncDirection: "two_way" as SyncDirection })
                    }
                    className="border-border"
                  />
                  <span className="text-sm text-foreground">
                    Two-way: Sync both directions
                  </span>
                </label>
              </div>
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
            className="text-red-600 hover:text-red-700"
          >
            Disconnect
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={testMutation.isPending}
            >
              Test Connection
            </Button>
            <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

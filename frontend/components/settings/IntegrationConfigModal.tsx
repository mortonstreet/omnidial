"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { FormInput } from "@/components/ui/form-input";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  useUpdateIntegrationConfig,
  useTestIntegration,
  useConnectIntegration,
} from "@/hooks/api/useIntegrations";
import { IntegrationResponse, IntegrationConfig, SyncDirection } from "@shared/types/src";

interface IntegrationConfigModalProps {
  integration: IntegrationResponse;
  isOpen: boolean;
  onClose: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}

/** OAuth providers whose connect flow re-authorizes in place (keeps settings). */
const RECONNECTABLE = new Set(["hubspot", "gmail", "google_sheets"]);

export function IntegrationConfigModal({
  integration,
  isOpen,
  onClose,
  onDisconnect,
  isDisconnecting,
}: IntegrationConfigModalProps) {
  const updateConfigMutation = useUpdateIntegrationConfig();
  const testMutation = useTestIntegration();
  const connectMutation = useConnectIntegration();

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

  // Re-runs OAuth; the callback updates the existing connection's tokens,
  // so new permissions are granted without losing sync settings.
  const handleReconnect = () => {
    connectMutation.mutate(integration.provider, {
      onSuccess: (data) => {
        if (data?.data?.url) window.location.href = data.data.url;
      },
      onError: () => toast.error("Failed to start reconnect"),
    });
  };

  const isWebhook = integration.provider === "webhook";
  const isGoogleSheets = integration.provider === "google_sheets";
  const isHubSpot = integration.provider === "hubspot";
  const hasSettings = isWebhook || isGoogleSheets;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Configure ${integration.name}`}
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

        {isHubSpot && (
          <p className="text-sm text-muted-foreground">
            Sync health, stage mapping and drift checks are under{" "}
            <a href="#deal-sync" onClick={onClose} className="underline hover:text-foreground">
              Deal Sync
            </a>
            .
          </p>
        )}

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
        <div className="flex flex-wrap items-center justify-between gap-2 pt-4 border-t border-border">
          <ConfirmButton
            onConfirm={onDisconnect}
            disabled={isDisconnecting}
            confirmLabel={isHubSpot ? "Click again: deletes sync setup" : "Click again to disconnect"}
          >
            Disconnect
          </ConfirmButton>
          <div className="flex gap-2">
            {RECONNECTABLE.has(integration.provider) && (
              <Button variant="outline" onClick={handleReconnect} disabled={connectMutation.isPending}>
                Reconnect
              </Button>
            )}
            <Button variant="outline" onClick={handleTest} disabled={testMutation.isPending}>
              Test
            </Button>
            {hasSettings && (
              <Button onClick={handleSave} disabled={updateConfigMutation.isPending}>
                Save
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

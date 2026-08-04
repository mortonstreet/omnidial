"use client";

import { useState, useMemo } from "react";
import { Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useIntegrations,
  useConnectIntegration,
  useDisconnectIntegration,
  useDisconnectEnrichEngine,
} from "@/hooks/api/useIntegrations";
import { IntegrationResponse, IntegrationCategory, GoogleSheet } from "@shared/types/src";
import { IntegrationConfigModal } from "./IntegrationConfigModal";
import { GoogleSheetsPicker } from "./GoogleSheetsPicker";
import { ColumnMappingModal } from "./ColumnMappingModal";
import { EnrichEngineListPicker } from "./EnrichEngineListPicker";
import { EnrichEngineConnectModal } from "./EnrichEngineConnectModal";
import { HubSpotContactImporter } from "./HubSpotContactImporter";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const CATEGORY_LABELS: Record<IntegrationCategory, string> = {
  crm: "CRM",
  communication: "Communication",
  data: "Data",
  automation: "Automation",
};

const CATEGORY_ORDER: IntegrationCategory[] = ["crm", "data"];

type FilterCategory = "all" | IntegrationCategory;

export function IntegrationsSettings() {
  const { data: integrationsData, isLoading, refetch } = useIntegrations();
  const connectMutation = useConnectIntegration();
  const disconnectMutation = useDisconnectIntegration();
  const disconnectEnrichEngineMutation = useDisconnectEnrichEngine();
  const isSuperAdmin = useSuperAdmin();

  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Google Sheets import flow
  const [sheetsPickerOpen, setSheetsPickerOpen] = useState(false);
  const [columnMappingOpen, setColumnMappingOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<GoogleSheet | null>(null);

  // HubSpot import flow
  const [hubspotImporterOpen, setHubspotImporterOpen] = useState(false);

  // EnrichEngine flows (API Key auth)
  const [enrichEngineConnectOpen, setEnrichEngineConnectOpen] = useState(false);
  const [enrichEnginePickerOpen, setEnrichEnginePickerOpen] = useState(false);

  const integrations = useMemo(() => {
    const all = integrationsData?.data || [];
    // Hide deprecated EnrichEngine from non-superadmin users
    if (!isSuperAdmin) return all.filter((i) => (i.provider as string) !== "enrichengine");
    return all;
  }, [integrationsData?.data, isSuperAdmin]);

  const filteredIntegrations = useMemo(() => {
    let result = integrations;
    if (activeFilter !== "all") {
      result = result.filter((i) => i.category === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [integrations, activeFilter, searchQuery]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: integrations.length };
    for (const cat of CATEGORY_ORDER) {
      counts[cat] = integrations.filter((i) => i.category === cat).length;
    }
    return counts;
  }, [integrations]);

  const handleConnect = async (provider: string) => {
    if (provider === "enrichengine") {
      setEnrichEngineConnectOpen(true);
      return;
    }
    connectMutation.mutate(provider, {
      onSuccess: (data) => {
        if (data?.data?.url) {
          window.location.href = data.data.url;
        }
      },
      onError: () => {
        toast.error("Failed to initiate connection");
      },
    });
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm("Are you sure you want to disconnect this integration?")) return;
    if (provider === "enrichengine") {
      disconnectEnrichEngineMutation.mutate(undefined, {
        onSuccess: () => {
          toast.success("EnrichEngine disconnected");
          refetch();
        },
        onError: () => {
          toast.error("Failed to disconnect EnrichEngine");
        },
      });
      return;
    }
    disconnectMutation.mutate(provider, {
      onSuccess: () => {
        toast.success("Integration disconnected");
      },
      onError: () => {
        toast.error("Failed to disconnect integration");
      },
    });
  };

  const handleConfigure = (integration: IntegrationResponse) => {
    setSelectedIntegration(integration);
    setConfigModalOpen(true);
  };

  const handleGoogleSheetsImportClick = () => setSheetsPickerOpen(true);
  const handleHubSpotImportClick = () => setHubspotImporterOpen(true);
  const handleEnrichEngineImportClick = () => setEnrichEnginePickerOpen(true);
  const handleEnrichEngineConnectSuccess = () => refetch();

  const handleSheetSelect = (sheet: GoogleSheet) => {
    setSelectedSheet(sheet);
    setSheetsPickerOpen(false);
    setColumnMappingOpen(true);
  };

  const handleGoogleSheetsImportSuccess = (_listId: string, listName: string, leadsImported: number) => {
    setColumnMappingOpen(false);
    setSelectedSheet(null);
    toast.success(`Created "${listName}" with ${leadsImported} leads. Go to Lists to add it to a campaign.`);
  };

  const handleHubSpotImportSuccess = (_listId: string, listName: string, leadsImported: number) => {
    setHubspotImporterOpen(false);
    toast.success(`Created "${listName}" with ${leadsImported} leads. Go to Lists to add it to a campaign.`);
  };

  const handleEnrichEngineImportSuccess = (_listId: string, listName: string, leadsImported: number) => {
    setEnrichEnginePickerOpen(false);
    toast.success(`Created "${listName}" with ${leadsImported} leads. Go to Lists to add it to a campaign.`);
  };

  const getImportHandler = (provider: string) => {
    if (provider === "google_sheets") return handleGoogleSheetsImportClick;
    if (provider === "hubspot") return handleHubSpotImportClick;
    if (provider === "enrichengine") return handleEnrichEngineImportClick;
    return undefined;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filterItems: { key: FilterCategory; label: string }[] = [
    { key: "all", label: "All integrations" },
    ...CATEGORY_ORDER.map((cat) => ({ key: cat as FilterCategory, label: CATEGORY_LABELS[cat] })),
  ];

  return (
    <div className="space-y-6">
      {/* Layout: sidebar + grid */}
      <div className="flex gap-8">
        {/* Sidebar */}
        <div className="w-48 shrink-0 space-y-1">
          {filterItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveFilter(item.key)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors ${
                activeFilter === item.key
                  ? "bg-foreground/10 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <span>{item.label}</span>
              <span className={`text-xs tabular-nums ${
                activeFilter === item.key ? "text-foreground/60" : "text-muted-foreground/60"
              }`}>
                {categoryCounts[item.key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search integrations..."
              className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 focus:bg-muted/80 transition-colors"
            />
          </div>

          {/* Card grid */}
          {filteredIntegrations.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {searchQuery ? "No integrations match your search" : "No integrations in this category"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredIntegrations.map((integration) => (
                <IntegrationCard
                  key={integration.provider}
                  integration={integration}
                  onConnect={() => handleConnect(integration.provider)}
                  onDisconnect={() => handleDisconnect(integration.provider)}
                  onConfigure={() => handleConfigure(integration)}
                  onImport={getImportHandler(integration.provider)}
                  isConnecting={connectMutation.isPending}
                  isDisconnecting={disconnectMutation.isPending || disconnectEnrichEngineMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {selectedIntegration && (
        <IntegrationConfigModal
          integration={selectedIntegration}
          isOpen={configModalOpen}
          onClose={() => {
            setConfigModalOpen(false);
            setSelectedIntegration(null);
          }}
        />
      )}

      <GoogleSheetsPicker
        isOpen={sheetsPickerOpen}
        onClose={() => setSheetsPickerOpen(false)}
        onSelect={handleSheetSelect}
      />

      <ColumnMappingModal
        isOpen={columnMappingOpen}
        onClose={() => {
          setColumnMappingOpen(false);
          setSelectedSheet(null);
        }}
        sheet={selectedSheet}
        onSuccess={handleGoogleSheetsImportSuccess}
      />

      <HubSpotContactImporter
        isOpen={hubspotImporterOpen}
        onClose={() => setHubspotImporterOpen(false)}
        onSuccess={handleHubSpotImportSuccess}
      />

      <EnrichEngineConnectModal
        isOpen={enrichEngineConnectOpen}
        onClose={() => setEnrichEngineConnectOpen(false)}
        onSuccess={handleEnrichEngineConnectSuccess}
      />

      <EnrichEngineListPicker
        isOpen={enrichEnginePickerOpen}
        onClose={() => setEnrichEnginePickerOpen(false)}
        onSuccess={handleEnrichEngineImportSuccess}
      />
    </div>
  );
}

interface IntegrationCardProps {
  integration: IntegrationResponse;
  onConnect: () => void;
  onDisconnect: () => void;
  onConfigure: () => void;
  onImport?: () => void;
  isConnecting: boolean;
  isDisconnecting: boolean;
}

function IntegrationCard({
  integration,
  onConnect,
  onDisconnect,
  onConfigure,
  onImport,
  isConnecting,
  isDisconnecting,
}: IntegrationCardProps) {
  return (
    <div className="group relative flex flex-col gap-4 p-4 bg-card border border-border rounded-xl hover:border-foreground/20 hover:shadow-sm transition-all">
      {/* Top row: logo + status */}
      <div className="flex items-start justify-between">
        <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
          <BrandLogo provider={integration.provider} size={28} />
        </div>
        {integration.isConnected && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-green-600">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        )}
      </div>

      {/* Name + description */}
      <div className="flex-1 min-h-0">
        <h3 className="font-medium text-sm text-foreground">{integration.name}</h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {integration.description}
        </p>
        {integration.isConnected && integration.lastSyncAt && (
          <p className="text-[11px] text-muted-foreground/70 mt-2">
            Last sync: {new Date(integration.lastSyncAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
        {integration.isConnected ? (
          <>
            {onImport && (
              <Button size="sm" variant="default" className="h-7 text-xs" onClick={onImport}>
                Import
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onConfigure}>
              Configure
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 ml-auto"
              onClick={onDisconnect}
              disabled={isDisconnecting}
            >
              Disconnect
            </Button>
          </>
        ) : (
          <Button size="sm" className="h-7 text-xs" onClick={onConnect} disabled={isConnecting}>
            Connect
          </Button>
        )}
      </div>
    </div>
  );
}

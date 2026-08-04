"use client";

import { useState, useMemo } from "react";
import {
  Search,
  X,
  Loader2,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useEnrichmentVendors,
  useConnectVendor,
  useUpdateVendorConnection,
  useDisconnectVendor,
  useTestVendorConnection,
} from "@/hooks/api/useEnrichment";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

type VendorProvider = "apollo" | "zoominfo" | "clearbit" | "lusha" | "enrichengine" | "prospeo" | "forager" | "leadmagic";

const VENDOR_INFO: Record<
  VendorProvider,
  { name: string; description: string }
> = {
  prospeo: {
    name: "Prospeo",
    description: "LinkedIn email & phone finder",
  },
  forager: {
    name: "Forager",
    description: "B2B contact enrichment API",
  },
  leadmagic: {
    name: "LeadMagic",
    description: "Mobile phone number finder",
  },
  apollo: {
    name: "Apollo.io",
    description: "B2B contact & company data platform",
  },
  zoominfo: {
    name: "ZoomInfo",
    description: "Enterprise B2B data provider",
  },
  clearbit: {
    name: "Clearbit",
    description: "Real-time business intelligence",
  },
  lusha: {
    name: "Lusha",
    description: "B2B contact data platform",
  },
  enrichengine: {
    name: "EnrichEngine",
    description: "Multi-source enrichment aggregator",
  },
};

type FilterType = "all" | "connected" | "available";

export function DataVendorSettings() {
  const isSuperAdmin = useSuperAdmin();
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<VendorProvider>("apollo");
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedVendorId, setExpandedVendorId] = useState<string | null>(null);

  const { data: vendors, isLoading } = useEnrichmentVendors();
  const connectVendor = useConnectVendor();
  const updateVendor = useUpdateVendorConnection();
  const disconnectVendor = useDisconnectVendor();
  const testConnection = useTestVendorConnection();

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await connectVendor.mutateAsync({
        provider: selectedProvider,
        apiKey,
      });
      setShowAddForm(false);
      setApiKey("");
    } catch (error) {
      console.error("Failed to connect vendor:", error);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await updateVendor.mutateAsync({ id, isActive: !isActive });
    } catch (error) {
      console.error("Failed to update vendor:", error);
    }
  };

  const handleToggleDataType = async (
    id: string,
    currentTypes: string[],
    dataType: string,
  ) => {
    const newTypes = currentTypes.includes(dataType)
      ? currentTypes.filter((t) => t !== dataType)
      : [...currentTypes, dataType];
    if (newTypes.length === 0) return;
    try {
      await updateVendor.mutateAsync({ id, enabledDataTypes: newTypes });
    } catch (error) {
      console.error("Failed to update data types:", error);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this vendor?")) return;
    try {
      await disconnectVendor.mutateAsync(id);
      setExpandedVendorId(null);
    } catch (error) {
      console.error("Failed to disconnect vendor:", error);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    try {
      const result = await testConnection.mutateAsync(id);
      alert(result.success ? "Connection successful!" : `Connection failed: ${result.message}`);
    } catch (error) {
      console.error("Failed to test connection:", error);
    } finally {
      setTestingId(null);
    }
  };

  const connectedProviders = new Set(vendors?.data?.map((v) => v.provider) || []);
  const availableProviders = (Object.keys(VENDOR_INFO) as VendorProvider[]).filter(
    (p) => !connectedProviders.has(p)
  );

  const connectedVendors = useMemo(() => vendors?.data?.sort((a, b) => a.priority - b.priority) || [], [vendors?.data]);

  // Build a unified list of all vendor cards
  const allVendorCards = useMemo(() => {
    const cards: {
      key: string;
      provider: VendorProvider;
      name: string;
      description: string;
      isConnected: boolean;
      vendorData?: (typeof connectedVendors)[number];
    }[] = [];

    // Connected vendors first
    for (const vendor of connectedVendors) {
      // Hide deprecated EnrichEngine from non-superadmin users
      if (vendor.provider === "enrichengine" && !isSuperAdmin) continue;
      const info = VENDOR_INFO[vendor.provider as VendorProvider];
      if (info) {
        cards.push({
          key: vendor.id,
          provider: vendor.provider as VendorProvider,
          name: info.name,
          description: info.description,
          isConnected: true,
          vendorData: vendor,
        });
      }
    }

    // Available vendors
    for (const provider of availableProviders) {
      // Hide deprecated EnrichEngine from non-superadmin users
      if (provider === "enrichengine" && !isSuperAdmin) continue;
      cards.push({
        key: `available-${provider}`,
        provider,
        name: VENDOR_INFO[provider].name,
        description: VENDOR_INFO[provider].description,
        isConnected: false,
      });
    }

    return cards;
  }, [connectedVendors, availableProviders, isSuperAdmin]);

  const filteredCards = useMemo(() => {
    let result = allVendorCards;
    if (activeFilter === "connected") {
      result = result.filter((c) => c.isConnected);
    } else if (activeFilter === "available") {
      result = result.filter((c) => !c.isConnected);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }
    return result;
  }, [allVendorCards, activeFilter, searchQuery]);

  const filterCounts = useMemo(() => ({
    all: allVendorCards.length,
    connected: allVendorCards.filter((c) => c.isConnected).length,
    available: allVendorCards.filter((c) => !c.isConnected).length,
  }), [allVendorCards]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filterItems: { key: FilterType; label: string }[] = [
    { key: "all", label: "All vendors" },
    { key: "connected", label: "Connected" },
    { key: "available", label: "Available" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-medium">Data Enrichment Vendors</h2>
        <p className="text-sm text-muted-foreground">
          Connect data providers for lead enrichment (all called in parallel)
        </p>
      </div>

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
                {filterCounts[item.key]}
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
              placeholder="Search vendors..."
              className="w-full pl-9 pr-3 py-2 bg-muted/50 border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 focus:bg-muted/80 transition-colors"
            />
          </div>

          {/* Card grid */}
          {filteredCards.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {searchQuery ? "No vendors match your search" : "No vendors in this category"}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredCards.map((card) => (
                <div
                  key={card.key}
                  className={`group relative flex flex-col gap-3 p-4 bg-card border rounded-xl transition-all cursor-pointer ${
                    card.isConnected
                      ? "border-border hover:border-foreground/20 hover:shadow-sm"
                      : "border-dashed border-border/60 hover:border-foreground/20"
                  }`}
                  onClick={() => {
                    if (card.isConnected) {
                      setExpandedVendorId(expandedVendorId === card.key ? null : card.key);
                    } else {
                      setSelectedProvider(card.provider);
                      setShowAddForm(true);
                    }
                  }}
                >
                  {/* Top row: logo + status */}
                  <div className="flex items-start justify-between">
                    <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                      <BrandLogo provider={card.provider} size={28} />
                    </div>
                    {card.isConnected && card.vendorData ? (
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${
                        card.vendorData.isActive ? "text-green-600" : "text-muted-foreground"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          card.vendorData.isActive ? "bg-green-500" : "bg-muted-foreground/40"
                        }`} />
                        {card.vendorData.isActive ? "Active" : "Inactive"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/60">Not connected</span>
                    )}
                  </div>

                  {/* Name + description */}
                  <div className="flex-1 min-h-0">
                    <h3 className="font-medium text-sm text-foreground">{card.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {card.description}
                    </p>
                  </div>

                  {/* Connected vendor info */}
                  {card.isConnected && card.vendorData && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        Credits: {card.vendorData.creditsUsed || 0}
                        {card.vendorData.creditsLimit ? ` / ${card.vendorData.creditsLimit}` : ""}
                      </span>
                      {(card.vendorData.enabledDataTypes ?? ["phone", "email", "profile"]).map((dt: string) => (
                        <span
                          key={dt}
                          className="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-foreground/5 text-muted-foreground capitalize"
                        >
                          {dt === "profile" ? "Profile" : dt}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions for connected */}
                  {card.isConnected && card.vendorData && (
                    <div
                      className="flex items-center gap-2 pt-2 border-t border-border/50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => handleTest(card.vendorData!.id)}
                        disabled={testingId === card.vendorData.id}
                      >
                        {testingId === card.vendorData.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3 h-3" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleToggleActive(card.vendorData!.id, card.vendorData!.isActive)}
                      >
                        {card.vendorData.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-red-500 hover:text-red-600 hover:bg-red-500/10 ml-auto"
                        onClick={() => handleDisconnect(card.vendorData!.id)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  )}

                  {/* Expanded config panel for connected vendors */}
                  {card.isConnected && card.vendorData && expandedVendorId === card.key && (
                    <div
                      className="pt-2 border-t border-border/50 space-y-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="text-xs font-medium text-muted-foreground">Data Types</div>
                      <div className="flex items-center gap-4">
                        {(["phone", "email", "profile"] as const).map((dt) => {
                          const enabledTypes = card.vendorData!.enabledDataTypes ?? ["phone", "email", "profile"];
                          const isChecked = enabledTypes.includes(dt);
                          return (
                            <label key={dt} className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleDataType(card.vendorData!.id, enabledTypes, dt)}
                                className="w-3.5 h-3.5 rounded border-border accent-foreground cursor-pointer"
                              />
                              <span className="text-xs text-muted-foreground capitalize">
                                {dt === "profile" ? "Profile Data" : dt}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Connect prompt for available vendors */}
                  {!card.isConnected && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Click to connect
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add vendor form modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center overflow-hidden">
                  <BrandLogo provider={selectedProvider} size={22} />
                </div>
                <div>
                  <h3 className="font-medium text-sm">
                    Connect {VENDOR_INFO[selectedProvider].name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {VENDOR_INFO[selectedProvider].description}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setApiKey("");
                }}
                className="p-1.5 hover:bg-muted rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConnect} className="p-4 space-y-4">
              {/* Provider selection */}
              {availableProviders.length > 1 && (
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-2">
                    Select Provider
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {availableProviders.map((provider) => (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => setSelectedProvider(provider)}
                        className={`flex items-center gap-2.5 p-2.5 border rounded-lg text-left transition-colors ${
                          selectedProvider === provider
                            ? "border-foreground/30 bg-foreground/5"
                            : "border-border hover:border-foreground/15"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-md bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                          <BrandLogo provider={provider} size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-xs truncate">
                            {VENDOR_INFO[provider].name}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Enter your API key"
                    className="w-full px-3 py-2 pr-10 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:border-foreground/30 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-background/50 rounded"
                  >
                    {showApiKey ? (
                      <EyeOff className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <Eye className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowAddForm(false);
                    setApiKey("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={connectVendor.isPending || !apiKey}
                  className="gap-1.5"
                >
                  {connectVendor.isPending && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  Connect
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

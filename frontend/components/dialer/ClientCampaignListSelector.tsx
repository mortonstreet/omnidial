"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Building2, Megaphone, Loader2 } from "lucide-react";
import { useMyAssignedClients } from "@/hooks/api/useClientUserAssignments";
import { useCampaigns } from "@/hooks/api/useCampaigns";
import { useCampaignLists } from "@/hooks/api/useLists";

interface ClientCampaignListSelectorProps {
  onSelectionChange?: (selection: {
    clientId?: string;
    campaignId?: string;
    listId?: string; // Auto-selected from campaign lists (for parallel dialer compatibility)
  }) => void;
  initialClientId?: string;
  initialCampaignId?: string;
  initialListId?: string;
}

interface DropdownState {
  client: boolean;
  campaign: boolean;
}

export function ClientCampaignListSelector({
  onSelectionChange,
  initialClientId,
  initialCampaignId,
  initialListId,
}: ClientCampaignListSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | undefined>(initialClientId);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | undefined>(initialCampaignId);
  const [selectedListId, setSelectedListId] = useState<string | undefined>(initialListId);
  const [dropdowns, setDropdowns] = useState<DropdownState>({
    client: false,
    campaign: false,
  });

  // Fetch clients (role-aware: admins get all, members get assigned only)
  // Use isPending (not isLoading) so we show loading state while orgId is still resolving
  const { data: clients, isPending: clientsLoading } = useMyAssignedClients();

  // Fetch campaigns filtered by selected client
  const { data: campaignsData, isLoading: campaignsLoading } = useCampaigns({
    clientId: selectedClientId,
  });
  const campaigns = campaignsData?.data || [];

  // Fetch lists for selected campaign (used for auto-selection for parallel dialer)
  const { data: listsData } = useCampaignLists(selectedCampaignId);
  const lists = useMemo(() => listsData?.data || [], [listsData?.data]);

  // Auto-select first list when campaign has lists (for parallel dialer compatibility)
  // Power dialer no longer needs this but parallel dialer still does
  const effectiveListId = useMemo(() => {
    if (selectedListId) return selectedListId;
    if (lists.length > 0 && selectedCampaignId) return lists[0].listId;
    return undefined;
  }, [selectedListId, lists, selectedCampaignId]);

  // Get selected items for display
  const selectedClient = clients?.find((c) => c.id === selectedClientId);
  const selectedCampaign = campaigns?.find((c) => c.id === selectedCampaignId);

  // Notify parent of selection changes
  // Power dialer now works at campaign level (doesn't require listId)
  // Parallel dialer still needs listId
  useEffect(() => {
    onSelectionChange?.({
      clientId: selectedClientId,
      campaignId: selectedCampaignId,
      listId: effectiveListId,
    });
  }, [selectedClientId, selectedCampaignId, effectiveListId, onSelectionChange]);

  // Reset campaign and list when client changes
  const handleClientSelect = (clientId: string) => {
    setSelectedClientId(clientId);
    setSelectedCampaignId(undefined);
    setSelectedListId(undefined);
    setDropdowns({ client: false, campaign: false });
  };

  // Reset list when campaign changes (will auto-select first list via useMemo)
  const handleCampaignSelect = (campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setSelectedListId(undefined);
    setDropdowns({ client: false, campaign: false });
  };

  const toggleDropdown = (key: keyof DropdownState) => {
    setDropdowns((prev) => ({
      client: false,
      campaign: false,
      [key]: !prev[key],
    }));
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setDropdowns({ client: false, campaign: false });
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="space-y-3">
      {/* Client Selector */}
      <div className="relative">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Client
        </label>
        <button
          onClick={() => toggleDropdown("client")}
          disabled={clientsLoading}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted border border-border rounded-md hover:border-foreground/20 transition-colors text-sm disabled:opacity-50"
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            {clientsLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : selectedClient ? (
              <span className="flex items-center gap-2">
                {selectedClient.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: selectedClient.color }}
                  />
                )}
                {selectedClient.name}
              </span>
            ) : (
              <span className="text-muted-foreground">Select a client</span>
            )}
          </div>
          {clientsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronDown
              className={`w-4 h-4 transition-transform ${dropdowns.client ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {dropdowns.client && clients && clients.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => handleClientSelect(client.id)}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors flex items-center gap-2 first:rounded-t-md last:rounded-b-md ${
                  selectedClientId === client.id ? "bg-muted border-l-2 border-l-foreground" : ""
                }`}
              >
                {client.color && (
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: client.color }}
                  />
                )}
                <span>{client.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {client.campaignCount} campaigns
                </span>
              </button>
            ))}
          </div>
        )}
        {dropdowns.client && clients && clients.length === 0 && !clientsLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground text-center">
            No clients available
          </div>
        )}
      </div>

      {/* Campaign Selector */}
      <div className="relative">
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          Campaign
        </label>
        <button
          onClick={() => toggleDropdown("campaign")}
          disabled={!selectedClientId || campaignsLoading}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-muted border border-border rounded-md hover:border-foreground/20 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <div className="flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-muted-foreground" />
            {campaignsLoading ? (
              <span className="text-muted-foreground">Loading...</span>
            ) : selectedCampaign ? (
              <span>{selectedCampaign.name}</span>
            ) : (
              <span className="text-muted-foreground">
                {selectedClientId ? "Select a campaign" : "Select a client first"}
              </span>
            )}
          </div>
          {campaignsLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ChevronDown
              className={`w-4 h-4 transition-transform ${dropdowns.campaign ? "rotate-180" : ""}`}
            />
          )}
        </button>
        {dropdowns.campaign && campaigns.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-20 max-h-48 overflow-y-auto">
            {campaigns.map((campaign) => (
              <button
                key={campaign.id}
                onClick={() => handleCampaignSelect(campaign.id)}
                className={`w-full px-3 py-2.5 text-left text-sm hover:bg-muted transition-colors first:rounded-t-md last:rounded-b-md ${
                  selectedCampaignId === campaign.id ? "bg-muted border-l-2 border-l-foreground" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{campaign.name}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-sm ${
                      campaign.status === "active"
                        ? "border border-green-500/50 text-green-500"
                        : "border border-border text-muted-foreground"
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{campaign.leadCount} leads</span>
                  <span>-</span>
                  <span>{campaign.connectedCount} connected</span>
                  {campaign.dialedCount > 0 && (
                    <>
                      <span>-</span>
                      <span className="text-green-600">
                        {Math.round((campaign.connectedCount / campaign.dialedCount) * 100)}% rate
                      </span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
        {dropdowns.campaign && selectedClientId && campaigns.length === 0 && !campaignsLoading && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-lg z-20 p-3 text-sm text-muted-foreground text-center">
            No campaigns for this client
          </div>
        )}
      </div>

    </div>
  );
}

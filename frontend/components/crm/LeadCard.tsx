"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Building2, Phone, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCampaigns } from "@/hooks/api/useCampaigns";
import { useBulkAddToCampaign } from "@/hooks/api/useLeads";
import { toast } from "sonner";
import { ListPlus } from "lucide-react";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(firstName: string | null, lastName: string | null): string {
  const first = firstName?.trim()?.[0]?.toUpperCase() || "";
  const last = lastName?.trim()?.[0]?.toUpperCase() || "";
  if (first && last) return `${first}${last}`;
  if (first) return first;
  if (last) return last;
  return "?";
}

interface LeadClient {
  id: string;
  name: string;
  color: string | null;
}

interface Lead {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string;
  company: string | null;
  dealValue: string | null;
  client?: LeadClient | null;
}

interface LeadCardProps {
  lead: Lead;
  isDragging?: boolean;
  onClick?: () => void;
}

export function LeadCard({ lead, isDragging, onClick }: LeadCardProps) {
  const fullName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
  const dealValue = lead.dealValue ? parseFloat(lead.dealValue) : null;
  const initials = getInitials(lead.firstName, lead.lastName);
  const { data: campaignsData } = useCampaigns({ limit: 50 });
  const bulkAddMutation = useBulkAddToCampaign();
  const campaigns = campaignsData?.data ?? [];

  const handleAddToCampaign = async (campaignId: string, campaignName: string) => {
    try {
      const result = await bulkAddMutation.mutateAsync({
        leadIds: [lead.id],
        campaignId,
      });
      if (result.added > 0) {
        toast.success(`Added ${fullName} to ${campaignName}`);
      }
      if (result.alreadyInCampaign > 0) {
        toast.info(`${fullName} is already in this campaign`);
      }
    } catch {
      toast.error("Failed to add to campaign");
    }
  };

  // Generate a consistent color based on the name
  const colors = [
    "bg-blue-500",
    "bg-green-500",
    "bg-purple-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-teal-500",
    "bg-indigo-500",
    "bg-rose-500",
  ];
  const colorIndex = (lead.firstName?.charCodeAt(0) || 0) % colors.length;
  const avatarColor = colors[colorIndex];

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <Card
      className={`p-3 cursor-pointer hover:bg-muted/50 transition-all duration-200 ease-out border-border group relative ${
        isDragging ? "shadow-lg ring-2 ring-primary/30" : ""
      }`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={`Lead: ${fullName}${dealValue !== null && dealValue > 0 ? `, deal value ${formatCurrency(dealValue)}` : ""}`}
    >
      {/* Hover Action Menu */}
      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1 rounded hover:bg-muted bg-card border border-border shadow-sm"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuLabel className="text-xs">
              <ListPlus className="w-3.5 h-3.5 inline mr-1.5" />
              Add to Campaign
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {campaigns.length === 0 ? (
              <div className="px-2 py-3 text-center text-xs text-muted-foreground">
                No campaigns
              </div>
            ) : (
              campaigns.map((campaign) => (
                <DropdownMenuItem
                  key={campaign.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAddToCampaign(campaign.id, campaign.name);
                  }}
                  disabled={bulkAddMutation.isPending}
                >
                  <span className="truncate">{campaign.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{campaign.leadCount}</span>
                </DropdownMenuItem>
              ))
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Client Badge */}
      {lead.client && (
        <div className="mb-1.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1.5 py-0 h-4"
                  style={{
                    borderColor: lead.client.color || undefined,
                    color: lead.client.color || undefined,
                  }}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mr-1"
                    style={{ backgroundColor: lead.client.color || '#6B7280' }}
                  />
                  {lead.client.name}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Client: {lead.client.name}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Title: Name + Deal Value */}
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className={`w-6 h-6 rounded-full ${avatarColor} flex items-center justify-center flex-shrink-0`}
        >
          <span className="text-[10px] font-medium text-white">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {fullName}
            {dealValue !== null && dealValue > 0 && (
              <span className="text-muted-foreground font-normal">
                {" "}– {formatCurrency(dealValue)}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Compact Info Rows */}
      <div className="space-y-1 text-xs text-muted-foreground">
        {lead.company && (
          <div className="flex items-center gap-2">
            <Building2 className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.company}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

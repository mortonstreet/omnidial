"use client";

import Link from "next/link";
import { MoreHorizontal, Trash2, Pencil, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Client {
  id: string;
  name: string | null;
  color: string | null;
}

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    clientId: string | null;
    client: Client | null;
    status: "active" | "inactive";
    leadCount: number;
    dialedCount: number;
    connectedCount: number;
    lastCalledAt: string | null;
    createdAt: string;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function CampaignCard({
  campaign,
  onEdit,
  onDelete,
}: CampaignCardProps) {
  const remainingCount = campaign.leadCount - campaign.dialedCount;

  const statusColors = {
    active: "bg-green-500/10 text-green-500 border-green-500/20",
    inactive: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  };

  const getLastCalledText = () => {
    if (!campaign.lastCalledAt) {
      return "Never called";
    }
    return `Last called: ${formatDistanceToNow(new Date(campaign.lastCalledAt), { addSuffix: true })}`;
  };

  return (
    <div className="bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <Link
          href={`/dashboard/campaigns/${campaign.id}`}
          className="flex-1 min-w-0"
        >
          <h3 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
            {campaign.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className={statusColors[campaign.status]}>
              {campaign.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/campaigns/${campaign.id}`}>
                View Details
              </Link>
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(campaign.id)}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit Campaign
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(campaign.id)}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Campaign
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {campaign.client && (
        <div className="text-sm text-muted-foreground mb-3">
          Client:{" "}
          <span
            className="font-medium"
            style={campaign.client.color ? { color: campaign.client.color } : undefined}
          >
            {campaign.client.name}
          </span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 mt-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {campaign.leadCount}
          </div>
          <div className="text-xs text-muted-foreground">Leads</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {campaign.dialedCount}
          </div>
          <div className="text-xs text-muted-foreground">Called</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {remainingCount}
          </div>
          <div className="text-xs text-muted-foreground">Remaining</div>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border">
        <div className="flex items-center text-xs text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          <span>{getLastCalledText()}</span>
        </div>
      </div>
    </div>
  );
}

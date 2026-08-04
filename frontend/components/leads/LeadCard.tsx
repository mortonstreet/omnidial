"use client";

import Link from "next/link";
import { MoreHorizontal, Phone, Mail, Building, Trash2 } from "lucide-react";
import { LinkedInIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

interface LeadCardProps {
  lead: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone: string;
    company?: string | null;
    title?: string | null;
    linkedInUrl?: string | null;
    dealValue?: string | number | null;
  };
  onDelete?: (id: string) => void;
}

export function LeadCard({ lead, onDelete }: LeadCardProps) {
  const fullName =
    lead.firstName || lead.lastName
      ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
      : "Unknown";

  return (
    <div className="bg-card border rounded-xl p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <Link href={`/dashboard/leads/${lead.id}`} className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
            {fullName}
          </h3>
          {lead.title && lead.company && (
            <p className="text-sm text-muted-foreground truncate">
              {lead.title} at {lead.company}
            </p>
          )}
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Lead options">
              <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link href={`/dashboard/leads/${lead.id}`}>View Lead</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={`tel:${lead.phone}`}>
                <Phone className="w-4 h-4 mr-2" />
                Call
              </a>
            </DropdownMenuItem>
            {lead.email && (
              <DropdownMenuItem asChild>
                <a href={`mailto:${lead.email}`}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </a>
              </DropdownMenuItem>
            )}
            {normalizeUrl(lead.linkedInUrl) && (
              <DropdownMenuItem asChild>
                <a
                  href={normalizeUrl(lead.linkedInUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <LinkedInIcon className="w-4 h-4 mr-2" />
                  LinkedIn
                </a>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(lead.id)}
                  className="text-destructive"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Lead
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Phone className="w-4 h-4" />
          <span>{lead.phone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="w-4 h-4" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.company && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building className="w-4 h-4" />
            <span className="truncate">{lead.company}</span>
          </div>
        )}
      </div>

      {lead.dealValue && (
        <div className="mt-3 pt-3 border-t border-border">
          <div className="text-lg font-semibold text-green-500">
            ${Number(lead.dealValue).toLocaleString()}
          </div>
          <div className="text-xs text-muted-foreground">Deal Value</div>
        </div>
      )}
    </div>
  );
}

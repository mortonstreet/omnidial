"use client";

import Link from "next/link";
import { Phone, Mail, ExternalLink, Trash2, MoreHorizontal, Sparkles } from "lucide-react";
import { useQuickCall } from "@/hooks/useQuickCall";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EnrichmentStatusBadge } from "@/components/enrichment/EnrichmentStatusBadge";
import { useEnrichLead } from "@/hooks/api/useEnrichment";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // If URL doesn't start with a protocol, add https://
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

interface Lead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone: string;
  company?: string | null;
  title?: string | null;
  linkedInUrl?: string | null;
  dealValue?: string | number | null;
  createdAt: string | Date;
  clientId?: string | null;
  enrichmentStatus?: string | null;
  enrichmentSources?: string[] | null;
}

interface LeadTableProps {
  leads: Lead[];
  onDelete?: (id: string) => void;
  // Selection props
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleAllOnPage?: (ids: string[]) => void;
  isAllOnPageSelected?: (ids: string[]) => boolean;
  isSomeOnPageSelected?: (ids: string[]) => boolean;
}

export function LeadTable({
  leads,
  onDelete,
  selectable = false,
  selectedIds = new Set(),
  onToggleSelection,
  onToggleAllOnPage,
  isAllOnPageSelected,
  isSomeOnPageSelected,
}: LeadTableProps) {
  const { quickCall } = useQuickCall();
  const enrichLead = useEnrichLead();
  const leadIds = leads.map((l) => l.id);
  const allSelected = isAllOnPageSelected?.(leadIds) ?? false;
  const someSelected = isSomeOnPageSelected?.(leadIds) ?? false;

  const formatRelativeDate = (date: string | Date) => {
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return new Date(date).toLocaleDateString();
    }
  };

  return (
    <div className="border rounded-xl overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={() => onToggleAllOnPage?.(leadIds)}
                />
              </TableHead>
            )}
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="w-24">Enriched</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={selectable ? 8 : 7}
                className="h-24 text-center text-muted-foreground"
              >
                No leads found
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => {
              const fullName =
                lead.firstName || lead.lastName
                  ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
                  : "Unknown";
              const isSelected = selectedIds.has(lead.id);

              return (
                <TableRow
                  key={lead.id}
                  className={isSelected ? "bg-muted/50" : undefined}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection?.(lead.id)}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {fullName}
                    </Link>
                    {lead.title && (
                      <div className="text-sm text-muted-foreground">
                        {lead.title}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {lead.company || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => quickCall({ leadId: lead.id, leadName: fullName, phone: lead.phone, clientId: lead.clientId })}
                      className="flex items-center gap-2 hover:text-primary text-left"
                    >
                      <Phone className="w-3 h-3 text-muted-foreground" />
                      {lead.phone}
                    </button>
                  </TableCell>
                  <TableCell>
                    {lead.email ? (
                      <a
                        href={`mailto:${lead.email}`}
                        className="flex items-center gap-2 hover:text-primary truncate max-w-[200px]"
                      >
                        <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="truncate">{lead.email}</span>
                      </a>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <EnrichmentStatusBadge
                      status={lead.enrichmentStatus}
                      sources={lead.enrichmentSources}
                      compact
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatRelativeDate(lead.createdAt)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/dashboard/leads/${lead.id}`}>
                            View Lead
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => quickCall({ leadId: lead.id, leadName: fullName, phone: lead.phone, clientId: lead.clientId })}
                        >
                          <Phone className="w-4 h-4" />
                          Call
                        </DropdownMenuItem>
                        {lead.email && (
                          <DropdownMenuItem asChild>
                            <a href={`mailto:${lead.email}`}>
                              <Mail className="w-4 h-4" />
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
                              <ExternalLink className="w-4 h-4" />
                              LinkedIn
                            </a>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          onClick={async () => {
                            try {
                              await enrichLead.mutateAsync({ leadId: lead.id });
                              toast.success("Lead enriched");
                            } catch {
                              toast.error("Enrichment failed");
                            }
                          }}
                          disabled={enrichLead.isPending}
                        >
                          <Sparkles className="w-4 h-4" />
                          Enrich
                        </DropdownMenuItem>
                        {onDelete && (
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => onDelete(lead.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

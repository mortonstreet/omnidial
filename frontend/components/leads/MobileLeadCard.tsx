"use client";

import Link from "next/link";
import { Phone, Mail, Building, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuickCall } from "@/hooks/useQuickCall";

interface MobileLeadCardProps {
  lead: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone: string;
    company?: string | null;
    title?: string | null;
    dealValue?: string | number | null;
    clientId?: string | null;
  };
  onCall?: (id: string) => void;
}

export function MobileLeadCard({ lead, onCall }: MobileLeadCardProps) {
  const { quickCall } = useQuickCall();
  const fullName =
    lead.firstName || lead.lastName
      ? `${lead.firstName || ""} ${lead.lastName || ""}`.trim()
      : "Unknown";

  return (
    <article className="bg-card border border-border rounded-xl overflow-hidden">
      <Link
        href={`/dashboard/leads/${lead.id}`}
        className="block p-4 active:bg-muted/50 transition-colors touch-manipulation"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">
              {fullName}
            </h3>
            {lead.title && lead.company && (
              <p className="text-sm text-muted-foreground truncate mt-0.5">
                {lead.title} at {lead.company}
              </p>
            )}
          </div>
          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
        </div>

        <div className="mt-3 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Phone className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">{lead.phone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {lead.company && !lead.title && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{lead.company}</span>
            </div>
          )}
        </div>

        {lead.dealValue && (
          <div className="mt-3 pt-3 border-t border-border">
            <span className="text-lg font-semibold text-green-500">
              ${Number(lead.dealValue).toLocaleString()}
            </span>
          </div>
        )}
      </Link>

      {/* Quick Actions */}
      <div className="px-4 pb-4 pt-3 border-t border-border flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 h-11 touch-manipulation"
          onClick={(e) => {
            e.preventDefault();
            if (onCall) {
              onCall(lead.id);
            } else {
              quickCall({ leadId: lead.id, leadName: fullName, phone: lead.phone, clientId: lead.clientId });
            }
          }}
        >
          <Phone className="w-4 h-4 mr-2" aria-hidden="true" />
          Call
        </Button>
        {lead.email && (
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-11 touch-manipulation"
            asChild
          >
            <a href={`mailto:${lead.email}`}>
              <Mail className="w-4 h-4 mr-2" aria-hidden="true" />
              Email
            </a>
          </Button>
        )}
      </div>
    </article>
  );
}

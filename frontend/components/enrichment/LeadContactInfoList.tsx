"use client";

import { useState } from "react";
import {
  Mail,
  Phone,
  Copy,
  Check,
  User,
  Loader2,
  Star,
  AlertCircle,
} from "lucide-react";
import { useLeadContactInfo } from "@/hooks/api/useEnrichment";

interface LeadContactInfoListProps {
  leadId: string;
}

export function LeadContactInfoList({ leadId }: LeadContactInfoListProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Always fetch contact info - backend returns lead's own fields as fallback
  const { data, isLoading, error } = useLeadContactInfo(leadId);

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      work_email: "Work Email",
      personal_email: "Personal Email",
      work_phone: "Work Phone",
      mobile_phone: "Mobile",
      direct_phone: "Direct Dial",
      main_phone: "Main Line",
    };
    return labels[type] || type.replace(/_/g, " ");
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-500";
    if (confidence >= 70) return "text-amber-500";
    return "text-red-500";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-red-500">
        <AlertCircle className="w-5 h-5" />
        <span className="text-sm">Failed to load contact info</span>
      </div>
    );
  }

  const contacts = data?.contacts || [];

  if (contacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No contact information found</p>
        <p className="text-xs mt-1">Enrich this lead to find contact details</p>
      </div>
    );
  }

  // Group contacts by type
  const emails = contacts.filter((c) => c.type.includes("email"));
  const phones = contacts.filter(
    (c) => c.type.includes("phone") || c.type.includes("mobile") || c.type.includes("direct")
  );

  return (
    <div className="space-y-4">
      {/* Emails */}
      {emails.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Email Addresses
          </h4>
          <div className="space-y-2">
            {emails.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-md group"
              >
                <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm truncate">
                      {contact.value}
                    </span>
                    {contact.isPrimary && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getTypeLabel(contact.type)}</span>
                    {contact.confidence && (
                      <>
                        <span>•</span>
                        <span className={getConfidenceColor(contact.confidence)}>
                          {contact.confidence}% confident
                        </span>
                      </>
                    )}
                    {contact.source && (
                      <>
                        <span>•</span>
                        <span>via {contact.source}</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(contact.value, contact.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-muted rounded-md transition-all"
                  title="Copy"
                >
                  {copiedId === contact.id ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Phones */}
      {phones.length > 0 && (
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Phone Numbers
          </h4>
          <div className="space-y-2">
            {phones.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 bg-muted/50 rounded-md group"
              >
                <div className="w-8 h-8 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center">
                  <Phone className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{contact.value}</span>
                    {contact.isPrimary && (
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                    )}
                    {contact.isVerified && (
                      <span className="px-1.5 py-0.5 text-xs bg-green-500/10 text-green-500 rounded">
                        Verified
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{getTypeLabel(contact.type)}</span>
                    {contact.confidence && (
                      <>
                        <span>•</span>
                        <span className={getConfidenceColor(contact.confidence)}>
                          {contact.confidence}% confident
                        </span>
                      </>
                    )}
                    {contact.source && (
                      <>
                        <span>•</span>
                        <span>via {contact.source}</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleCopy(contact.value, contact.id)}
                  className="opacity-0 group-hover:opacity-100 p-2 hover:bg-muted rounded-md transition-all"
                  title="Copy"
                >
                  {copiedId === contact.id ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

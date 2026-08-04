"use client";

import { useState, useRef, useEffect } from "react";
import { Phone, Building2, ChevronDown, X, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  usePhoneNumberAssignments,
  useAssignPhoneNumber,
  useUnassignPhoneNumber,
} from "@/hooks/api/usePhoneNumberAssignments";
import { useClients } from "@/hooks/api/useClients";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

interface PhoneNumberAssignmentManagerProps {
  organizationId: string;
}

export function PhoneNumberAssignmentManager({
  organizationId,
}: PhoneNumberAssignmentManagerProps) {
  const [selectedPhoneForAssign, setSelectedPhoneForAssign] = useState<string | null>(null);

  const { data: phoneNumbers, isLoading: loadingNumbers, refetch } = usePhoneNumberAssignments(organizationId);
  const { data: clients, isLoading: loadingClients } = useClients();

  const assignMutation = useAssignPhoneNumber();
  const unassignMutation = useUnassignPhoneNumber();

  const handleAssign = async (
    phoneNumber: string,
    clientId: string,
    friendlyName?: string
  ) => {
    try {
      await assignMutation.mutateAsync({
        organizationId,
        clientId,
        phoneNumber,
        friendlyName,
      });
      toast.success("Phone number assigned to client");
      setSelectedPhoneForAssign(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to assign phone number"
      );
    }
  };

  const handleUnassign = async (phoneNumber: string) => {
    try {
      await unassignMutation.mutateAsync({ organizationId, phoneNumber });
      toast.success("Phone number unassigned");
    } catch {
      toast.error("Failed to unassign phone number");
    }
  };

  if (loadingNumbers || loadingClients) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {phoneNumbers && phoneNumbers.length > 0 ? (
        <>
          {phoneNumbers.map((phone) => (
            <div
              key={phone.phoneNumber}
              className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-chart-4/10 flex items-center justify-center">
                  <Phone className="w-5 h-5 text-chart-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground font-mono">
                      {phone.phoneNumber}
                    </p>
                    {phone.callerIdVerified ? (
                      <span className="flex items-center gap-1 text-xs text-green-600 bg-green-500/10 px-1.5 py-0.5 rounded" title="Caller ID Verified">
                        <ShieldCheck className="w-3 h-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded" title="Caller ID Not Verified">
                        <ShieldAlert className="w-3 h-3" />
                        Unverified
                      </span>
                    )}
                  </div>
                  {phone.friendlyName && (
                    <p className="text-xs text-muted-foreground">
                      {phone.friendlyName}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Capability badges */}
                <div className="flex items-center gap-1 mr-2">
                  {phone.capabilities?.voice && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-chart-4/10 text-chart-4">
                      Voice
                    </span>
                  )}
                  {phone.capabilities?.sms && (
                    <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/10 text-blue-500">
                      SMS
                    </span>
                  )}
                </div>

                {phone.assignedToClient ? (
                  <>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                      {phone.assignedToClient.color && (
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: phone.assignedToClient.color }}
                        />
                      )}
                      <span className="text-sm font-medium">
                        {phone.assignedToClient.name}
                      </span>
                    </div>
                    <button
                      onClick={() => handleUnassign(phone.phoneNumber)}
                      disabled={unassignMutation.isPending}
                      className="p-1.5 text-muted-foreground hover:text-red-500 transition"
                      title="Unassign from client"
                    >
                      {unassignMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <X className="w-4 h-4" />
                      )}
                    </button>
                  </>
                ) : selectedPhoneForAssign === phone.phoneNumber ? (
                  <ClientSelector
                    clients={clients || []}
                    onSelect={(clientId) =>
                      handleAssign(phone.phoneNumber, clientId, phone.friendlyName)
                    }
                    onCancel={() => setSelectedPhoneForAssign(null)}
                    loading={assignMutation.isPending}
                  />
                ) : (
                  <button
                    onClick={() => setSelectedPhoneForAssign(phone.phoneNumber)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/80 rounded-lg text-sm transition"
                  >
                    <Building2 className="w-4 h-4" />
                    Assign to Client
                  </button>
                )}
              </div>
            </div>
          ))}
          <Button
            variant="outline"
            className="w-full"
            onClick={() => refetch()}
            disabled={loadingNumbers}
          >
            <Loader2 className={`w-4 h-4 mr-2 ${loadingNumbers ? "animate-spin" : ""}`} />
            Refresh Phone Numbers
          </Button>
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            No phone numbers found in your Twilio account.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Purchase phone numbers from your Twilio Console.
          </p>
        </div>
      )}
    </div>
  );
}

// Client selector dropdown component
function ClientSelector({
  clients,
  onSelect,
  onCancel,
  loading,
}: {
  clients: Array<{ id: string; name: string; color?: string | null }>;
  onSelect: (clientId: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onCancel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onCancel]);

  if (clients.length === 0) {
    return (
      <div className="text-sm text-muted-foreground px-3 py-1.5">
        No clients available.{" "}
        <button onClick={onCancel} className="text-primary hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg text-sm"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            Select client
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {open && !loading && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10 py-1">
          {clients.map((client) => (
            <button
              key={client.id}
              onClick={() => onSelect(client.id)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 flex items-center gap-2"
            >
              {client.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: client.color }}
                />
              )}
              <span className="truncate">{client.name}</span>
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              onClick={onCancel}
              className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

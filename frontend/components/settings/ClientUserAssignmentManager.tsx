"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, User, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClients } from "@/hooks/api/useClients";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import {
  useUserClientAssignments,
  useAssignUserToClient,
  useUnassignUserFromClient,
} from "@/hooks/api/useClientUserAssignments";
import { toast } from "sonner";

interface Member {
  id: string;
  userId: string;
  role: string;
  user?: {
    name: string | null;
    email: string;
  };
}

interface ClientUserAssignmentManagerProps {
  organizationId: string;
}

export function ClientUserAssignmentManager({ organizationId: _organizationId }: ClientUserAssignmentManagerProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedClientId, setSelectedClientId] = useState<string>("");

  // Fetch all clients
  const { data: clients, isLoading: clientsLoading } = useClients();

  // Fetch organization members
  const { data: membersData, isLoading: membersLoading } = useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];

  // Filter to only show members (not admins/owners who already have access to all)
  const memberUsers = members.filter((m) => m.role === "member");

  // Fetch assignments for selected user
  const { data: assignments, isLoading: assignmentsLoading } = useUserClientAssignments(
    selectedUserId || undefined
  );

  const assignUser = useAssignUserToClient();
  const unassignUser = useUnassignUserFromClient();

  const handleAssign = async () => {
    if (!selectedUserId || !selectedClientId) return;

    try {
      await assignUser.mutateAsync({
        clientId: selectedClientId,
        userId: selectedUserId,
      });
      setSelectedClientId("");
      toast.success("Client assigned to user");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to assign client");
    }
  };

  const handleUnassign = async (clientId: string) => {
    if (!selectedUserId) return;

    try {
      await unassignUser.mutateAsync({
        clientId,
        userId: selectedUserId,
      });
      toast.success("Client unassigned from user");
    } catch {
      toast.error("Failed to unassign client");
    }
  };

  // Get assigned client IDs to filter out already assigned clients
  const assignedClientIds = assignments?.map((a) => a.clientId) || [];
  const availableClients = clients?.filter((c) => !assignedClientIds.includes(c.id)) || [];

  // Get selected user info for display
  const selectedUser = memberUsers.find((m) => m.userId === selectedUserId);

  return (
    <div className="space-y-4">
      {/* User selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Select User</label>
        <select
          value={selectedUserId}
          onChange={(e) => {
            setSelectedUserId(e.target.value);
            setSelectedClientId("");
          }}
          disabled={membersLoading}
          className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
        >
          <option value="">Choose a team member...</option>
          {memberUsers.map((member) => (
            <option key={member.userId} value={member.userId}>
              {member.user?.name || member.user?.email || "Unknown"}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          Select a team member to manage their client access
        </p>
      </div>

      {selectedUserId && (
        <>
          {/* Selected user info */}
          {selectedUser && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {selectedUser.user?.name || "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">{selectedUser.user?.email}</p>
              </div>
            </div>
          )}

          {/* Assigned clients list */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Assigned Clients</label>
            {assignmentsLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            ) : assignments && assignments.length > 0 ? (
              <div className="space-y-2">
                {assignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border group"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: assignment.clientColor
                            ? `${assignment.clientColor}20`
                            : "var(--muted)",
                        }}
                      >
                        <Building2
                          className="w-4 h-4"
                          style={{
                            color: assignment.clientColor || "var(--muted-foreground)",
                          }}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {assignment.clientColor && (
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: assignment.clientColor }}
                          />
                        )}
                        <p className="text-sm font-medium text-foreground">
                          {assignment.clientName || "Unknown"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnassign(assignment.clientId)}
                      disabled={unassignUser.isPending}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                No clients assigned to this user yet
              </div>
            )}
          </div>

          {/* Add client selector */}
          {availableClients.length > 0 && (
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-foreground mb-2">Add Client</label>
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  disabled={clientsLoading}
                  className="w-full h-11 px-4 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-colors"
                >
                  <option value="">Select a client...</option>
                  {availableClients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                onClick={handleAssign}
                disabled={!selectedClientId || assignUser.isPending}
                className="h-11"
              >
                {assignUser.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </div>
          )}

          {availableClients.length === 0 && clients && clients.length > 0 && (
            <p className="text-xs text-muted-foreground">
              All clients have been assigned to this user.
            </p>
          )}
        </>
      )}

      {memberUsers.length === 0 && !membersLoading && (
        <p className="text-xs text-muted-foreground">
          No team members found. Admins and owners already have access to all clients.
        </p>
      )}
    </div>
  );
}

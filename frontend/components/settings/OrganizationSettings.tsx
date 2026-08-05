"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import Card from "@/components/ui/card";
import { FormInput } from "@/components/ui/form-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Modal from "@/components/ui/modal";
import { toast } from "sonner";
import { useSession, useActiveOrganization } from "@/lib/auth-client";
import {
  useInviteMember,
  useListOrganizationMembers,
  useListOrganizationInvitations,
  useCancelOrganizationInvitation,
  useRemoveOrganizationMember,
  useUpdateOrganization,
} from "@/hooks/api/useOrganization";
import {
  useClients,
  useCreateClient,
  useDeleteClient,
  useUpdateClient,
} from "@/hooks/api/useClients";

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  };
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
}

interface MutationResult {
  error?: { message?: string };
}

interface OrganizationSettingsProps {
  isAdmin: boolean;
}

export function OrganizationSettings({ isAdmin }: OrganizationSettingsProps) {
  const { data: session } = useSession();
  const { data: activeOrganization } = useActiveOrganization();
  const user = session?.user;

  const { data: membersData, isLoading: membersLoading } = useListOrganizationMembers();
  const members: OrgMember[] = membersData?.data?.members || [];
  const { data: invitationsData, isLoading: invitationsLoading } = useListOrganizationInvitations();
  const allInvitations: OrgInvitation[] = invitationsData?.data || [];
  const invitations = allInvitations.filter((inv) => inv.status === "pending");

  const inviteMemberMutation = useInviteMember();
  const cancelInvitationMutation = useCancelOrganizationInvitation();
  const removeMemberMutation = useRemoveOrganizationMember();
  const updateOrganizationMutation = useUpdateOrganization();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const createClientMutation = useCreateClient();
  const updateClientMutation = useUpdateClient();
  const deleteClientMutation = useDeleteClient();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [organizationName, setOrganizationName] = useState(
    activeOrganization?.name ?? ""
  );
  const [isEditingOrganizationName, setIsEditingOrganizationName] =
    useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [editingClient, setEditingClient] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [clientToDelete, setClientToDelete] = useState<{
    id: string;
    name: string;
    campaignCount: number;
  } | null>(null);

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(null);
  const [isRemoveMemberModalOpen, setIsRemoveMemberModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    id: string;
    name: string;
    email: string;
  } | null>(null);

  const currentUserMember = members.find((m) => m.userId === user?.id);
  const isOwner = currentUserMember?.role === "owner";

  useEffect(() => {
    queueMicrotask(() => {
      setOrganizationName(activeOrganization?.name ?? "");
      setIsEditingOrganizationName(false);
    });
  }, [activeOrganization?.id, activeOrganization?.name]);

  const handleRenameOrganization = async () => {
    if (!activeOrganization?.id) {
      toast.error("No active organization selected");
      return;
    }

    const nextName = organizationName.trim();
    if (!nextName) {
      toast.error("Please enter an organization name");
      return;
    }

    try {
      await updateOrganizationMutation.mutateAsync({
        organizationId: activeOrganization.id,
        name: nextName,
      });
      toast.success("Organization renamed");
      setIsEditingOrganizationName(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rename organization"
      );
    }
  };

  const handleCreateClient = async (event: React.FormEvent) => {
    event.preventDefault();

    const name = newClientName.trim();
    if (!name) {
      toast.error("Please enter a client name");
      return;
    }

    try {
      await createClientMutation.mutateAsync({ name });
      toast.success("Client created");
      setNewClientName("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create client"
      );
    }
  };

  const handleUpdateClient = async () => {
    if (!editingClient) return;

    const name = editingClient.name.trim();
    if (!name) {
      toast.error("Please enter a client name");
      return;
    }

    try {
      await updateClientMutation.mutateAsync({ id: editingClient.id, name });
      toast.success("Client renamed");
      setEditingClient(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to rename client"
      );
    }
  };

  const handleDeleteClient = async () => {
    if (!clientToDelete) return;

    try {
      await deleteClientMutation.mutateAsync(clientToDelete.id);
      toast.success("Client deleted");
      setClientToDelete(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete client"
      );
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail) {
      return toast.error("Please enter an email address");
    }

    if (!activeOrganization) {
      return toast.error("No active organization selected");
    }

    inviteMemberMutation.mutate(
      { email: inviteEmail, role: inviteRole, organizationId: activeOrganization.id },
      {
        onSuccess: (result) => {
          const res = result as MutationResult | null;
          if (res?.error) {
            toast.error(res.error.message || "Failed to send invitation");
          } else {
            toast.success(`Invitation sent to ${inviteEmail}!`);
            setInviteEmail("");
            setInviteRole("member");
          }
        },
        onError: () => {
          toast.error("An error occurred. Please try again.");
        },
      }
    );
  };

  const handleRemoveMember = (member: OrgMember) => {
    setMemberToRemove({
      id: member.id,
      name: member.user?.name || member.user?.email || "Unknown",
      email: member.user?.email || "",
    });
    setIsRemoveMemberModalOpen(true);
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;

    removeMemberMutation.mutate(
      { memberIdOrEmail: memberToRemove.id },
      {
        onSuccess: (result) => {
          const res = result as MutationResult | null;
          if (res?.error) {
            toast.error(res.error.message || "Failed to remove member");
          } else {
            toast.success("Member removed successfully");
          }
          setIsRemoveMemberModalOpen(false);
          setMemberToRemove(null);
        },
        onError: () => {
          toast.error("Failed to remove member");
          setIsRemoveMemberModalOpen(false);
          setMemberToRemove(null);
        },
      }
    );
  };

  const handleCancelInvitation = async (invitationId: string) => {
    setInvitationToCancel(invitationId);
    setIsCancelModalOpen(true);
  };

  const confirmCancelInvitation = () => {
    if (!invitationToCancel) return;

    cancelInvitationMutation.mutate(
      { invitationId: invitationToCancel },
      {
        onSuccess: (result) => {
          const res = result as MutationResult | null;
          if (res?.error) {
            toast.error(res.error.message || "Failed to cancel invitation");
          } else {
            toast.success("Invitation cancelled successfully");
          }
          setIsCancelModalOpen(false);
          setInvitationToCancel(null);
        },
        onError: () => {
          toast.error("Failed to cancel invitation");
          setIsCancelModalOpen(false);
          setInvitationToCancel(null);
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {activeOrganization && (
        <Card title="Organization">
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-foreground mb-1">
                  Organization Name
                </label>
                {isEditingOrganizationName ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      value={organizationName}
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      className="sm:max-w-sm"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleRenameOrganization}
                        disabled={updateOrganizationMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOrganizationName(activeOrganization.name);
                          setIsEditingOrganizationName(false);
                        }}
                        disabled={updateOrganizationMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <p className="text-foreground">{activeOrganization.name}</p>
                    {isAdmin && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingOrganizationName(true)}
                      >
                        <Pencil className="h-4 w-4" />
                        Rename
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card title="Clients">
          <div className="space-y-4">
            <form
              onSubmit={handleCreateClient}
              className="flex flex-col gap-2 sm:flex-row"
            >
              <Input
                value={newClientName}
                onChange={(event) => setNewClientName(event.target.value)}
                placeholder="New client name"
                className="sm:max-w-sm"
              />
              <Button type="submit" disabled={createClientMutation.isPending}>
                <Plus className="h-4 w-4" />
                Add Client
              </Button>
            </form>

            <div className="rounded-lg border border-border overflow-hidden">
              {clientsLoading ? (
                <div className="p-4 text-sm text-muted-foreground">
                  Loading clients...
                </div>
              ) : clients.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">
                  No clients yet.
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {clients.map((client) => {
                    const isEditing = editingClient?.id === client.id;

                    return (
                      <div
                        key={client.id}
                        className="flex items-center justify-between gap-3 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          {isEditing && editingClient ? (
                            <Input
                              value={editingClient.name}
                              onChange={(event) =>
                                setEditingClient({
                                  id: client.id,
                                  name: event.target.value,
                                })
                              }
                              className="max-w-sm"
                            />
                          ) : (
                            <>
                              <div className="font-medium text-foreground truncate">
                                {client.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {client.campaignCount} campaign
                                {client.campaignCount === 1 ? "" : "s"}
                              </div>
                            </>
                          )}
                        </div>

                        {isEditing ? (
                          <div className="flex gap-2">
                            <Button
                              size="icon-sm"
                              type="button"
                              onClick={handleUpdateClient}
                              disabled={updateClientMutation.isPending}
                              aria-label="Save client"
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              type="button"
                              onClick={() => setEditingClient(null)}
                              disabled={updateClientMutation.isPending}
                              aria-label="Cancel client edit"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <Button
                              size="icon-sm"
                              variant="outline"
                              type="button"
                              onClick={() =>
                                setEditingClient({
                                  id: client.id,
                                  name: client.name,
                                })
                              }
                              aria-label="Rename client"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="outline"
                              type="button"
                              onClick={() =>
                                setClientToDelete({
                                  id: client.id,
                                  name: client.name,
                                  campaignCount: client.campaignCount,
                                })
                              }
                              aria-label="Delete client"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {isAdmin && (
        <Card title="Invite New Member">
          <form onSubmit={handleInviteMember} className="space-y-4">
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <FormInput
                  placeholder="Enter email address"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "member" | "admin")}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-foreground bg-card focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
                  aria-label="Member role"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit" disabled={inviteMemberMutation.isPending}>
                Send Invite
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {inviteRole === "admin"
                ? "Admins can manage billing, team members, Telnyx config, and integrations"
                : "Members can use the dialer, CRM, campaigns, leads, and analytics"}
            </p>
          </form>
        </Card>
      )}

      <Card title={`Team Members (${members.length})`}>
        {membersLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading members...
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No members yet
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const memberName = member.user?.name || "Unknown";
              const memberEmail = member.user?.email || "";
              const avatarImage = member.user?.image;
              const avatarFallback = memberName.charAt(0).toUpperCase();

              return (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[var(--color-primary)] flex items-center justify-center overflow-hidden">
                      {avatarImage ? (
                        <Image
                          src={avatarImage}
                          alt={memberName}
                          width={40}
                          height={40}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-white font-semibold">
                          {avatarFallback}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{memberName}</p>
                      <p className="text-sm text-muted-foreground">{memberEmail}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 text-xs font-medium rounded-full ${
                        member.role === "admin" || member.role === "owner"
                          ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {member.role}
                    </span>
                    {isAdmin &&
                      member.userId !== user?.id &&
                      member.role !== "owner" &&
                      (isOwner || member.role !== "admin") && (
                        <button
                          onClick={() => handleRemoveMember(member)}
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition"
                          aria-label="Remove member"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {invitations.length > 0 && (
        <Card title={`Pending Invitations (${invitations.length})`}>
          {invitationsLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading invitations...
            </div>
          ) : (
            <div className="space-y-2">
              {invitations.map((invitation) => {
                const inviteeEmail = invitation.email;
                const avatar = inviteeEmail.charAt(0).toUpperCase();

                return (
                  <div
                    key={invitation.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <span className="text-muted-foreground font-semibold">
                          {avatar}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{inviteeEmail}</p>
                        <p className="text-sm text-muted-foreground">
                          Invited - Pending acceptance
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                        {invitation.role}
                      </span>
                      {isAdmin && (
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-sm text-red-600 hover:text-red-700"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      <Modal
        isOpen={!!clientToDelete}
        onClose={() => setClientToDelete(null)}
        title="Delete Client"
        subtitle={
          clientToDelete
            ? `Are you sure you want to delete ${clientToDelete.name}?`
            : undefined
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {clientToDelete?.campaignCount
              ? "Clients with campaigns cannot be deleted until those campaigns are reassigned or deleted."
              : "This action cannot be undone."}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setClientToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteClient}
              disabled={
                deleteClientMutation.isPending ||
                !!clientToDelete?.campaignCount
              }
            >
              Delete Client
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setInvitationToCancel(null);
        }}
        title="Cancel Invitation"
        subtitle="Are you sure you want to cancel this invitation?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The invited user will no longer be able to accept this invitation.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsCancelModalOpen(false);
                setInvitationToCancel(null);
              }}
            >
              No, Keep It
            </Button>
            <Button
              onClick={confirmCancelInvitation}
              disabled={cancelInvitationMutation.isPending}
            >
              Yes, Cancel Invitation
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={isRemoveMemberModalOpen}
        onClose={() => {
          setIsRemoveMemberModalOpen(false);
          setMemberToRemove(null);
        }}
        title="Remove Member"
        subtitle="Are you sure you want to remove this member?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {memberToRemove && (
              <>
                <strong>{memberToRemove.name}</strong>
                {memberToRemove.email && ` (${memberToRemove.email})`} will be
                removed from the organization.
              </>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsRemoveMemberModalOpen(false);
                setMemberToRemove(null);
              }}
            >
              No, Keep Member
            </Button>
            <Button
              onClick={confirmRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              Yes, Remove Member
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Page } from '@/components/dashboard/Page';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Modal from '@/components/ui/modal';
import { TeamMembersList } from '@/components/settings/TeamMembersList';
import { InviteMemberModal } from '@/components/settings/InviteMemberModal';
import { useSession, useActiveOrganization } from '@/lib/auth-client';
import {
  useInviteMember,
  useListOrganizationMembers,
  useListOrganizationInvitations,
  useCancelOrganizationInvitation,
  useRemoveOrganizationMember,
  useResendOrganizationInvitation,
} from '@/hooks/api/useOrganization';
import { toast } from 'sonner';
import { UserPlus, X, RefreshCw } from 'lucide-react';

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
}

interface Member {
  id: string;
  userId: string;
  role: string;
  user?: {
    name?: string;
    email?: string;
    image?: string;
  };
}

export default function TeamSettingsPage() {
  const { data: session } = useSession();
  const { data: activeOrganization } = useActiveOrganization();
  const user = session?.user;

  // Queries
  const { data: membersData, isLoading: membersLoading } =
    useListOrganizationMembers();
  const members = (membersData?.data?.members || []) as Member[];
  const { data: invitationsData, isLoading: invitationsLoading } =
    useListOrganizationInvitations();
  const allInvitations = (invitationsData?.data || []) as Invitation[];
  // Filter pending invitations and exclude expired ones
  const invitations = allInvitations.filter((inv) => {
    if (inv.status !== 'pending') return false;
    // Check if invitation has expired
    if (inv.expiresAt && new Date(inv.expiresAt) < new Date()) return false;
    return true;
  });

  // Mutations
  const inviteMemberMutation = useInviteMember();
  const cancelInvitationMutation = useCancelOrganizationInvitation();
  const removeMemberMutation = useRemoveOrganizationMember();
  const resendInvitationMutation = useResendOrganizationInvitation();

  // Modal state
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isRemoveModalOpen, setIsRemoveModalOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<Member | null>(null);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [invitationToCancel, setInvitationToCancel] = useState<string | null>(
    null
  );
  const [isResendModalOpen, setIsResendModalOpen] = useState(false);
  const [invitationToResend, setInvitationToResend] = useState<Invitation | null>(
    null
  );
  // Check user role - only owners can manage team
  const currentUserMember = members.find((m) => m.userId === user?.id);
  const isOwner = currentUserMember?.role === 'owner';

  const handleInvite = (email: string, role: 'member' | 'owner') => {
    if (!activeOrganization) {
      toast.error('No active organization');
      return;
    }

    // Check if user is already a member
    const existingMember = members.find(
      (m) => m.user?.email?.toLowerCase() === email.toLowerCase()
    );
    if (existingMember) {
      toast.error('This user is already a member of your organization.');
      return;
    }

    // Check if there's already a pending invitation for this email
    const existingInvitation = invitations.find(
      (inv) => inv.email.toLowerCase() === email.toLowerCase()
    );
    if (existingInvitation) {
      toast.error(
        'This email already has a pending invitation. Use the resend button to send a new invite.'
      );
      return;
    }

    inviteMemberMutation.mutate(
      { email, role, organizationId: activeOrganization.id },
      {
        onSuccess: (result) => {
          if (result?.error) {
            // Provide clearer error messages for common cases
            const errorMsg = result.error.message?.toLowerCase() || '';
            if (
              errorMsg.includes('already') ||
              errorMsg.includes('exists') ||
              errorMsg.includes('pending')
            ) {
              toast.error(
                'This user already has a pending invitation or is already a member.'
              );
            } else if (errorMsg.includes('invalid') && errorMsg.includes('email')) {
              toast.error('Please enter a valid email address.');
            } else {
              toast.error(result.error.message || 'Failed to send invitation');
            }
          } else {
            toast.success(`Invitation sent to ${email}!`);
            setIsInviteModalOpen(false);
          }
        },
        onError: () => {
          toast.error('An error occurred. Please try again.');
        },
      }
    );
  };

  const handleRemoveMember = (member: Member) => {
    setMemberToRemove(member);
    setIsRemoveModalOpen(true);
  };

  const confirmRemoveMember = () => {
    if (!memberToRemove) return;

    removeMemberMutation.mutate(
      { memberIdOrEmail: memberToRemove.id },
      {
        onSuccess: (result) => {
          if (result.error) {
            toast.error(result.error.message || 'Failed to remove member');
          } else {
            toast.success('Member removed successfully');
          }
          setIsRemoveModalOpen(false);
          setMemberToRemove(null);
        },
        onError: () => {
          toast.error('Failed to remove member');
          setIsRemoveModalOpen(false);
          setMemberToRemove(null);
        },
      }
    );
  };

  const handleCancelInvitation = (invitationId: string) => {
    setInvitationToCancel(invitationId);
    setIsCancelModalOpen(true);
  };

  const confirmCancelInvitation = () => {
    if (!invitationToCancel) return;

    cancelInvitationMutation.mutate(
      { invitationId: invitationToCancel },
      {
        onSuccess: (result) => {
          if (result?.error) {
            toast.error(result.error.message || 'Failed to cancel invitation');
          } else {
            toast.success('Invitation cancelled');
          }
          setIsCancelModalOpen(false);
          setInvitationToCancel(null);
        },
        onError: () => {
          toast.error('Failed to cancel invitation');
          setIsCancelModalOpen(false);
          setInvitationToCancel(null);
        },
      }
    );
  };

  const handleResendInvitation = (invitation: Invitation) => {
    setInvitationToResend(invitation);
    setIsResendModalOpen(true);
  };

  const confirmResendInvitation = () => {
    if (!invitationToResend) return;

    resendInvitationMutation.mutate(
      {
        invitationId: invitationToResend.id,
        email: invitationToResend.email,
        role: invitationToResend.role as 'member' | 'admin' | 'owner',
      },
      {
        onSuccess: () => {
          toast.success(`Invitation resent to ${invitationToResend.email}!`);
          setIsResendModalOpen(false);
          setInvitationToResend(null);
        },
        onError: () => {
          toast.error('Failed to resend invitation');
          setIsResendModalOpen(false);
          setInvitationToResend(null);
        },
      }
    );
  };

  return (
    <Page title="Team Management" subtitle="Manage your organization members">
      <div className="space-y-6">
        {/* Invite Button */}
        {isOwner && (
          <div className="flex justify-end">
            <Button onClick={() => setIsInviteModalOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Member
            </Button>
          </div>
        )}

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamMembersList
              members={members}
              isLoading={membersLoading}
              currentUserId={user?.id}
              isOwner={isOwner}
              onRemoveMember={handleRemoveMember}
            />
          </CardContent>
        </Card>

        {/* Pending Invitations */}
        {invitations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations ({invitations.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-muted"
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {invitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground font-semibold">
                            {invitation.email.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">
                            {invitation.email}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Pending acceptance
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
                          {invitation.role}
                        </span>
                        {isOwner && (
                          <>
                            <button
                              onClick={() => handleResendInvitation(invitation)}
                              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded transition"
                              aria-label="Resend invitation"
                              title="Resend invitation"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleCancelInvitation(invitation.id)
                              }
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition"
                              aria-label="Cancel invitation"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Invite Modal */}
      <InviteMemberModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={handleInvite}
        isLoading={inviteMemberMutation.isPending}
      />

      {/* Remove Member Modal */}
      <Modal
        isOpen={isRemoveModalOpen}
        onClose={() => {
          setIsRemoveModalOpen(false);
          setMemberToRemove(null);
        }}
        title="Remove Member"
        subtitle="Are you sure you want to remove this member?"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {memberToRemove && (
              <>
                <strong>{memberToRemove.user?.name || 'This member'}</strong>
                {memberToRemove.user?.email &&
                  ` (${memberToRemove.user.email})`}{' '}
                will be removed from the organization.
              </>
            )}
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsRemoveModalOpen(false);
                setMemberToRemove(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRemoveMember}
              disabled={removeMemberMutation.isPending}
            >
              Remove Member
            </Button>
          </div>
        </div>
      </Modal>

      {/* Cancel Invitation Modal */}
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
              Keep Invitation
            </Button>
            <Button
              onClick={confirmCancelInvitation}
              disabled={cancelInvitationMutation.isPending}
            >
              Cancel Invitation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Resend Invitation Modal */}
      <Modal
        isOpen={isResendModalOpen}
        onClose={() => {
          setIsResendModalOpen(false);
          setInvitationToResend(null);
        }}
        title="Resend Invitation"
        subtitle="Send a new invitation email"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will send a new invitation email to{' '}
            <strong>{invitationToResend?.email}</strong> with a fresh 7-day
            expiration.
          </p>
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsResendModalOpen(false);
                setInvitationToResend(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmResendInvitation}
              disabled={resendInvitationMutation.isPending}
            >
              {resendInvitationMutation.isPending
                ? 'Sending...'
                : 'Resend Invitation'}
            </Button>
          </div>
        </div>
      </Modal>

    </Page>
  );
}

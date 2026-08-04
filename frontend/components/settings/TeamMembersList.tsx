'use client';

import Image from 'next/image';
import { Trash2 } from 'lucide-react';

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

interface TeamMembersListProps {
  members: Member[];
  isLoading: boolean;
  currentUserId: string | undefined;
  isOwner: boolean;
  onRemoveMember: (member: Member) => void;
}

export function TeamMembersList({
  members,
  isLoading,
  currentUserId,
  isOwner,
  onRemoveMember,
}: TeamMembersListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No team members yet
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const memberName = member.user?.name || 'Unknown';
        const memberEmail = member.user?.email || '';
        const avatarImage = member.user?.image;
        const avatarFallback = memberName.charAt(0).toUpperCase();
        // Owners can only remove members, not co-owners
        const canRemove =
          isOwner &&
          member.userId !== currentUserId &&
          member.role === 'member';
        return (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center overflow-hidden">
                {avatarImage ? (
                  <Image
                    src={avatarImage}
                    alt={memberName}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-primary-foreground font-semibold">
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
                  member.role === 'owner'
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {member.role}
              </span>
              {canRemove && (
                <button
                  onClick={() => onRemoveMember(member)}
                  className="p-1.5 text-destructive hover:text-destructive hover:bg-destructive/10 rounded transition"
                  aria-label="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

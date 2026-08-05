"use client";

import { useSession } from "@/lib/auth-client";
import { useListOrganizationMembers } from "@/hooks/api/useOrganization";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

interface OrganizationMember {
  userId: string;
  role: string;
}

export function useOrganizationAdmin(): boolean {
  const { data: session } = useSession();
  const { data: membersData } = useListOrganizationMembers();
  const isSuperAdmin = useSuperAdmin();
  const members: OrganizationMember[] = membersData?.data?.members ?? [];
  const currentUserMember = members.find(
    (member) => member.userId === session?.user?.id,
  );

  return (
    isSuperAdmin ||
    currentUserMember?.role === "owner" ||
    currentUserMember?.role === "admin"
  );
}

import { findMember } from '@/repositories/organization.repository'
import { getUserById } from '@/repositories/auth.repository'
import { OrganizationRole } from '@shared/types/src/organization'

const isSuperadmin = async (userId: string): Promise<boolean> => {
  const user = await getUserById(userId)
  return user?.role === 'superadmin'
}

export const isMemberOfOrganization = async (
  userId: string,
  organizationId: string,
) => {
  if (await isSuperadmin(userId)) {
    return true
  }
  const member = await findMember(organizationId, userId)
  if (!member) {
    return false
  }
  return true
}

export const doesMemberHaveRole = async (
  userId: string,
  organizationId: string,
  roles: OrganizationRole[],
) => {
  if (await isSuperadmin(userId)) {
    return true
  }
  const member = await findMember(organizationId, userId)
  if (!member) {
    return false
  }
  return roles.includes(member.role as OrganizationRole)
}

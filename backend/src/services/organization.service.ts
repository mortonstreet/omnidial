import {
  findById,
  findMember,
  updateName,
} from '@/repositories/organization.repository'
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

export const updateOrganizationName = async (
  organizationId: string,
  name: string,
) => {
  await findById(organizationId)
  const organization = await updateName(organizationId, name)
  if (!organization) {
    throw new Error('Organization not found')
  }
  return organization
}

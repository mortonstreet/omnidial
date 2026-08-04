import { db } from '@/lib/db'

export type ResolvedActiveOrganization = {
  activeOrganizationId: string | null
  recovered: boolean
  hadInvalidLastActiveOrganization: boolean
}

const getFirstMembershipOrganization = async (userId: string) => {
  const membership = await db
    .selectFrom('member')
    .where('userId', '=', userId)
    .select('organizationId')
    .orderBy('createdAt', 'asc')
    .executeTakeFirst()

  return membership?.organizationId ?? null
}

export const resolveActiveOrganizationForUser = async (
  userId: string,
): Promise<ResolvedActiveOrganization> => {
  const user = await db
    .selectFrom('user')
    .where('id', '=', userId)
    .select(['lastActiveOrganizationId', 'role'])
    .executeTakeFirst()

  if (!user) {
    return {
      activeOrganizationId: null,
      recovered: false,
      hadInvalidLastActiveOrganization: false,
    }
  }

  if (user.lastActiveOrganizationId) {
    if (user.role === 'superadmin') {
      return {
        activeOrganizationId: user.lastActiveOrganizationId,
        recovered: false,
        hadInvalidLastActiveOrganization: false,
      }
    }

    const validMembership = await db
      .selectFrom('member')
      .where('organizationId', '=', user.lastActiveOrganizationId)
      .where('userId', '=', userId)
      .select('id')
      .executeTakeFirst()

    if (validMembership) {
      return {
        activeOrganizationId: user.lastActiveOrganizationId,
        recovered: false,
        hadInvalidLastActiveOrganization: false,
      }
    }

    const fallbackOrgId = await getFirstMembershipOrganization(userId)
    return {
      activeOrganizationId: fallbackOrgId,
      recovered: true,
      hadInvalidLastActiveOrganization: true,
    }
  }

  const fallbackOrgId = await getFirstMembershipOrganization(userId)
  return {
    activeOrganizationId: fallbackOrgId,
    recovered: fallbackOrgId !== null,
    hadInvalidLastActiveOrganization: false,
  }
}

export const getLastActiveOrganization = async (userId: string) => {
  const resolved = await resolveActiveOrganizationForUser(userId)
  return resolved.activeOrganizationId
}

export const updateUserLastActiveOrganizationId = async (
  userId: string,
  activeOrganizationId: string | null,
) => {
  return await db
    .updateTable('user')
    .set({ lastActiveOrganizationId: activeOrganizationId })
    .where('id', '=', userId)
    .executeTakeFirst()
}

export const getOrganizationMember = async (
  organizationId: string,
  userId: string,
) => {
  return await db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .selectAll()
    .executeTakeFirst()
}

export const getUserById = async (userId: string) => {
  return await db
    .selectFrom('user')
    .where('id', '=', userId)
    .select(['id', 'email', 'name', 'role'])
    .executeTakeFirst()
}

export const countUserOwnedOrganizations = async (userId: string) => {
  const result = await db
    .selectFrom('member')
    .where('userId', '=', userId)
    .where('role', '=', 'owner')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirst()
  return result?.count ?? 0
}

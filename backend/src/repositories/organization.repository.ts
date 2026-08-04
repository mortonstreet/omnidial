import { db } from '@/lib/db'

export const findById = async (id: string) => {
  return await db
    .selectFrom('organization')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirstOrThrow()
}

export const findMember = async (organizationId: string, userId: string) => {
  return await db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .selectAll()
    .executeTakeFirst()
}

/**
 * Find all members of an organization
 * Used to route inbound calls to all users in the org
 * Excludes superadmin users (virtual access only)
 */
export const findMembersByOrganizationId = async (organizationId: string) => {
  return await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .where('member.organizationId', '=', organizationId)
    .where((eb) =>
      eb.or([eb('user.role', '!=', 'superadmin'), eb('user.role', 'is', null)]),
    )
    .select([
      'member.id',
      'member.organizationId',
      'member.userId',
      'member.role',
      'member.createdAt',
    ])
    .execute()
}

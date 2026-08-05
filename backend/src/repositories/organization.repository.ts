import { db } from '@/lib/db'

export const findById = async (id: string) => {
  return await db
    .selectFrom('organization')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirstOrThrow()
}

export const updateName = async (id: string, name: string) => {
  return await db
    .updateTable('organization')
    .set({ name })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
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
 * Includes app-level superadmins when they are explicit org members. Superadmin
 * "virtual access" is handled by the absence of a member row.
 */
export const findMembersByOrganizationId = async (organizationId: string) => {
  return await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .where('member.organizationId', '=', organizationId)
    .select([
      'member.id',
      'member.organizationId',
      'member.userId',
      'member.role',
      'member.createdAt',
    ])
    .execute()
}

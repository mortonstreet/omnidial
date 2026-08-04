import { db } from '@/lib/db'
import { withIdAndTimestamps } from './utils'
import { sql } from 'kysely'

export interface AdminUsersFilters {
  page: number
  limit: number
  search?: string
}

export interface AdminOrganizationsFilters {
  page: number
  limit: number
  search?: string
}

export interface CreateCreditTransactionInput {
  organizationId: string
  amount: number
  reason?: string
  addedBy: string
  addedByEmail: string
}

export const getStats = async () => {
  const [usersCount, organizationsCount] = await Promise.all([
    db
      .selectFrom('user')
      .select(db.fn.countAll().as('count'))
      .executeTakeFirst(),
    db
      .selectFrom('organization')
      .select(db.fn.countAll().as('count'))
      .executeTakeFirst(),
  ])

  return {
    users: Number(usersCount?.count || 0),
    organizations: Number(organizationsCount?.count || 0),
  }
}

export const findUsers = async (filters: AdminUsersFilters) => {
  const { page, limit, search } = filters
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('user')
    .leftJoin('member', 'member.userId', 'user.id')
    .leftJoin('organization', 'organization.id', 'member.organizationId')
    .select([
      'user.id',
      'user.email',
      'user.name',
      'user.createdAt',
      'user.role',
      'user.emailVerified',
      sql<string>`string_agg(distinct "organization"."name", ', ')`.as(
        'organizations',
      ),
    ])
    .groupBy([
      'user.id',
      'user.email',
      'user.name',
      'user.createdAt',
      'user.role',
      'user.emailVerified',
    ])

  if (search) {
    const searchLower = `%${search.toLowerCase()}%`
    query = query.where((eb) =>
      eb.or([
        eb(sql`lower("user"."email")`, 'like', searchLower),
        eb(sql`lower("user"."name")`, 'like', searchLower),
        eb(sql`lower("organization"."name")`, 'like', searchLower),
      ]),
    )
  }

  const getCount = async () => {
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`
      const result = await db
        .selectFrom('user')
        .leftJoin('member', 'member.userId', 'user.id')
        .leftJoin('organization', 'organization.id', 'member.organizationId')
        .select(sql<number>`count(distinct "user"."id")`.as('count'))
        .where((eb) =>
          eb.or([
            eb(sql`lower("user"."email")`, 'like', searchLower),
            eb(sql`lower("user"."name")`, 'like', searchLower),
            eb(sql`lower("organization"."name")`, 'like', searchLower),
          ]),
        )
        .executeTakeFirst()
      return result
    }
    return db
      .selectFrom('user')
      .select(db.fn.countAll().as('count'))
      .executeTakeFirst()
  }

  const [users, totalResult] = await Promise.all([
    query
      .orderBy('user.createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .execute(),
    getCount(),
  ])

  return {
    users,
    total: Number(totalResult?.count || 0),
  }
}

export const findOrganizations = async (filters: AdminOrganizationsFilters) => {
  const { page, limit, search } = filters
  const offset = (page - 1) * limit

  let query = db
    .selectFrom('organization')
    .leftJoin('member', 'member.organizationId', 'organization.id')
    .leftJoin(
      'credit_transaction',
      'credit_transaction.organizationId',
      'organization.id',
    )
    .select([
      'organization.id',
      'organization.name',
      'organization.slug',
      'organization.createdAt',
      'organization.managedBySuperadmin',
      sql<number>`count(distinct "member"."id")::int`.as('memberCount'),
      sql<number>`coalesce(sum("credit_transaction"."amount"), 0)::int`.as(
        'creditBalance',
      ),
    ])
    .groupBy([
      'organization.id',
      'organization.name',
      'organization.slug',
      'organization.createdAt',
      'organization.managedBySuperadmin',
    ])

  let countQuery = db
    .selectFrom('organization')
    .select(db.fn.countAll().as('count'))

  if (search) {
    const searchLower = `%${search.toLowerCase()}%`
    query = query.where((eb) =>
      eb.or([
        eb(sql`lower("organization"."name")`, 'like', searchLower),
        eb(sql`lower("organization"."slug")`, 'like', searchLower),
      ]),
    )
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb(sql`lower("organization"."name")`, 'like', searchLower),
        eb(sql`lower("organization"."slug")`, 'like', searchLower),
      ]),
    )
  }

  const [organizations, totalResult] = await Promise.all([
    query
      .orderBy('organization.createdAt', 'desc')
      .limit(limit)
      .offset(offset)
      .execute(),
    countQuery.executeTakeFirst(),
  ])

  return {
    organizations,
    total: Number(totalResult?.count || 0),
  }
}

export const createCreditTransaction = async (
  data: CreateCreditTransactionInput,
) => {
  await db
    .insertInto('credit_transaction')
    .values(
      withIdAndTimestamps({
        organizationId: data.organizationId,
        paymentInvoiceId: `admin-${Date.now()}`,
        amount: data.amount,
        type: 'interview',
        metadata: JSON.stringify({
          reason: data.reason || 'Admin credit adjustment',
          addedBy: data.addedBy,
          addedByEmail: data.addedByEmail,
        }),
      }),
    )
    .execute()
}

export const getOrganizationCreditBalance = async (organizationId: string) => {
  const result = await db
    .selectFrom('credit_transaction')
    .where('organizationId', '=', organizationId)
    .select((eb) => eb.fn.sum<number>('amount').as('balance'))
    .executeTakeFirst()

  return result?.balance ?? 0
}

// ============================================================================
// Super Admin User Management
// ============================================================================

export const deleteUser = async (userId: string) => {
  // Delete user (cascades will handle related records)
  await db.deleteFrom('user').where('id', '=', userId).execute()
}

export const deleteOrganization = async (organizationId: string) => {
  // Delete organization (cascades will handle related records)
  await db.deleteFrom('organization').where('id', '=', organizationId).execute()
}

export const getUserOrganizations = async (userId: string) => {
  return db
    .selectFrom('member')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .where('member.userId', '=', userId)
    .select([
      'member.id as memberId',
      'member.organizationId',
      'member.role',
      'organization.name',
      'organization.slug',
    ])
    .execute()
}

export const removeUserFromOrganization = async (
  organizationId: string,
  userId: string,
) => {
  await db
    .deleteFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .execute()
}

export const addUserToOrganization = async (
  organizationId: string,
  userId: string,
  role: string,
) => {
  const now = new Date()
  await db
    .insertInto('member')
    .values({
      id: crypto.randomUUID(),
      organizationId,
      userId,
      role,
      createdAt: now,
    })
    .execute()
}

export const createOrganization = async (
  name: string,
  slug: string,
  managedBySuperadmin: boolean = false,
) => {
  const now = new Date()
  const org = await db
    .insertInto('organization')
    .values({
      id: crypto.randomUUID(),
      name,
      slug,
      createdAt: now,
      managedBySuperadmin,
    })
    .returning(['id', 'name', 'slug', 'createdAt'])
    .executeTakeFirstOrThrow()

  return org
}

export const getOrganizationById = async (organizationId: string) => {
  return db
    .selectFrom('organization')
    .where('id', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
}

export const getOrganizationBySlug = async (slug: string) => {
  return db
    .selectFrom('organization')
    .where('slug', '=', slug)
    .selectAll()
    .executeTakeFirst()
}

export const getOrganizationMembers = async (organizationId: string) => {
  return db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .where('member.organizationId', '=', organizationId)
    .where((eb) =>
      eb.or([eb('user.role', '!=', 'superadmin'), eb('user.role', 'is', null)]),
    )
    .select([
      'member.id',
      'member.userId',
      'user.email',
      'user.name',
      'member.role',
      'member.createdAt as joinedAt',
      'organization.name as organizationName',
    ])
    .execute()
}

export const getUserById = async (userId: string) => {
  return db
    .selectFrom('user')
    .where('id', '=', userId)
    .selectAll()
    .executeTakeFirst()
}

export const checkUserMembership = async (
  organizationId: string,
  userId: string,
) => {
  return db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .selectAll()
    .executeTakeFirst()
}

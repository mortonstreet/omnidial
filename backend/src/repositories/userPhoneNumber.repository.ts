import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withId, withTimestamps } from './utils'

export interface CreateUserPhoneNumberInput {
  organizationId: string
  userId: string
  phoneNumber: string
  friendlyName?: string
}

/**
 * Assign a caller ID to a rep.
 *
 * A number can only have one owner per org (unique constraint on
 * organizationId + phoneNumber), so reassigning means replacing the existing
 * row rather than inserting a second one. Done as an upsert so callers don't
 * have to delete-then-create and risk leaving the number unassigned in between.
 */
export const assign = async (data: CreateUserPhoneNumberInput) => {
  return db
    .insertInto('user_phone_number')
    .values(withId(withTimestamps(data, true)))
    .onConflict((oc) =>
      oc.columns(['organizationId', 'phoneNumber']).doUpdateSet({
        userId: data.userId,
        friendlyName: data.friendlyName ?? null,
        updatedAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findByOrganization = async (organizationId: string) => {
  return db
    .selectFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .orderBy('createdAt', 'asc')
    .execute()
}

type DbExecutor = typeof db

export const findByUser = async (
  organizationId: string,
  userId: string,
  executor: DbExecutor = db,
) => {
  return executor
    .selectFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .selectAll()
    .orderBy('createdAt', 'asc')
    .execute()
}

export const findAvailableByUserForDialing = async (
  organizationId: string,
  userId: string,
  options: {
    executor?: DbExecutor
    excludePhoneNumbers?: string[]
    limit?: number
  } = {},
) => {
  const executor = options.executor ?? db
  const excludePhoneNumbers = options.excludePhoneNumbers ?? []
  const limit = options.limit ?? 1
  const excludeClause =
    excludePhoneNumbers.length > 0
      ? sql`and upn."phoneNumber" not in (${sql.join(excludePhoneNumbers)})`
      : sql``

  const result = await sql<{
    id: string
    organizationId: string
    userId: string
    phoneNumber: string
    friendlyName: string | null
    createdAt: Date
    updatedAt: Date
  }>`
    select
      upn."id",
      upn."organizationId",
      upn."userId",
      upn."phoneNumber",
      upn."friendlyName",
      upn."createdAt",
      upn."updatedAt"
    from "user_phone_number" upn
    left join lateral (
      select
        count(*) filter (
          where c."endedAt" is null
            and c."direction" = 'outbound'
            and c."status" in ('initiated', 'ringing', 'in-progress')
        )::int as active_count,
        max(c."startedAt") as last_used_at
      from "call" c
      inner join "twilio_config" tc on tc."id" = c."twilioConfigId"
      where tc."organizationId" = upn."organizationId"
        and c."fromNumber" = upn."phoneNumber"
    ) call_usage on true
    left join lateral (
      select
        count(*) filter (
          where pda."endedAt" is null
            and pda."status" in ('dialing', 'ringing', 'connected')
        )::int as active_count,
        max(pda."startedAt") as last_used_at
      from "parallel_dial_attempt" pda
      inner join "parallel_dial_session" pds on pds."id" = pda."sessionId"
      where pds."organizationId" = upn."organizationId"
        and pda."fromNumber" = upn."phoneNumber"
    ) parallel_usage on true
    where upn."organizationId" = ${organizationId}
      and upn."userId" = ${userId}
      ${excludeClause}
      and (
        coalesce(call_usage.active_count, 0) +
        coalesce(parallel_usage.active_count, 0)
      ) = 0
    order by
      greatest(
        coalesce(call_usage.last_used_at, '-infinity'::timestamp),
        coalesce(parallel_usage.last_used_at, '-infinity'::timestamp)
      ) asc,
      upn."createdAt" asc,
      upn."phoneNumber" asc
    limit ${limit}
  `.execute(executor)

  return result.rows
}

export const findByPhoneNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  return db
    .selectFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .where('phoneNumber', '=', phoneNumber)
    .selectAll()
    .executeTakeFirst()
}

/** Assignments with the owning rep's name, for the assignment UI. */
export const findByOrganizationWithUser = async (organizationId: string) => {
  return db
    .selectFrom('user_phone_number')
    .innerJoin('user', 'user.id', 'user_phone_number.userId')
    .where('user_phone_number.organizationId', '=', organizationId)
    .select([
      'user_phone_number.id',
      'user_phone_number.organizationId',
      'user_phone_number.userId',
      'user_phone_number.phoneNumber',
      'user_phone_number.friendlyName',
      'user_phone_number.createdAt',
      'user_phone_number.updatedAt',
      'user.name as userName',
      'user.email as userEmail',
    ])
    .orderBy('user_phone_number.createdAt', 'asc')
    .execute()
}

export const deleteByPhoneNumber = async (
  organizationId: string,
  phoneNumber: string,
) => {
  const result = await db
    .deleteFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .where('phoneNumber', '=', phoneNumber)
    .executeTakeFirst()
  return Number(result.numDeletedRows) > 0
}

export const deleteByUser = async (organizationId: string, userId: string) => {
  return db
    .deleteFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .execute()
}

/**
 * Whether this rep may place a call from this number.
 *
 * Kept for legacy callers and defensive checks. New browser dial flows do not
 * send a caller ID; the backend allocates the next assigned number itself.
 */
export const isOwnedByUser = async (
  organizationId: string,
  userId: string,
  phoneNumber: string,
): Promise<boolean> => {
  const assignment = await findByPhoneNumber(organizationId, phoneNumber)
  return assignment?.userId === userId
}

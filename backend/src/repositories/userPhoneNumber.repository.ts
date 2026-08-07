import { db } from '@/lib/db'
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

export const findByUser = async (organizationId: string, userId: string) => {
  return db
    .selectFrom('user_phone_number')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', userId)
    .selectAll()
    .orderBy('createdAt', 'asc')
    .execute()
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
 * `fromNumber` reaches the backend from the browser, so this is the check that
 * actually enforces ownership — the dropdown only hides numbers, it doesn't
 * prevent a crafted request from using someone else's caller ID.
 */
export const isOwnedByUser = async (
  organizationId: string,
  userId: string,
  phoneNumber: string,
): Promise<boolean> => {
  const assignment = await findByPhoneNumber(organizationId, phoneNumber)
  return assignment?.userId === userId
}

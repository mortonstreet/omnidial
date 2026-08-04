import { db } from '@/lib/db'

export const findById = async (id: string) => {
  const user = await db
    .selectFrom('user')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
  return user
}

export const findAccountByUserId = async (userId: string) => {
  const account = await db
    .selectFrom('account')
    .where('account.userId', '=', userId)
    .selectAll()
    .executeTakeFirst()
  return account
}

export const isMemberOfOrganization = async (
  userId: string,
  organizationId: string,
) => {
  const member = await db
    .selectFrom('member')
    .where('userId', '=', userId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()
  return member !== null
}

export const updateUserOnboarding = async (
  userId: string,
  data: {
    name?: string
    onboardingRole: string
    onboardingIndustry: string
    onboardingComplete: boolean
  },
) => {
  return await db
    .updateTable('user')
    .set(data)
    .where('id', '=', userId)
    .executeTakeFirst()
}

export const getOnboardingStatus = async (userId: string) => {
  return await db
    .selectFrom('user')
    .where('id', '=', userId)
    .select(['onboardingComplete'])
    .executeTakeFirst()
}

export const findByIds = async (ids: string[]) => {
  if (ids.length === 0) return []

  const users = await db
    .selectFrom('user')
    .select(['id', 'name', 'email'])
    .where('id', 'in', ids)
    .execute()

  return users
}

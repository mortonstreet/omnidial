import { db } from '@/lib/db'
import { withIdAndTimestamps, withTimestamps } from './utils'

export interface CreateProgressInput {
  userId: string
  campaignId: string
  listId: string
  currentIndex?: number
  totalLeads?: number
  dialedCount?: number
  isPaused?: boolean
}

export interface UpdateProgressInput {
  currentIndex?: number
  totalLeads?: number
  dialedCount?: number
  isPaused?: boolean
}

export const findByUserCampaignList = async (
  userId: string,
  campaignId: string,
  listId: string,
) => {
  return db
    .selectFrom('power_dialer_progress')
    .where('userId', '=', userId)
    .where('campaignId', '=', campaignId)
    .where('listId', '=', listId)
    .selectAll()
    .executeTakeFirst()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('power_dialer_progress')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findActiveByUser = async (userId: string) => {
  return db
    .selectFrom('power_dialer_progress')
    .where('userId', '=', userId)
    .where('isPaused', '=', false)
    .selectAll()
    .execute()
}

export const create = async (data: CreateProgressInput) => {
  const record = withIdAndTimestamps(
    {
      ...data,
      currentIndex: data.currentIndex ?? 0,
      totalLeads: data.totalLeads ?? 0,
      dialedCount: data.dialedCount ?? 0,
      isPaused: data.isPaused ?? false,
    },
    true,
  )

  return db
    .insertInto('power_dialer_progress')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const upsert = async (
  userId: string,
  campaignId: string,
  listId: string,
  data: UpdateProgressInput,
) => {
  const existing = await findByUserCampaignList(userId, campaignId, listId)

  if (existing) {
    return update(existing.id, data)
  }

  return create({
    userId,
    campaignId,
    listId,
    ...data,
  })
}

export const update = async (id: string, data: UpdateProgressInput) => {
  const record = withTimestamps(data)

  return db
    .updateTable('power_dialer_progress')
    .set(record)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const incrementDialedCount = async (id: string) => {
  return db
    .updateTable('power_dialer_progress')
    .set((eb) => ({
      dialedCount: eb('dialedCount', '+', 1),
      updatedAt: new Date(),
    }))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const incrementCurrentIndex = async (id: string) => {
  return db
    .updateTable('power_dialer_progress')
    .set((eb) => ({
      currentIndex: eb('currentIndex', '+', 1),
      updatedAt: new Date(),
    }))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const decrementCurrentIndex = async (id: string) => {
  // Use SQL GREATEST to ensure we don't go below 0
  return db
    .updateTable('power_dialer_progress')
    .set((eb) => ({
      currentIndex: eb('currentIndex', '-', 1),
      updatedAt: new Date(),
    }))
    .where('id', '=', id)
    .where('currentIndex', '>', 0) // Only decrement if > 0
    .returningAll()
    .executeTakeFirst()
}

/**
 * Set current index to a specific value
 * Used for snaking/wrapping navigation (e.g., going from last to first or first to last)
 */
export const setCurrentIndex = async (id: string, newIndex: number) => {
  return db
    .updateTable('power_dialer_progress')
    .set({
      currentIndex: newIndex,
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const deleteById = async (id: string) => {
  return db
    .deleteFrom('power_dialer_progress')
    .where('id', '=', id)
    .executeTakeFirst()
}

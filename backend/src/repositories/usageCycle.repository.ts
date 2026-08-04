import { db } from '@/lib/db'
import { withIdAndTimestamps } from './utils'

export const findCurrentCycle = async (organizationId: string) => {
  return await db
    .selectFrom('usage_cycle')
    .where('organizationId', '=', organizationId)
    .where('isCurrent', '=', true)
    .selectAll()
    .executeTakeFirst()
}

export const getOrCreateCurrentCycle = async (
  organizationId: string,
  subscriptionId: string,
  plan: { includedMinutes: number; overageRateCents: number },
  periodStart?: Date,
  periodEnd?: Date,
) => {
  const existing = await findCurrentCycle(organizationId)
  if (existing) return existing

  const now = new Date()
  const start = periodStart || now
  const end = periodEnd || new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

  return await db
    .insertInto('usage_cycle')
    .values(
      withIdAndTimestamps({
        organizationId,
        subscriptionId,
        periodStart: start,
        periodEnd: end,
        includedMinutes: plan.includedMinutes,
        overageRateCents: plan.overageRateCents,
        usedMinutes: 0,
        overageMinutes: 0,
        overageAmountCents: 0,
        overageReportedToStripe: 0,
        isCurrent: true,
        finalized: false,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const incrementUsage = async (
  cycleId: string,
  minutes: number,
  overageMinutes: number,
  overageAmountCents: number,
) => {
  return await db
    .updateTable('usage_cycle')
    .set((eb) => ({
      usedMinutes: eb('usedMinutes', '+', minutes),
      overageMinutes: eb('overageMinutes', '+', overageMinutes),
      overageAmountCents: eb('overageAmountCents', '+', overageAmountCents),
      updatedAt: new Date(),
    }))
    .where('id', '=', cycleId)
    .returningAll()
    .executeTakeFirst()
}

export const updateOverageReported = async (
  cycleId: string,
  reportedMinutes: number,
) => {
  return await db
    .updateTable('usage_cycle')
    .set({
      overageReportedToStripe: reportedMinutes,
      lastStripeReportAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', cycleId)
    .returningAll()
    .executeTakeFirst()
}

export const closeCycle = async (cycleId: string) => {
  return await db
    .updateTable('usage_cycle')
    .set({
      isCurrent: false,
      finalized: true,
      updatedAt: new Date(),
    })
    .where('id', '=', cycleId)
    .returningAll()
    .executeTakeFirst()
}

export const findHistory = async (organizationId: string, limit = 6) => {
  return await db
    .selectFrom('usage_cycle')
    .where('organizationId', '=', organizationId)
    .orderBy('periodStart', 'desc')
    .limit(limit)
    .selectAll()
    .execute()
}

export const findExpiredCurrentCycles = async () => {
  return await db
    .selectFrom('usage_cycle')
    .where('isCurrent', '=', true)
    .where('finalized', '=', false)
    .where('periodEnd', '<', new Date())
    .selectAll()
    .execute()
}

export const findCyclesWithUnreportedOverage = async () => {
  return await db
    .selectFrom('usage_cycle')
    .where('isCurrent', '=', true)
    .where('finalized', '=', false)
    .whereRef('overageMinutes', '>', 'overageReportedToStripe')
    .selectAll()
    .execute()
}

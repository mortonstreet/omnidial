import { db } from '@/lib/db'
import { validateAndNormalizePhone, getLastNDigits } from '@/lib/phone'
import { withId } from './utils'
import type { DBDncEntry } from '@shared/db/src/types'

type DbExecutor = typeof db

export interface CreateDncEntryInput {
  organizationId: string
  normalizedPhone: string
  leadId?: string | null
  reason?: string | null
  createdById?: string | null
}

/**
 * Suppression is compared on E.164, so formatting differences between an
 * imported CSV and a dialer entry cannot smuggle a blocked number through.
 * Unparseable input returns null and is simply not suppressible.
 */
export const normalizeForDnc = (phone: string): string | null =>
  validateAndNormalizePhone(phone)

export const addMany = async (
  entries: CreateDncEntryInput[],
  executor: DbExecutor = db,
): Promise<number> => {
  if (entries.length === 0) return 0

  const rows = entries.map((entry) =>
    withId({
      organizationId: entry.organizationId,
      normalizedPhone: entry.normalizedPhone,
      leadId: entry.leadId ?? null,
      reason: entry.reason ?? null,
      createdById: entry.createdById ?? null,
      createdAt: new Date(),
    }),
  )

  // Re-marking an already-suppressed number is a no-op, not an error: the
  // original entry keeps its reason and author.
  const inserted = await executor
    .insertInto('dnc_entry')
    .values(rows)
    .onConflict((oc) =>
      oc.columns(['organizationId', 'normalizedPhone']).doNothing(),
    )
    .returning('id')
    .execute()

  return inserted.length
}

export const remove = async (
  organizationId: string,
  normalizedPhone: string,
): Promise<boolean> => {
  const result = await db
    .deleteFrom('dnc_entry')
    .where('organizationId', '=', organizationId)
    .where('normalizedPhone', '=', normalizedPhone)
    .executeTakeFirst()

  return Number(result.numDeletedRows) > 0
}

/**
 * Whether this number is suppressed.
 *
 * Also compares the last ten digits, so an entry stored without a country code
 * still blocks the E.164 form of the same number.
 */
export const isSuppressed = async (
  organizationId: string,
  phone: string,
  executor: DbExecutor = db,
): Promise<boolean> => {
  const normalized = normalizeForDnc(phone)
  const lastTen = getLastNDigits(phone, 10)
  if (!normalized && !lastTen) return false

  const match = await executor
    .selectFrom('dnc_entry')
    .where('organizationId', '=', organizationId)
    .where((eb) => {
      const clauses = []
      if (normalized) clauses.push(eb('normalizedPhone', '=', normalized))
      if (lastTen) {
        clauses.push(
          eb(
            eb.fn<string>('right', ['normalizedPhone', eb.val(10)]),
            '=',
            lastTen,
          ),
        )
      }
      return eb.or(clauses)
    })
    .select('id')
    .executeTakeFirst()

  return !!match
}

/** The suppressed subset of a set of numbers, for filtering a dial queue. */
export const filterSuppressed = async (
  organizationId: string,
  phones: string[],
  executor: DbExecutor = db,
): Promise<Set<string>> => {
  const suppressed = new Set<string>()
  if (phones.length === 0) return suppressed

  const normalizedByInput = new Map<string, string>()
  for (const phone of phones) {
    const normalized = normalizeForDnc(phone)
    if (normalized) normalizedByInput.set(phone, normalized)
  }
  if (normalizedByInput.size === 0) return suppressed

  const rows = await executor
    .selectFrom('dnc_entry')
    .where('organizationId', '=', organizationId)
    .where('normalizedPhone', 'in', [...new Set(normalizedByInput.values())])
    .select('normalizedPhone')
    .execute()

  const blocked = new Set(rows.map((row) => row.normalizedPhone))
  for (const [input, normalized] of normalizedByInput) {
    if (blocked.has(normalized)) suppressed.add(input)
  }

  return suppressed
}

export const findByOrganization = async (
  organizationId: string,
  limit = 500,
): Promise<DBDncEntry[]> =>
  db
    .selectFrom('dnc_entry')
    .where('organizationId', '=', organizationId)
    .selectAll()
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()

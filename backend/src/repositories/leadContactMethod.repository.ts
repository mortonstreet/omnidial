import { db } from '@/lib/db'
import { validateAndNormalizePhone } from '@/lib/phone'
import { withId, withTimestamps } from './utils'
import type { DBLeadContactMethod } from '@shared/db/src/types'

export type ContactMethodKind = 'email' | 'phone'

export interface CreateContactMethodInput {
  organizationId: string
  leadId: string
  kind: ContactMethodKind
  value: string
  label?: string | null
  isPrimary?: boolean
}

type DbExecutor = typeof db

/**
 * The comparable form of a contact value.
 *
 * Phones become E.164 so "(555) 123-4567" and "+15551234567" collide; emails
 * are trimmed and lowercased. Returns null when a phone cannot be parsed, which
 * keeps the row (it is still worth displaying) but leaves it out of matching -
 * the unique index treats nulls as distinct, so junk never blocks a save.
 */
export const normalizeContactValue = (
  kind: ContactMethodKind,
  value: string,
): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return null

  if (kind === 'email') {
    return trimmed.toLowerCase()
  }

  // validateAndNormalizePhone rejects unparseable input, where normalizeToE164
  // would happily return a bare "+" and make every junk value collide.
  return validateAndNormalizePhone(trimmed)
}

export const findByLead = async (
  organizationId: string,
  leadId: string,
  executor: DbExecutor = db,
): Promise<DBLeadContactMethod[]> =>
  executor
    .selectFrom('lead_contact_method')
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .selectAll()
    // Primary first, then oldest, so the UI order is stable.
    .orderBy('isPrimary', 'desc')
    .orderBy('createdAt', 'asc')
    .execute()

/** Contact methods for many leads at once, keyed by leadId. */
export const findByLeadIds = async (
  organizationId: string,
  leadIds: string[],
  executor: DbExecutor = db,
): Promise<Map<string, DBLeadContactMethod[]>> => {
  const byLead = new Map<string, DBLeadContactMethod[]>()
  if (leadIds.length === 0) return byLead

  const rows = await executor
    .selectFrom('lead_contact_method')
    .where('organizationId', '=', organizationId)
    .where('leadId', 'in', leadIds)
    .selectAll()
    .orderBy('isPrimary', 'desc')
    .orderBy('createdAt', 'asc')
    .execute()

  for (const row of rows) {
    const existing = byLead.get(row.leadId)
    if (existing) existing.push(row)
    else byLead.set(row.leadId, [row])
  }

  return byLead
}

export const findById = async (
  organizationId: string,
  id: string,
): Promise<DBLeadContactMethod | undefined> =>
  db
    .selectFrom('lead_contact_method')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()

/** Leads reachable at this value - the dedupe and inbound-routing lookup. */
export const findLeadIdsByValue = async (
  organizationId: string,
  kind: ContactMethodKind,
  value: string,
  executor: DbExecutor = db,
): Promise<string[]> => {
  const normalized = normalizeContactValue(kind, value)
  if (!normalized) return []

  const rows = await executor
    .selectFrom('lead_contact_method')
    .where('organizationId', '=', organizationId)
    .where('kind', '=', kind)
    .where('normalizedValue', '=', normalized)
    .select('leadId')
    .distinct()
    .execute()

  return rows.map((row) => row.leadId)
}

/**
 * Add or refresh a contact method. Re-adding a value the lead already has
 * updates its label rather than failing on the unique index.
 */
export const upsert = async (
  data: CreateContactMethodInput,
  executor: DbExecutor = db,
): Promise<DBLeadContactMethod> => {
  const normalizedValue = normalizeContactValue(data.kind, data.value)

  const row = withId(
    withTimestamps(
      {
        organizationId: data.organizationId,
        leadId: data.leadId,
        kind: data.kind,
        label: data.label ?? null,
        value: data.value.trim(),
        normalizedValue,
        isPrimary: data.isPrimary ?? false,
      },
      true,
    ),
  )

  // A null normalizedValue never conflicts, so unparseable values insert fresh
  // rather than colliding with each other.
  return executor
    .insertInto('lead_contact_method')
    .values(row)
    .onConflict((oc) =>
      oc.columns(['leadId', 'kind', 'normalizedValue']).doUpdateSet({
        value: row.value,
        label: row.label,
        isPrimary: row.isPrimary,
        updatedAt: new Date(),
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (
  organizationId: string,
  id: string,
  data: { value?: string; label?: string | null; isPrimary?: boolean },
  kind?: ContactMethodKind,
): Promise<DBLeadContactMethod | undefined> => {
  const patch: Record<string, unknown> = { updatedAt: new Date() }

  if (data.value !== undefined) {
    patch.value = data.value.trim()
    if (kind) patch.normalizedValue = normalizeContactValue(kind, data.value)
  }
  if (data.label !== undefined) patch.label = data.label
  if (data.isPrimary !== undefined) patch.isPrimary = data.isPrimary

  return db
    .updateTable('lead_contact_method')
    .set(patch)
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

/** Only one method per kind may be primary; clear the others. */
export const clearPrimaryFlag = async (
  organizationId: string,
  leadId: string,
  kind: ContactMethodKind,
  exceptId?: string,
  executor: DbExecutor = db,
): Promise<void> => {
  let query = executor
    .updateTable('lead_contact_method')
    .set({ isPrimary: false, updatedAt: new Date() })
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .where('kind', '=', kind)
    .where('isPrimary', '=', true)

  if (exceptId) query = query.where('id', '!=', exceptId)

  await query.execute()
}

export const deleteById = async (
  organizationId: string,
  id: string,
): Promise<boolean> => {
  const result = await db
    .deleteFrom('lead_contact_method')
    .where('organizationId', '=', organizationId)
    .where('id', '=', id)
    .executeTakeFirst()

  return Number(result.numDeletedRows) > 0
}

/** Move every method from one lead to another - used when merging duplicates. */
export const reassignLead = async (
  organizationId: string,
  fromLeadId: string,
  toLeadId: string,
  executor: DbExecutor = db,
): Promise<void> => {
  const moving = await findByLead(organizationId, fromLeadId, executor)
  if (moving.length === 0) return

  const surviving = await findByLead(organizationId, toLeadId, executor)
  const alreadyThere = new Set(
    surviving.map((row) => `${row.kind}:${row.normalizedValue ?? row.value}`),
  )

  for (const row of moving) {
    const key = `${row.kind}:${row.normalizedValue ?? row.value}`
    if (alreadyThere.has(key)) continue

    await executor
      .updateTable('lead_contact_method')
      .set({
        leadId: toLeadId,
        // The survivor keeps its own primaries.
        isPrimary: false,
        updatedAt: new Date(),
      })
      .where('organizationId', '=', organizationId)
      .where('id', '=', row.id)
      .execute()

    alreadyThere.add(key)
  }

  // Anything left is a duplicate of the survivor's own methods.
  await executor
    .deleteFrom('lead_contact_method')
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', fromLeadId)
    .execute()
}

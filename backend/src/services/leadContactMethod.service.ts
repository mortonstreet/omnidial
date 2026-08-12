import * as contactMethodRepository from '@/repositories/leadContactMethod.repository'
import * as leadRepository from '@/repositories/lead.repository'
import type { DBLeadContactMethod } from '@shared/db/src/types'
import type {
  ContactMethodItem,
  ContactMethodKind,
} from '@shared/types/src/requests/leadContactMethod'

export const toContactMethodItem = (
  row: DBLeadContactMethod,
): ContactMethodItem => ({
  id: row.id,
  leadId: row.leadId,
  kind: row.kind as ContactMethodKind,
  label: row.label,
  value: row.value,
  normalizedValue: row.normalizedValue,
  isPrimary: row.isPrimary,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const assertLeadInOrg = async (organizationId: string, leadId: string) => {
  const lead = await leadRepository.findById(leadId, organizationId)
  if (!lead) throw new Error('Lead not found')
  return lead
}

export const listForLead = async (organizationId: string, leadId: string) => {
  await assertLeadInOrg(organizationId, leadId)
  const rows = await contactMethodRepository.findByLead(organizationId, leadId)
  return rows.map(toContactMethodItem)
}

/**
 * Write a method back onto the lead itself, so the dialer, CRM push and every
 * existing consumer of lead.phone / lead.email see the promotion.
 */
const syncPrimaryToLead = async (
  organizationId: string,
  leadId: string,
  kind: ContactMethodKind,
  value: string,
) => {
  if (kind === 'email') {
    await leadRepository.update(leadId, organizationId, { email: value })
    return
  }

  const normalized = contactMethodRepository.normalizeContactValue(
    'phone',
    value,
  )
  await leadRepository.update(leadId, organizationId, {
    phone: value,
    ...(normalized ? { normalizedPhone: normalized } : {}),
  })
}

export const addContactMethod = async (
  organizationId: string,
  leadId: string,
  input: { kind: ContactMethodKind; value: string; label?: string | null },
) => {
  await assertLeadInOrg(organizationId, leadId)

  const existing = await contactMethodRepository.findByLead(
    organizationId,
    leadId,
  )
  // The first method of its kind becomes the primary, so a lead that had no
  // email at all still ends up with lead.email populated.
  const isFirstOfKind = !existing.some((row) => row.kind === input.kind)

  const created = await contactMethodRepository.upsert({
    organizationId,
    leadId,
    kind: input.kind,
    value: input.value,
    label: input.label ?? null,
    isPrimary: isFirstOfKind,
  })

  if (isFirstOfKind) {
    await syncPrimaryToLead(organizationId, leadId, input.kind, created.value)
  }

  return toContactMethodItem(created)
}

export const updateContactMethod = async (
  organizationId: string,
  id: string,
  input: { value?: string; label?: string | null; isPrimary?: boolean },
) => {
  const existing = await contactMethodRepository.findById(organizationId, id)
  if (!existing) throw new Error('Contact method not found')

  const kind = existing.kind as ContactMethodKind

  // Demoting the only primary would leave the lead with none, so promotion is
  // the only direction offered here; delete or promote another to change it.
  const promoting = input.isPrimary === true && !existing.isPrimary
  if (promoting) {
    await contactMethodRepository.clearPrimaryFlag(
      organizationId,
      existing.leadId,
      kind,
      id,
    )
  }

  const updated = await contactMethodRepository.update(
    organizationId,
    id,
    {
      ...input,
      ...(promoting ? { isPrimary: true } : {}),
      // Ignore an attempt to unset the last primary.
      ...(input.isPrimary === false && existing.isPrimary
        ? { isPrimary: true }
        : {}),
    },
    kind,
  )
  if (!updated) throw new Error('Contact method not found')

  if (updated.isPrimary) {
    await syncPrimaryToLead(organizationId, updated.leadId, kind, updated.value)
  }

  return toContactMethodItem(updated)
}

export const deleteContactMethod = async (
  organizationId: string,
  id: string,
) => {
  const existing = await contactMethodRepository.findById(organizationId, id)
  if (!existing) throw new Error('Contact method not found')

  const deleted = await contactMethodRepository.deleteById(organizationId, id)
  if (!deleted) return { success: false }

  if (!existing.isPrimary) return { success: true }

  // The primary went away: promote the next one of that kind so the lead is
  // still reachable, and clear the lead field when nothing is left.
  const kind = existing.kind as ContactMethodKind
  const remaining = (
    await contactMethodRepository.findByLead(organizationId, existing.leadId)
  ).filter((row) => row.kind === kind)

  if (remaining.length === 0) {
    await leadRepository.update(existing.leadId, existing.organizationId, {
      ...(kind === 'email'
        ? { email: null }
        : { phone: null, normalizedPhone: null }),
    })
    return { success: true }
  }

  const next = remaining[0]
  await contactMethodRepository.update(
    organizationId,
    next.id,
    { isPrimary: true },
    kind,
  )
  await syncPrimaryToLead(organizationId, existing.leadId, kind, next.value)

  return { success: true }
}

/**
 * Keep the contact-method table in step when lead.email / lead.phone are
 * written directly (CSV import, enrichment, inline edit). Without this the
 * table would drift and dedupe would stop seeing the primary.
 */
export const syncPrimariesFromLead = async (
  organizationId: string,
  lead: { id: string; email?: string | null; phone?: string | null },
) => {
  for (const kind of ['email', 'phone'] as const) {
    const value = kind === 'email' ? lead.email : lead.phone
    if (!value || !value.trim()) continue

    await contactMethodRepository.clearPrimaryFlag(
      organizationId,
      lead.id,
      kind,
    )
    await contactMethodRepository.upsert({
      organizationId,
      leadId: lead.id,
      kind,
      value,
      label: 'primary',
      isPrimary: true,
    })
  }
}

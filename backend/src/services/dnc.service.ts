import { db } from '@/lib/db'
import * as dncRepository from '@/repositories/dnc.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as contactMethodRepository from '@/repositories/leadContactMethod.repository'

export interface MarkDncResult {
  leadsMarked: number
  numbersSuppressed: number
  removedFromCampaigns: number
  removedFromLists: number
  skipped: { leadId: string; reason: string }[]
}

/**
 * Mark leads do-not-call and pull them out of anything that would dial them.
 *
 * Every number the lead is reachable on is suppressed, not just the primary -
 * marking someone DNC while leaving their office line dialable would defeat
 * the point.
 */
export const markLeadsDnc = async (
  organizationId: string,
  leadIds: string[],
  options: { reason?: string | null; userId?: string | null } = {},
): Promise<MarkDncResult> => {
  const uniqueLeadIds = [...new Set(leadIds)]
  const result: MarkDncResult = {
    leadsMarked: 0,
    numbersSuppressed: 0,
    removedFromCampaigns: 0,
    removedFromLists: 0,
    skipped: [],
  }
  if (uniqueLeadIds.length === 0) return result

  const leads = await leadRepository.findByIds(uniqueLeadIds, organizationId)
  const foundIds = new Set(leads.map((lead) => lead.id))
  for (const leadId of uniqueLeadIds) {
    if (!foundIds.has(leadId)) {
      result.skipped.push({ leadId, reason: 'Lead not found' })
    }
  }
  if (leads.length === 0) return result

  const methodsByLead = await contactMethodRepository.findByLeadIds(
    organizationId,
    leads.map((lead) => lead.id),
  )

  const entries: dncRepository.CreateDncEntryInput[] = []
  const markableLeadIds: string[] = []

  for (const lead of leads) {
    const candidates = [
      lead.normalizedPhone,
      lead.phone,
      ...(methodsByLead.get(lead.id) ?? [])
        .filter((method) => method.kind === 'phone')
        .map((method) => method.normalizedValue ?? method.value),
    ].filter((value): value is string => !!value)

    const normalized = new Set(
      candidates
        .map((value) => dncRepository.normalizeForDnc(value))
        .filter((value): value is string => !!value),
    )

    if (normalized.size === 0) {
      // Nothing dialable to suppress; removing them from queues would hide the
      // problem rather than fix it.
      result.skipped.push({
        leadId: lead.id,
        reason: 'No valid phone number to suppress',
      })
      continue
    }

    markableLeadIds.push(lead.id)
    for (const normalizedPhone of normalized) {
      entries.push({
        organizationId,
        normalizedPhone,
        leadId: lead.id,
        reason: options.reason ?? null,
        createdById: options.userId ?? null,
      })
    }
  }

  if (markableLeadIds.length === 0) return result

  await db.transaction().execute(async (trx) => {
    result.numbersSuppressed = await dncRepository.addMany(entries, trx)

    const removedCampaignRows = await trx
      .deleteFrom('campaign_lead')
      .where('leadId', 'in', markableLeadIds)
      .executeTakeFirst()
    result.removedFromCampaigns = Number(
      removedCampaignRows.numDeletedRows ?? 0,
    )

    // Lists use a soft remove so the entry can be restored, matching the
    // existing remove-from-list behaviour.
    const removedListRows = await trx
      .updateTable('lead_list_entry')
      .set({ removedAt: new Date() })
      .where('leadId', 'in', markableLeadIds)
      .where('removedAt', 'is', null)
      .executeTakeFirst()
    result.removedFromLists = Number(removedListRows.numUpdatedRows ?? 0)
  })

  result.leadsMarked = markableLeadIds.length
  return result
}

/** Lift a suppression so the number can be dialed again. */
export const unmarkDnc = async (organizationId: string, phone: string) => {
  const normalized = dncRepository.normalizeForDnc(phone)
  if (!normalized) return { success: false }

  const removed = await dncRepository.remove(organizationId, normalized)
  return { success: removed }
}

export const isSuppressed = dncRepository.isSuppressed
export const listEntries = dncRepository.findByOrganization

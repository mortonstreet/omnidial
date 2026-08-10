import * as leadRepo from '@/repositories/lead.repository'
import { db } from '@/lib/db'
import {
  resolveTimezoneOffline,
  type TimezoneSource,
} from '@/lib/timezoneResolver'

export interface ResolveTimezoneParams {
  leadId: string
  organizationId: string
  forceResolve?: boolean
}

export interface ResolveTimezoneResult {
  timezone: string | null
  cached: boolean
  location?: string | null
  /** Which signal produced the answer — useful when auditing a wrong result. */
  source?: TimezoneSource | null
}

/**
 * How long a failed resolution stays cached before we try again.
 *
 * A null timezone must NOT be cached forever. New phone/location data can be
 * imported later, and permanently pinning those leads to "unknown" would
 * silently hollow out the dialer's timezone ordering.
 */
const FAILED_RESOLUTION_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Resolve the timezone for a lead.
 *
 * Offline signals only: area-code tables and static city/state/country maps.
 * This path deliberately performs no LinkedIn, search, or AI calls; dialer pages
 * must not create third-party traffic or fail because an enrichment provider is
 * rate-limited.
 */
export const resolveTimezone = async (
  params: ResolveTimezoneParams,
): Promise<ResolveTimezoneResult> => {
  const { leadId, organizationId, forceResolve = false } = params

  const lead = await leadRepo.findById(leadId, organizationId)
  if (!lead) {
    throw new Error('Lead not found')
  }

  // A successful resolution is cached indefinitely; a failed one only briefly.
  if (lead.timezoneResolvedAt && !forceResolve) {
    const isStaleFailure =
      !lead.timezone &&
      Date.now() - lead.timezoneResolvedAt.getTime() > FAILED_RESOLUTION_TTL_MS

    if (lead.timezone || !isStaleFailure) {
      return {
        timezone: lead.timezone ?? null,
        cached: true,
      }
    }
  }

  const offline = resolveTimezoneOffline({
    customFields: lead.customFields,
    phone: lead.phone,
    normalizedPhone: lead.normalizedPhone,
  })

  const timezone = offline.timezone
  const location = offline.signal
  const source = offline.source

  await db
    .updateTable('lead')
    .set({
      timezone,
      timezoneResolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .execute()

  return {
    timezone,
    cached: false,
    location,
    source: timezone ? source : null,
  }
}

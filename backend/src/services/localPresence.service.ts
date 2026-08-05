import { db } from '@/lib/db'
import { sql } from 'kysely'
import { v4 as uuidv4 } from 'uuid'
import * as telnyxClient from '@/clients/telnyx.client'
import { normalizePhone } from '@/lib/phone'
import type {
  PhonePoolNumberResponse,
  LocalPresencePreviewResponse,
  CallbackRouteResponse,
  AreaCodeCoverageResponse,
  MissingAreaCodesResponse,
} from '@shared/types/src/requests/localPresence'

// === Phone Number Pool Management ===

// Sync phone numbers from the Telnyx account
export const syncPhonePoolFromTwilio = async (
  organizationId: string,
): Promise<{
  added: number
  removed: number
  updated: number
  total: number
}> => {
  const telnyx = await telnyxClient.getClientForOrganization(organizationId)

  // Get all phone numbers from Telnyx
  const telnyxNumbers = await telnyx.listPhoneNumbers()

  let added = 0
  let updated = 0

  for (const number of telnyxNumbers) {
    // Extract area code from phone number (assumes US/Canada format)
    const areaCode = extractAreaCode(number.phone_number)

    const existing = await db
      .selectFrom('phone_number_pool')
      .where('organizationId', '=', organizationId)
      .where('phoneNumber', '=', number.phone_number)
      .selectAll()
      .executeTakeFirst()

    if (existing) {
      // Update existing
      await db
        .updateTable('phone_number_pool')
        .set({
          friendlyName:
            (number.customer_reference as string | null) || number.phone_number,
          twilioSid: number.id,
          capabilities: buildCapabilities({
            voice: true,
            sms: !!number.messaging_profile_id,
            mms: !!number.messaging_profile_id,
          }),
          updatedAt: new Date(),
        })
        .where('id', '=', existing.id)
        .execute()
      updated++
    } else {
      // Add new
      await db
        .insertInto('phone_number_pool')
        .values({
          id: uuidv4(),
          organizationId,
          phoneNumber: number.phone_number,
          friendlyName:
            (number.customer_reference as string | null) || number.phone_number,
          areaCode: areaCode || '000',
          region: null,
          country: 'US',
          twilioSid: number.id,
          capabilities: buildCapabilities({
            voice: true,
            sms: !!number.messaging_profile_id,
            mms: !!number.messaging_profile_id,
          }),
          isActive: true,
          callsToday: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .execute()
      added++
    }
  }

  // Mark numbers that no longer exist in Telnyx as inactive
  const telnyxPhoneNumbers = new Set(telnyxNumbers.map((n) => n.phone_number))
  const existingNumbers = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .select(['id', 'phoneNumber'])
    .execute()

  let removed = 0
  for (const existing of existingNumbers) {
    if (!telnyxPhoneNumbers.has(existing.phoneNumber)) {
      await db
        .updateTable('phone_number_pool')
        .set({ isActive: false, updatedAt: new Date() })
        .where('id', '=', existing.id)
        .execute()
      removed++
    }
  }

  const total = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  return {
    added,
    removed,
    updated,
    total: Number(total.count),
  }
}

// List phone pool numbers
export const listPhonePool = async (
  organizationId: string,
  filters: {
    areaCode?: string
    isActive?: boolean
  },
  pagination: { page: number; limit: number },
) => {
  let query = db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)

  if (filters.areaCode) {
    query = query.where('areaCode', '=', filters.areaCode)
  }
  if (filters.isActive !== undefined) {
    query = query.where('isActive', '=', filters.isActive)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const numbers = await query
    .selectAll()
    .orderBy('areaCode', 'asc')
    .orderBy('phoneNumber', 'asc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  return {
    data: numbers.map(transformPoolNumber),
    total: Number(countResult.count),
    page: pagination.page,
    limit: pagination.limit,
  }
}

// Update a pool number
export const updatePoolNumber = async (
  id: string,
  data: {
    friendlyName?: string
    isActive?: boolean
  },
): Promise<PhonePoolNumberResponse> => {
  const updated = await db
    .updateTable('phone_number_pool')
    .set({
      ...(data.friendlyName !== undefined && {
        friendlyName: data.friendlyName,
      }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      updatedAt: new Date(),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformPoolNumber(updated)
}

// === Local Presence Dialing ===

// Select the best caller ID for a lead based on area code matching
export const selectLocalPresenceNumber = async (
  organizationId: string,
  leadPhone: string,
): Promise<LocalPresencePreviewResponse> => {
  const normalizedPhone = normalizePhone(leadPhone) || leadPhone
  const leadAreaCode = extractAreaCode(normalizedPhone)

  const result: LocalPresencePreviewResponse = {
    leadPhone: normalizedPhone,
    leadAreaCode,
    selectedPoolNumber: null,
    matchType: 'none',
    fallbackReason: null,
  }

  if (!leadAreaCode) {
    result.fallbackReason = 'Could not determine lead area code'
    return result
  }

  // Try exact area code match first
  let matchedNumber = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .where('areaCode', '=', leadAreaCode)
    .selectAll()
    .orderBy('callsToday', 'asc') // Use least-used number for rotation
    .executeTakeFirst()

  if (matchedNumber) {
    result.selectedPoolNumber = transformPoolNumber(matchedNumber)
    result.matchType = 'exact'
    return result
  }

  // Try same region match (first digit of area code indicates region)
  const regionPrefix = leadAreaCode[0]
  matchedNumber = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .where('areaCode', 'like', `${regionPrefix}%`)
    .selectAll()
    .orderBy('callsToday', 'asc')
    .executeTakeFirst()

  if (matchedNumber) {
    result.selectedPoolNumber = transformPoolNumber(matchedNumber)
    result.matchType = 'region'
    return result
  }

  // Fall back to any active number
  matchedNumber = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .selectAll()
    .orderBy('callsToday', 'asc')
    .executeTakeFirst()

  if (matchedNumber) {
    result.selectedPoolNumber = transformPoolNumber(matchedNumber)
    result.matchType = 'fallback'
    result.fallbackReason = 'No matching area code in pool'
    return result
  }

  result.fallbackReason = 'No phone numbers in pool'
  return result
}

// Record a call from a pool number (for usage tracking and callback routing)
export const recordPoolNumberUsage = async (
  organizationId: string,
  poolNumberId: string,
  leadPhone: string,
  repUserId: string,
) => {
  // Increment calls today counter
  await db
    .updateTable('phone_number_pool')
    .set({
      callsToday: sql`"callsToday" + 1`,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', poolNumberId)
    .execute()

  // Create/update callback route (24 hour expiry)
  const normalizedLeadPhone = normalizePhone(leadPhone) || leadPhone
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

  await db
    .insertInto('callback_route')
    .values({
      id: uuidv4(),
      organizationId,
      poolNumberId,
      leadPhone: normalizedLeadPhone,
      repUserId,
      lastCallAt: new Date(),
      expiresAt,
      createdAt: new Date(),
    })
    .onConflict((oc) =>
      oc.columns(['poolNumberId', 'leadPhone']).doUpdateSet({
        repUserId,
        lastCallAt: new Date(),
        expiresAt,
      }),
    )
    .execute()
}

// Get callback route for inbound call routing
export const getCallbackRoute = async (
  organizationId: string,
  poolPhoneNumber: string,
  callerPhone: string,
): Promise<CallbackRouteResponse | null> => {
  const normalizedCallerPhone = normalizePhone(callerPhone) || callerPhone

  const route = await db
    .selectFrom('callback_route as cr')
    .innerJoin('phone_number_pool as pnp', 'pnp.id', 'cr.poolNumberId')
    .leftJoin('user as u', 'u.id', 'cr.repUserId')
    .where('cr.organizationId', '=', organizationId)
    .where('pnp.phoneNumber', '=', poolPhoneNumber)
    .where('cr.leadPhone', '=', normalizedCallerPhone)
    .where('cr.expiresAt', '>', new Date())
    .select([
      'cr.id',
      'cr.organizationId',
      'cr.poolNumberId',
      'pnp.phoneNumber as poolPhoneNumber',
      'cr.leadPhone',
      'cr.repUserId',
      'u.name as repName',
      'cr.lastCallAt',
      'cr.expiresAt',
      'cr.createdAt',
    ])
    .executeTakeFirst()

  if (!route) {
    return null
  }

  return {
    id: route.id,
    organizationId: route.organizationId,
    poolNumberId: route.poolNumberId,
    poolPhoneNumber: route.poolPhoneNumber,
    leadPhone: route.leadPhone,
    repUserId: route.repUserId,
    repName: route.repName,
    lastCallAt: route.lastCallAt.toISOString(),
    expiresAt: route.expiresAt.toISOString(),
    createdAt: route.createdAt.toISOString(),
  }
}

// Clear expired callback routes
export const clearExpiredRoutes = async (
  organizationId: string,
): Promise<number> => {
  const result = await db
    .deleteFrom('callback_route')
    .where('organizationId', '=', organizationId)
    .where('expiresAt', '<', new Date())
    .executeTakeFirst()

  return Number(result.numDeletedRows)
}

// Reset daily call counters (call via cron job)
export const resetDailyCallCounters = async () => {
  await db.updateTable('phone_number_pool').set({ callsToday: 0 }).execute()
}

// === Area Code Coverage Analysis ===

export const getAreaCodeCoverage = async (
  organizationId: string,
): Promise<AreaCodeCoverageResponse> => {
  const coverage = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .groupBy(['areaCode', 'region'])
    .select([
      'areaCode',
      'region',
      sql<number>`COUNT(*)::int`.as('numberCount'),
      sql<number>`COUNT(*) FILTER (WHERE "isActive" = true)::int`.as(
        'activeNumberCount',
      ),
    ])
    .orderBy('areaCode', 'asc')
    .execute()

  const totals = await db
    .selectFrom('phone_number_pool')
    .where('organizationId', '=', organizationId)
    .select([
      sql<number>`COUNT(DISTINCT "areaCode")::int`.as('totalAreaCodes'),
      sql<number>`COUNT(*)::int`.as('totalNumbers'),
      sql<number>`COUNT(*) FILTER (WHERE "isActive" = true)::int`.as(
        'activeNumbers',
      ),
    ])
    .executeTakeFirstOrThrow()

  return {
    organizationId,
    coverage: coverage.map((c) => ({
      areaCode: c.areaCode,
      region: c.region,
      state: null, // Could map area codes to states
      numberCount: c.numberCount,
      activeNumberCount: c.activeNumberCount,
    })),
    totalAreaCodes: totals.totalAreaCodes,
    totalNumbers: totals.totalNumbers,
    activeNumbers: totals.activeNumbers,
  }
}

export const getMissingAreaCodes = async (
  organizationId: string,
  listId?: string,
): Promise<MissingAreaCodesResponse> => {
  // Get unique area codes from leads
  let leadQuery = db
    .selectFrom('lead')
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)

  if (listId) {
    leadQuery = leadQuery
      .innerJoin('lead_list_entry as lle', 'lle.leadId', 'lead.id')
      .where('lle.listId', '=', listId)
      .where('lle.removedAt', 'is', null) as any
  }

  const leadAreaCodes = await (leadQuery as any)
    .select([
      sql`SUBSTRING(regexp_replace(phone, '[^0-9]', '', 'g') FROM 2 FOR 3)`.as(
        'areaCode',
      ),
      sql<number>`COUNT(*)::int`.as('leadCount'),
    ])
    .groupBy(
      sql`SUBSTRING(regexp_replace(phone, '[^0-9]', '', 'g') FROM 2 FOR 3)`,
    )
    .execute()

  // Get area codes we have in the pool
  const poolAreaCodes = new Set(
    (
      await db
        .selectFrom('phone_number_pool')
        .where('organizationId', '=', organizationId)
        .where('isActive', '=', true)
        .select('areaCode')
        .execute()
    ).map((p) => p.areaCode),
  )

  // Find missing area codes
  const missingAreaCodes: Array<{
    areaCode: string
    region: string | null
    leadCount: number
  }> = []

  let totalMissingLeads = 0
  let totalLeads = 0

  for (const lac of leadAreaCodes) {
    totalLeads += lac.leadCount
    if (lac.areaCode && !poolAreaCodes.has(lac.areaCode)) {
      missingAreaCodes.push({
        areaCode: lac.areaCode,
        region: null,
        leadCount: lac.leadCount,
      })
      totalMissingLeads += lac.leadCount
    }
  }

  // Sort by lead count descending
  missingAreaCodes.sort((a, b) => b.leadCount - a.leadCount)

  const coveragePercentage =
    totalLeads > 0 ? ((totalLeads - totalMissingLeads) / totalLeads) * 100 : 100

  return {
    organizationId,
    listId: listId || null,
    missingAreaCodes,
    totalMissingLeads,
    coveragePercentage,
  }
}

// Helper functions
function extractAreaCode(phoneNumber: string): string | null {
  // Remove all non-digits
  const digits = phoneNumber.replace(/\D/g, '')

  // Handle US/Canada numbers
  if (digits.length === 10) {
    return digits.substring(0, 3)
  }
  if (digits.length === 11 && digits[0] === '1') {
    return digits.substring(1, 4)
  }

  return null
}

function buildCapabilities(caps: any): string[] {
  const result: string[] = []
  if (caps?.voice) result.push('voice')
  if (caps?.sms) result.push('sms')
  if (caps?.mms) result.push('mms')
  return result
}

function transformPoolNumber(number: any): PhonePoolNumberResponse {
  return {
    id: number.id,
    organizationId: number.organizationId,
    phoneNumber: number.phoneNumber,
    friendlyName: number.friendlyName,
    areaCode: number.areaCode,
    region: number.region,
    country: number.country,
    twilioSid: number.twilioSid,
    capabilities: number.capabilities,
    cnamStatus: number.cnamStatus as any,
    cnamName: number.cnamName,
    isActive: number.isActive,
    lastUsedAt: number.lastUsedAt?.toISOString() || null,
    callsToday: number.callsToday,
    createdAt: number.createdAt.toISOString(),
    updatedAt: number.updatedAt.toISOString(),
  }
}

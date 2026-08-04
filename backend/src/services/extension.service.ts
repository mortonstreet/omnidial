import { db } from '@/lib/db'
import * as leadService from './lead.service'
import * as enrichmentService from './enrichment.service'
import * as crmService from './crm.service'
import * as leadListService from './leadList.service'
import * as prospeoClient from '@/clients/prospeo.client'
import * as leadmagicClient from '@/clients/leadmagic.client'
import * as foragerClient from '@/clients/forager.client'
import { decrypt } from '@/lib/encryption'
import * as enrichmentCacheRepo from '@/repositories/enrichmentCache.repository'
import * as leadListEntryRepo from '@/repositories/leadListEntry.repository'
import { buildLinkedInLookupKey } from '@/lib/enrichmentCache'
import {
  addExtensionBulkEnrichJob,
  extensionBulkEnrichQueue,
} from '@/queues/extension-bulk-enrich.queue'
import { ExtensionBulkEnrichEventType } from '@/types/queues'
import { BadRequestError, ForbiddenError, NotFoundError } from '@/lib/errors'
import logger from '@/lib/logger'
import { randomUUID } from 'crypto'
import type { CrmProvider } from '@shared/types/src/requests/crmSync'
import type {
  CheckLeadResponse,
  CreateListFromLinkedInSelectionRequest,
  CreateListFromLinkedInSelectionResponse,
  ExtensionBulkCrmPushResponse,
  ExtensionBulkEnrichJobStatusResponse,
  QuickContextResponse,
  ExtensionEnrichResponse,
  GetLeadsResponse,
  EnrichedPhoneNumber,
} from '@shared/types/src/requests/extension'

const EXTENSION_FLOW_EVENT = {
  CREATE_LIST_STARTED: 'extension.selection_list.create.started',
  CREATE_LIST_COMPLETED: 'extension.selection_list.create.completed',
  BULK_ENRICH_ENQUEUED: 'extension.bulk_enrich.job.enqueued',
  BULK_ENRICH_STATUS_READ: 'extension.bulk_enrich.job.status.read',
  CRM_BULK_PUSH_STARTED: 'extension.crm_bulk_push.started',
  CRM_BULK_PUSH_LEAD_FAILED: 'extension.crm_bulk_push.lead.failed',
  CRM_BULK_PUSH_COMPLETED: 'extension.crm_bulk_push.completed',
} as const

/**
 * Normalize LinkedIn URL to just the username (lowercase) for matching
 */
function normalizeLinkedInUrl(url: string): string {
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  const extractProfileSlug = (value: string): string | null => {
    const decoded = decodeSafe(value)
    const match = decoded.match(/linkedin\.com\/in\/([^/?#]+)/i)
    return match?.[1]?.toLowerCase() ?? null
  }

  const directSlug = extractProfileSlug(url)
  if (directSlug) return directSlug

  try {
    const parsed = new URL(url)
    for (const queryValue of parsed.searchParams.values()) {
      const slugFromQuery = extractProfileSlug(queryValue)
      if (slugFromQuery) return slugFromQuery
    }

    const salesLeadMatch = parsed.pathname.match(/\/sales\/lead\/([^/?#,]+)/i)
    if (salesLeadMatch?.[1]) {
      return `sales/lead/${salesLeadMatch[1].toLowerCase()}`
    }

    const salesPeopleMatch = parsed.pathname.match(
      /\/sales\/people\/([^/?#,]+)/i,
    )
    if (salesPeopleMatch?.[1]) {
      return `sales/people/${salesPeopleMatch[1].toLowerCase()}`
    }
  } catch {
    // Fallback below
  }

  return decodeSafe(url).toLowerCase()
}

/**
 * Canonicalize LinkedIn URL to a consistent full URL format for storage
 */
function canonicalizeLinkedInUrl(url: string): string {
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  const extractCanonicalProfile = (value: string): string | null => {
    const decoded = decodeSafe(value)
    const match = decoded.match(/linkedin\.com\/in\/([^/?#]+)/i)
    if (match?.[1]) {
      return `https://www.linkedin.com/in/${match[1].toLowerCase()}`
    }
    return null
  }

  const directProfile = extractCanonicalProfile(url)
  if (directProfile) {
    return directProfile
  }

  try {
    const parsed = new URL(url)
    for (const queryValue of parsed.searchParams.values()) {
      const queryProfile = extractCanonicalProfile(queryValue)
      if (queryProfile) return queryProfile
    }

    const salesLeadMatch = parsed.pathname.match(/\/sales\/lead\/([^/?#,]+)/i)
    if (salesLeadMatch?.[1]) {
      return `https://www.linkedin.com/sales/lead/${salesLeadMatch[1].toLowerCase()}`
    }

    const salesPeopleMatch = parsed.pathname.match(
      /\/sales\/people\/([^/?#,]+)/i,
    )
    if (salesPeopleMatch?.[1]) {
      return `https://www.linkedin.com/sales/people/${salesPeopleMatch[1].toLowerCase()}`
    }

    if (parsed.hostname.toLowerCase().includes('linkedin.com')) {
      return `https://www.linkedin.com${parsed.pathname}`.replace(/\/$/, '')
    }
  } catch {
    // Fallback below
  }

  return decodeSafe(url)
}

/**
 * Check if a lead exists by LinkedIn URL
 */
export const checkLeadByLinkedIn = async (
  organizationId: string,
  linkedInUrl: string,
): Promise<CheckLeadResponse> => {
  const canonicalUrl = canonicalizeLinkedInUrl(linkedInUrl)
  const normalizedUrl = normalizeLinkedInUrl(linkedInUrl)
  const hasProfileSlug = !normalizedUrl.includes('/')

  // Search for lead by LinkedIn URL (case-insensitive, partial match on username)
  const lead = await db
    .selectFrom('lead')
    .leftJoin('campaign_lead', 'campaign_lead.leadId', 'lead.id')
    .leftJoin('campaign', 'campaign.id', 'campaign_lead.campaignId')
    .leftJoin('client', 'client.id', 'lead.clientId')
    .where('lead.organizationId', '=', organizationId)
    .where('lead.deletedAt', 'is', null)
    .where((eb) =>
      eb.or([
        // Exact match on canonical URL (case-insensitive)
        eb('lead.linkedInUrl', 'ilike', canonicalUrl),
        // Alias match for profile URLs
        ...(hasProfileSlug
          ? [eb('lead.linkedInUrl', 'ilike', `%/in/${normalizedUrl}%`)]
          : []),
        // Alias match for Sales Navigator identities
        eb('lead.linkedInUrl', 'ilike', `%${normalizedUrl}%`),
      ]),
    )
    .select([
      'lead.id',
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'lead.phone',
      'lead.linkedInUrl',
      'campaign.id as campaignId',
      'campaign.name as campaignName',
      'client.id as clientId',
      'client.name as clientName',
    ])
    .executeTakeFirst()

  if (lead) {
    // Fetch all phone numbers from lead_contact_info
    const contactPhones = await db
      .selectFrom('lead_contact_info')
      .where('leadId', '=', lead.id)
      .where('type', 'in', ['mobile', 'direct_dial', 'office'])
      .select(['id', 'value', 'type', 'source', 'isPrimary'])
      .orderBy('isPrimary', 'desc')
      .orderBy('createdAt', 'asc')
      .execute()

    return {
      exists: true,
      lead: {
        id: lead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company,
        phone: lead.phone,
        linkedInUrl: lead.linkedInUrl,
        phoneNumbers: contactPhones.map((p) => ({
          id: p.id,
          value: p.value,
          type: p.type,
          source: p.source,
          isPrimary: p.isPrimary,
        })),
        campaign: lead.campaignId
          ? { id: lead.campaignId, name: lead.campaignName! }
          : undefined,
        client: lead.clientId
          ? { id: lead.clientId, name: lead.clientName! }
          : undefined,
      },
      matchedBy: 'linkedInUrl',
    }
  }

  return { exists: false, matchedBy: null }
}

/**
 * Get quick context for extension (clients, campaigns, phone numbers)
 */
export const getQuickContext = async (
  organizationId: string,
): Promise<QuickContextResponse> => {
  // Get clients
  const clients = await db
    .selectFrom('client')
    .where('organizationId', '=', organizationId)
    .select(['id', 'name', 'color'])
    .orderBy('name', 'asc')
    .execute()

  // Get campaigns with lead counts
  const campaigns = await db
    .selectFrom('campaign')
    .leftJoin('campaign_lead', 'campaign_lead.campaignId', 'campaign.id')
    .where('campaign.organizationId', '=', organizationId)
    .groupBy(['campaign.id', 'campaign.name', 'campaign.clientId'])
    .select([
      'campaign.id',
      'campaign.name',
      'campaign.clientId',
      db.fn.count('campaign_lead.id').as('leadCount'),
    ])
    .orderBy('campaign.name', 'asc')
    .execute()

  // Get assigned phone numbers
  const phoneNumbers = await db
    .selectFrom('client_phone_number')
    .where('organizationId', '=', organizationId)
    .select(['id', 'phoneNumber as number', 'clientId'])
    .execute()

  return {
    clients: clients.map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
    })),
    campaigns: campaigns
      .filter((c) => c.clientId !== null)
      .map((c) => ({
        id: c.id,
        name: c.name,
        clientId: c.clientId!,
        leadCount: Number(c.leadCount),
      })),
    phoneNumbers: phoneNumbers.map((p) => ({
      id: p.id,
      number: p.number,
      clientId: p.clientId,
    })),
  }
}

/**
 * Create lead from LinkedIn profile and enrich
 *
 * FLOW:
 * 1. If profile data is incomplete (no name), call enrichment vendor first to get everything
 * 2. Create lead with complete data (from DOM or vendor)
 * 3. If we already have name but no phone, enrich after creation
 */
export const enrichFromLinkedIn = async (
  organizationId: string,
  userId: string,
  params: {
    linkedInUrl: string
    firstName?: string
    lastName?: string
    company?: string
    headline?: string
    location?: string
  },
): Promise<ExtensionEnrichResponse> => {
  console.log('[Extension] enrichFromLinkedIn called with:', {
    organizationId,
    linkedInUrl: params.linkedInUrl,
    firstName: params.firstName,
    lastName: params.lastName,
    company: params.company,
  })

  // Validate LinkedIn URL
  if (!params.linkedInUrl || !params.linkedInUrl.includes('linkedin.com')) {
    console.error('[Extension] Invalid LinkedIn URL:', params.linkedInUrl)
    return {
      leadId: null,
      phone: null,
      email: null,
      phoneNumbers: [],
      enrichedBy: [],
      success: false,
      errorMessage:
        'Invalid or missing LinkedIn URL. Please refresh the LinkedIn page.',
    }
  }

  // First check if lead already exists
  const existing = await checkLeadByLinkedIn(organizationId, params.linkedInUrl)
  if (existing.exists && existing.lead) {
    // Lead exists - try to enrich if no phone
    if (!existing.lead.phone) {
      console.log(
        '[Extension] Existing lead has no phone, attempting enrichment:',
        {
          leadId: existing.lead.id,
          linkedInUrl: params.linkedInUrl,
        },
      )

      try {
        const enrichResult = await enrichmentService.enrichLeadFromLinkedIn(
          organizationId,
          existing.lead.id,
          params.linkedInUrl,
        )

        console.log(
          '[Extension] Enrichment result for existing lead:',
          enrichResult,
        )

        const updatedLead = await db
          .selectFrom('lead')
          .where('id', '=', existing.lead.id)
          .select(['phone', 'email'])
          .executeTakeFirst()

        return {
          leadId: existing.lead.id,
          phone: updatedLead?.phone ?? null,
          email: updatedLead?.email ?? null,
          phoneNumbers: enrichResult.phoneNumbers ?? [],
          enrichedBy: enrichResult.providersUsed.map(String),
          success: enrichResult.success,
          errorMessage: enrichResult.errorMessage ?? undefined,
        }
      } catch (error) {
        console.error('[Extension] Enrichment error for existing lead:', error)
        return {
          leadId: existing.lead.id,
          phone: null,
          email: null,
          phoneNumbers: [],
          enrichedBy: [],
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Enrichment failed',
        }
      }
    }

    // Lead already has phone
    return {
      leadId: existing.lead.id,
      phone: existing.lead.phone,
      email: null,
      phoneNumbers:
        existing.lead.phoneNumbers?.map((p) => ({
          value: p.value,
          type: p.type as 'mobile' | 'direct_dial' | 'office',
          source: p.source ?? 'unknown',
          isPrimary: p.isPrimary,
        })) ?? [],
      enrichedBy: [],
      success: true,
    }
  }

  // Check if profile data is incomplete (missing name or company)
  const hasCompleteProfile = !!(
    params.firstName &&
    params.lastName &&
    params.company
  )

  let profileData = {
    firstName: params.firstName,
    lastName: params.lastName,
    company: params.company,
    title: params.headline,
    phone: '',
    email: '',
  }
  let enrichedBy: string[] = []
  let enrichmentPhoneNumbers: EnrichedPhoneNumber[] = []
  let enrichmentError: string | undefined

  // If profile data is incomplete, call enrichment vendor to get everything
  if (!hasCompleteProfile) {
    console.log(
      '[Extension] Profile incomplete (missing name or company), calling vendor enrichment first',
      {
        firstName: params.firstName,
        lastName: params.lastName,
        company: params.company,
      },
    )

    const vendorResult = await getVendorProfileData(
      organizationId,
      params.linkedInUrl,
    )

    if (vendorResult.success && vendorResult.data) {
      // Use vendor data, preferring it over incomplete DOM data
      profileData = {
        firstName: vendorResult.data.firstName || params.firstName || '',
        lastName: vendorResult.data.lastName || params.lastName || '',
        company: vendorResult.data.company || params.company || '',
        title: vendorResult.data.title || params.headline || '',
        phone: vendorResult.data.phone || '',
        email: vendorResult.data.email || '',
      }
      enrichedBy = vendorResult.providers
      enrichmentPhoneNumbers = vendorResult.data.phoneNumbers ?? []
    } else {
      // Store error but continue - we'll still try to create lead with DOM data
      enrichmentError = vendorResult.errorMessage
      console.log('[Extension] Vendor enrichment failed:', enrichmentError)
    }
  }

  // VALIDATION GATE: Require at least one identifying field OR a valid LinkedIn URL
  const hasIdentifyingInfo = !!(
    profileData.firstName ||
    profileData.lastName ||
    profileData.company
  )

  // Even if we have no profile data, we should still create a lead with just the LinkedIn URL
  // so the user can manually add info later or retry enrichment
  if (!hasIdentifyingInfo) {
    console.log(
      '[Extension] No identifying info from DOM or vendor, creating lead with LinkedIn URL only',
    )

    // Create a minimal lead with just the LinkedIn URL
    const lead = await leadService.create({
      organizationId,
      userId,
      firstName: '',
      lastName: '',
      company: '',
      linkedInUrl: canonicalizeLinkedInUrl(params.linkedInUrl),
      phone: '',
      title: '',
      email: '',
    })

    return {
      leadId: lead.id,
      phone: null,
      email: null,
      phoneNumbers: [],
      enrichedBy: [],
      success: true, // Lead was created, even though enrichment failed
      errorMessage:
        enrichmentError ||
        'Lead created but could not extract profile data. Try refreshing the LinkedIn page or check your API keys in Settings > Data Vendors.',
    }
  }

  // Create new lead with complete data
  const lead = await leadService.create({
    organizationId,
    userId,
    firstName: profileData.firstName,
    lastName: profileData.lastName,
    company: profileData.company,
    linkedInUrl: canonicalizeLinkedInUrl(params.linkedInUrl),
    phone: profileData.phone,
    title: profileData.title,
    email: profileData.email,
  })

  // If we already got data from vendor enrichment, we're done
  if (enrichedBy.length > 0 && profileData.phone) {
    // Fire-and-forget auto CRM sync
    crmService
      .autoSyncAfterEnrichment(organizationId, lead.id)
      .catch((err) => console.error('[Extension] Auto CRM sync failed:', err))

    return {
      leadId: lead.id,
      phone: profileData.phone,
      email: profileData.email || null,
      phoneNumbers: enrichmentPhoneNumbers,
      firstName: profileData.firstName || null,
      lastName: profileData.lastName || null,
      company: profileData.company || null,
      title: profileData.title || null,
      enrichedBy,
      success: true,
    }
  }

  // If we had complete profile from DOM but no phone, try enrichment
  if (hasCompleteProfile && !profileData.phone) {
    console.log(
      '[Extension] Profile complete but no phone, attempting enrichment',
      { leadId: lead.id, linkedInUrl: params.linkedInUrl },
    )

    try {
      const enrichResult = await enrichmentService.enrichLeadFromLinkedIn(
        organizationId,
        lead.id,
        params.linkedInUrl,
      )

      const updatedLead = await db
        .selectFrom('lead')
        .where('id', '=', lead.id)
        .select(['phone', 'email'])
        .executeTakeFirst()

      // Build helpful error message if no phone found
      let errorMsg = enrichResult.errorMessage
      if (!updatedLead?.phone && !errorMsg) {
        if (enrichResult.providersUsed.length === 0) {
          errorMsg =
            'No data vendors configured. Go to Settings > Data Vendors to add Prospeo, Forager, or LeadMagic.'
        } else {
          errorMsg = `No phone found for this profile. Tried: ${enrichResult.providersUsed.join(', ')}`
        }
      }

      return {
        leadId: lead.id,
        phone: updatedLead?.phone ?? null,
        email: updatedLead?.email ?? null,
        phoneNumbers: enrichResult.phoneNumbers ?? [],
        enrichedBy: enrichResult.providersUsed.map(String),
        success: enrichResult.success || !!updatedLead?.phone,
        errorMessage: errorMsg ?? undefined,
      }
    } catch (error) {
      console.error('[Extension] Enrichment error:', error)
      return {
        leadId: lead.id,
        phone: null,
        email: null,
        phoneNumbers: [],
        enrichedBy: [],
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Enrichment failed',
      }
    }
  }

  // Return what we have with detailed error messages
  const hasName = !!(profileData.firstName || profileData.lastName)
  let errorMessage: string | undefined

  // Only show error if we don't have a phone AND there was an enrichment error
  if (!profileData.phone) {
    if (enrichmentError) {
      // Prospeo/Forager failed - show that error
      errorMessage = enrichmentError
    } else if (!hasName) {
      // No name and no phone - minimal lead created
      errorMessage =
        'Lead created but could not extract profile data. You can add details manually.'
    } else {
      // Has name but no phone - normal case, enrichment just didn't find a number
      errorMessage = 'Lead created. No phone number found for this profile.'
    }
  }

  console.log('[Extension] Enrichment complete:', {
    leadId: lead.id,
    hasName,
    hasPhone: !!profileData.phone,
    enrichedBy,
    errorMessage,
  })

  return {
    leadId: lead.id,
    phone: profileData.phone || null,
    email: profileData.email || null,
    phoneNumbers: enrichmentPhoneNumbers,
    firstName: profileData.firstName || null,
    lastName: profileData.lastName || null,
    company: profileData.company || null,
    title: profileData.title || null,
    enrichedBy,
    success: true, // Lead was created successfully, even if enrichment didn't find a phone
    errorMessage,
  }
}

interface VendorProfileResult {
  success: boolean
  providers: string[]
  data?: {
    firstName?: string
    lastName?: string
    company?: string
    title?: string
    phone?: string
    email?: string
    phoneNumbers?: EnrichedPhoneNumber[]
  }
  errorMessage?: string
}

/**
 * Get profile data from ALL available vendors in parallel using LinkedIn URL.
 * Merges profile data from highest-priority vendor, collects all phones.
 */
async function getVendorProfileData(
  organizationId: string,
  linkedInUrl: string,
): Promise<VendorProfileResult> {
  console.log('[Extension] getVendorProfileData called:', {
    organizationId,
    linkedInUrl,
  })

  // Get all active enrichment vendor connections, ordered by priority
  const connections = await db
    .selectFrom('data_vendor_connection')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .where('provider', 'in', ['prospeo', 'forager', 'leadmagic'])
    .selectAll()
    .orderBy('priority', 'asc')
    .execute()

  console.log(
    '[Extension] Found vendor connections:',
    connections.map((c) => ({
      provider: c.provider,
      isActive: c.isActive,
      creditsUsed: c.creditsUsed,
      creditsLimit: c.creditsLimit,
    })),
  )

  if (connections.length === 0) {
    console.log(
      '[Extension] No enrichment vendors configured for organization:',
      organizationId,
    )
    return {
      success: false,
      providers: [],
      errorMessage:
        'No enrichment vendors configured. Go to Settings > Data Vendors to add your API key.',
    }
  }

  // Filter out connections that have exceeded credit limits
  const viableConnections = connections.filter((c) => {
    if (c.creditsLimit && c.creditsUsed >= c.creditsLimit) {
      console.log(`[Extension] ${c.provider} credits exhausted, skipping`)
      return false
    }
    return true
  })

  if (viableConnections.length === 0) {
    return {
      success: false,
      providers: [],
      errorMessage: 'All vendors have reached their credit limits.',
    }
  }

  // === Cache check: split connections into cached and uncached ===
  const lookupKey = buildLinkedInLookupKey(linkedInUrl)
  const cachedEntries =
    await enrichmentCacheRepo.findValidByLookupKey(lookupKey)
  const cachedByProvider = new Map(cachedEntries.map((e) => [e.provider, e]))

  type VendorProfileEntry = {
    provider: string
    priority: number
    enabledTypes: string[]
    data: {
      firstName?: string
      lastName?: string
      company?: string
      title?: string
      phone?: string
      email?: string
      phoneNumbers?: string[]
    }
  }

  const cachedResults: VendorProfileEntry[] = []
  const uncachedConnections: typeof viableConnections = []

  for (const connection of viableConnections) {
    const cached = cachedByProvider.get(connection.provider)
    if (cached) {
      const data = (
        typeof cached.normalizedData === 'string'
          ? JSON.parse(cached.normalizedData)
          : cached.normalizedData
      ) as Record<string, any>

      const enabledTypes = (connection.enabledDataTypes as string[]) ?? [
        'phone',
        'email',
        'profile',
      ]
      cachedResults.push({
        provider: connection.provider,
        priority: connection.priority,
        enabledTypes,
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          title: data.title,
          phone: data.phone,
          email: data.email,
          phoneNumbers: data.phoneNumbers ?? (data.phone ? [data.phone] : []),
        },
      })
      enrichmentCacheRepo.recordHit(cached.id).catch(() => {})
      console.log('[Extension] Cache HIT for getVendorProfileData:', {
        provider: connection.provider,
        lookupKey,
      })
    } else {
      uncachedConnections.push(connection)
    }
  }

  // Call only UNCACHED vendors in parallel
  const results = await Promise.allSettled(
    uncachedConnections.map(async (connection) => {
      const apiKey = decrypt(connection.apiKeyEncrypted)
      const enabledTypes = (connection.enabledDataTypes as string[]) ?? [
        'phone',
        'email',
        'profile',
      ]

      if (connection.provider === 'prospeo') {
        const result = await prospeoClient.enrichFromLinkedIn(
          apiKey,
          linkedInUrl,
        )
        if (!result.success)
          throw new Error(result.errorMessage ?? 'Prospeo failed')

        await db
          .updateTable('data_vendor_connection')
          .set({
            creditsUsed: connection.creditsUsed + 1,
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where('id', '=', connection.id)
          .execute()

        const vendorData = {
          firstName: result.firstName,
          lastName: result.lastName,
          company: result.company,
          title: result.title,
          phone: result.phone,
          email: result.email,
          phoneNumbers:
            result.phoneNumbers ?? (result.phone ? [result.phone] : []),
        }

        // Write to cache
        enrichmentCacheRepo
          .upsert({
            lookupKey,
            lookupType: 'linkedin',
            provider: 'prospeo',
            rawResponse: result,
            normalizedData: vendorData,
          })
          .catch((err) => console.error('[Extension] Cache write failed:', err))

        return {
          provider: 'prospeo' as const,
          priority: connection.priority,
          enabledTypes,
          data: vendorData,
        }
      } else if (connection.provider === 'leadmagic') {
        const result = await leadmagicClient.enrichFromLinkedIn(
          apiKey,
          linkedInUrl,
        )
        if (!result.success)
          throw new Error(result.errorMessage ?? 'LeadMagic failed')

        await db
          .updateTable('data_vendor_connection')
          .set({
            creditsUsed: connection.creditsUsed + (result.creditsUsed ?? 1),
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where('id', '=', connection.id)
          .execute()

        const vendorData = {
          phone: result.phone,
          email: result.email,
          phoneNumbers: result.phone ? [result.phone] : [],
        }

        // Write to cache
        enrichmentCacheRepo
          .upsert({
            lookupKey,
            lookupType: 'linkedin',
            provider: 'leadmagic',
            rawResponse: result,
            normalizedData: vendorData,
          })
          .catch((err) => console.error('[Extension] Cache write failed:', err))

        return {
          provider: 'leadmagic' as const,
          priority: connection.priority,
          enabledTypes,
          data: vendorData,
        }
      } else {
        const result = await foragerClient.enrichFromLinkedIn(
          apiKey,
          linkedInUrl,
        )
        if (!result.success)
          throw new Error(result.errorMessage ?? 'Forager failed')

        await db
          .updateTable('data_vendor_connection')
          .set({
            creditsUsed: connection.creditsUsed + (result.creditsUsed ?? 1),
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where('id', '=', connection.id)
          .execute()

        const vendorData = {
          firstName: result.firstName,
          lastName: result.lastName,
          company: result.company,
          title: result.title,
          phone: result.phone || result.mobilePhone || result.directDial,
          email: result.email,
          phoneNumbers: [
            result.phone,
            result.mobilePhone,
            result.directDial,
          ].filter(Boolean) as string[],
        }

        // Write to cache
        enrichmentCacheRepo
          .upsert({
            lookupKey,
            lookupType: 'linkedin',
            provider: 'forager',
            rawResponse: result,
            normalizedData: vendorData,
          })
          .catch((err) => console.error('[Extension] Cache write failed:', err))

        return {
          provider: 'forager' as const,
          priority: connection.priority,
          enabledTypes,
          data: vendorData,
        }
      }
    }),
  )

  // Merge results — combine cached results with fresh vendor results
  const freshSuccessfulResults = results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<VendorProfileEntry>).value)

  const successfulResults = [...cachedResults, ...freshSuccessfulResults].sort(
    (a, b) => a.priority - b.priority,
  ) // Sort by priority (lower = higher)

  if (successfulResults.length === 0) {
    return {
      success: false,
      providers: [],
      errorMessage:
        'All enrichment vendors failed. Check your API keys in Settings > Data Vendors.',
    }
  }

  const providers = successfulResults.map((r) => r.provider)

  // Use profile data from highest-priority vendor that has it
  const mergedData: VendorProfileResult['data'] = {}
  for (const result of successfulResults) {
    if (result.enabledTypes.includes('profile')) {
      if (result.data.firstName && !mergedData.firstName)
        mergedData.firstName = result.data.firstName
      if (result.data.lastName && !mergedData.lastName)
        mergedData.lastName = result.data.lastName
      if (result.data.company && !mergedData.company)
        mergedData.company = result.data.company
      if (result.data.title && !mergedData.title)
        mergedData.title = result.data.title
    }
    if (result.enabledTypes.includes('email')) {
      if (result.data.email && !mergedData.email)
        mergedData.email = result.data.email
    }
  }

  // Collect all phones from all vendors (respecting enabledTypes)
  const allPhones: EnrichedPhoneNumber[] = []
  const seenPhones = new Set<string>()
  for (const result of successfulResults) {
    if (!result.enabledTypes.includes('phone')) continue
    for (const rawPhone of result.data.phoneNumbers ?? []) {
      // Simple normalization for dedup
      const normalized = rawPhone.replace(/\D/g, '')
      if (!seenPhones.has(normalized)) {
        seenPhones.add(normalized)
        allPhones.push({
          value: rawPhone,
          type: 'mobile',
          source: result.provider,
          isPrimary: allPhones.length === 0, // First = primary
        })
      }
    }
  }

  // Set primary phone from collected phones
  mergedData.phone = allPhones[0]?.value || mergedData.phone
  mergedData.phoneNumbers = allPhones

  console.log('[Extension] Merged vendor profile data:', {
    providers,
    firstName: mergedData.firstName,
    lastName: mergedData.lastName,
    company: mergedData.company,
    phoneCount: allPhones.length,
    hasEmail: !!mergedData.email,
  })

  return {
    success: true,
    providers,
    data: mergedData,
  }
}

/**
 * Get paginated leads for lead browser
 */
export const getLeads = async (
  organizationId: string,
  filters: {
    clientId?: string
    campaignId?: string
    search?: string
  },
  limit: number,
  offset: number,
): Promise<GetLeadsResponse> => {
  let query = db
    .selectFrom('lead')
    .leftJoin('client', 'client.id', 'lead.clientId')
    .leftJoin('campaign_lead', 'campaign_lead.leadId', 'lead.id')
    .leftJoin('campaign', 'campaign.id', 'campaign_lead.campaignId')
    .where('lead.organizationId', '=', organizationId)
    .where('lead.deletedAt', 'is', null)

  // Apply filters
  if (filters.clientId) {
    query = query.where('lead.clientId', '=', filters.clientId)
  }

  if (filters.campaignId) {
    query = query.where('campaign_lead.campaignId', '=', filters.campaignId)
  }

  if (filters.search) {
    const searchTerm = `%${filters.search.toLowerCase()}%`
    query = query.where((eb) =>
      eb.or([
        eb('lead.firstName', 'ilike', searchTerm),
        eb('lead.lastName', 'ilike', searchTerm),
        eb('lead.company', 'ilike', searchTerm),
        eb('lead.phone', 'ilike', searchTerm),
        eb('lead.email', 'ilike', searchTerm),
      ]),
    )
  }

  // Get total count
  const countResult = await db
    .selectFrom('lead')
    .leftJoin('campaign_lead', 'campaign_lead.leadId', 'lead.id')
    .where('lead.organizationId', '=', organizationId)
    .where('lead.deletedAt', 'is', null)
    .$if(!!filters.clientId, (qb) =>
      qb.where('lead.clientId', '=', filters.clientId!),
    )
    .$if(!!filters.campaignId, (qb) =>
      qb.where('campaign_lead.campaignId', '=', filters.campaignId!),
    )
    .$if(!!filters.search, (qb) => {
      const searchTerm = `%${filters.search!.toLowerCase()}%`
      return qb.where((eb) =>
        eb.or([
          eb('lead.firstName', 'ilike', searchTerm),
          eb('lead.lastName', 'ilike', searchTerm),
          eb('lead.company', 'ilike', searchTerm),
          eb('lead.phone', 'ilike', searchTerm),
          eb('lead.email', 'ilike', searchTerm),
        ]),
      )
    })
    .select(db.fn.count('lead.id').as('count'))
    .executeTakeFirst()

  const total = Number(countResult?.count ?? 0)

  // Get leads with pagination
  const leads = await query
    .select([
      'lead.id',
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'lead.phone',
      'lead.email',
      'lead.linkedInUrl',
      'lead.clientId',
      'client.name as clientName',
      'campaign.id as campaignId',
      'campaign.name as campaignName',
    ])
    .distinctOn('lead.id')
    .orderBy('lead.id')
    .orderBy('lead.createdAt', 'desc')
    .limit(limit)
    .offset(offset)
    .execute()

  return {
    leads: leads.map((lead) => ({
      id: lead.id,
      firstName: lead.firstName,
      lastName: lead.lastName,
      company: lead.company,
      phone: lead.phone,
      email: lead.email,
      linkedInUrl: lead.linkedInUrl,
      isEnriched: !!(lead.phone || lead.email),
      clientId: lead.clientId,
      clientName: lead.clientName,
      campaignId: lead.campaignId,
      campaignName: lead.campaignName,
    })),
    total,
    hasMore: offset + leads.length < total,
  }
}

function splitFullName(fullName?: string): {
  firstName?: string
  lastName?: string
} {
  if (!fullName) return {}
  const parts = fullName.trim().split(/\s+/).filter(Boolean)

  if (parts.length === 0) return {}
  if (parts.length === 1) return { firstName: parts[0] }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

/**
 * Create a lead list from extension-collected LinkedIn selections.
 */
export const createListFromLinkedInSelection = async (
  organizationId: string,
  userId: string,
  params: CreateListFromLinkedInSelectionRequest,
): Promise<CreateListFromLinkedInSelectionResponse> => {
  const correlationId = randomUUID()
  logger.info(
    {
      eventType: EXTENSION_FLOW_EVENT.CREATE_LIST_STARTED,
      organizationId,
      userId,
      totalSelected: params.selections.length,
      correlationId,
    },
    'Creating list from LinkedIn selections',
  )

  const dedupedByCanonical = new Map<
    string,
    CreateListFromLinkedInSelectionRequest['selections'][number]
  >()
  for (const selection of params.selections) {
    const key = normalizeLinkedInUrl(
      selection.canonicalLinkedInUrl || selection.rawLinkedInUrl,
    )
    if (!dedupedByCanonical.has(key)) {
      dedupedByCanonical.set(key, selection)
    }
  }

  const uniqueSelections = Array.from(dedupedByCanonical.values())
  const firstSource = uniqueSelections[0]
  const sourceSummary = firstSource
    ? `Source: ${firstSource.sourceType} | ${firstSource.sourcePageUrl} | captured ${firstSource.capturedAt}`
    : 'Source: LinkedIn extension selection'
  const description = [params.listDescription, sourceSummary]
    .filter(Boolean)
    .join(' | ')

  const list = await leadListService.createList({
    organizationId,
    name: params.listName,
    description,
    createdById: userId,
  })

  const leadIdsSet = new Set<string>()
  let createdLeads = 0
  let dedupedExistingLeads = 0

  for (const selection of uniqueSelections) {
    const canonicalUrl = canonicalizeLinkedInUrl(
      selection.canonicalLinkedInUrl || selection.rawLinkedInUrl,
    )

    const existing = await checkLeadByLinkedIn(organizationId, canonicalUrl)
    if (existing.exists && existing.lead?.id) {
      if (!leadIdsSet.has(existing.lead.id)) {
        dedupedExistingLeads++
      }
      leadIdsSet.add(existing.lead.id)
      continue
    }

    const nameParts = splitFullName(selection.fullName)
    const firstName = selection.firstName || nameParts.firstName
    const lastName = selection.lastName || nameParts.lastName

    const createdLead = await leadService.create({
      organizationId,
      userId,
      firstName,
      lastName,
      company: selection.company || undefined,
      title: selection.headline || undefined,
      linkedInUrl: canonicalUrl,
      phone: '',
      email: undefined,
    })

    leadIdsSet.add(createdLead.id)
    createdLeads++
  }

  const leadIds = Array.from(leadIdsSet)

  if (leadIds.length > 0) {
    await leadListService.addLeadsToList(list.id, organizationId, leadIds)
  }

  logger.info(
    {
      eventType: EXTENSION_FLOW_EVENT.CREATE_LIST_COMPLETED,
      organizationId,
      userId,
      listId: list.id,
      listName: list.name,
      totalSelected: params.selections.length,
      uniqueSelections: uniqueSelections.length,
      leadIdsAdded: leadIds.length,
      createdLeads,
      dedupedExistingLeads,
      correlationId,
    },
    'Created list from LinkedIn selections',
  )

  return {
    listId: list.id,
    listName: list.name,
    totalSelected: params.selections.length,
    createdLeads,
    dedupedExistingLeads,
    leadIds,
    correlationId,
  }
}

/**
 * Queue async bulk enrichment for all active leads in a list.
 */
export const enqueueListBulkEnrich = async (
  organizationId: string,
  userId: string,
  params: {
    listId: string
    providers?: string[]
    forceRefresh?: boolean
  },
): Promise<{
  jobId: string
  listId: string
  totalLeads: number
  correlationId: string
}> => {
  await leadListService.getList(params.listId, organizationId)

  const leadIds = await leadListEntryRepo.getLeadIdsByList(params.listId)
  if (leadIds.length === 0) {
    throw new BadRequestError('This list has no leads to enrich')
  }
  if (leadIds.length > 100) {
    throw new BadRequestError(
      `Batch limit exceeded: list has ${leadIds.length} leads, max 100 per bulk run`,
    )
  }

  const correlationId = randomUUID()
  const jobId = await addExtensionBulkEnrichJob({
    type: ExtensionBulkEnrichEventType.PROCESS_LIST_BULK_ENRICH,
    organizationId,
    userId,
    listId: params.listId,
    leadIds,
    providers: params.providers,
    forceRefresh: params.forceRefresh,
    correlationId,
  })

  logger.info(
    {
      eventType: EXTENSION_FLOW_EVENT.BULK_ENRICH_ENQUEUED,
      organizationId,
      userId,
      listId: params.listId,
      jobId: String(jobId),
      totalLeads: leadIds.length,
      providers: params.providers,
      forceRefresh: !!params.forceRefresh,
      correlationId,
    },
    'Queued extension bulk enrichment job',
  )

  return {
    jobId: String(jobId),
    listId: params.listId,
    totalLeads: leadIds.length,
    correlationId,
  }
}

/**
 * Read status/progress for an async extension bulk enrichment job.
 */
export const getBulkEnrichJobStatus = async (
  organizationId: string,
  jobId: string,
): Promise<ExtensionBulkEnrichJobStatusResponse> => {
  const job = await extensionBulkEnrichQueue.getJob(jobId)
  if (!job) {
    throw new NotFoundError('Bulk job not found')
  }

  if (job.data.organizationId !== organizationId) {
    throw new ForbiddenError('Forbidden')
  }

  const state = await job.getState()
  const normalizedState = state === 'waiting-children' ? 'waiting' : state
  const correlationId = job.data.correlationId
  const returnValue = job.returnvalue as
    | {
        totalRequested: number
        totalEnriched: number
        totalFailed: number
        totalCreditsUsed: number
      }
    | undefined

  logger.info(
    {
      eventType: EXTENSION_FLOW_EVENT.BULK_ENRICH_STATUS_READ,
      organizationId,
      listId: job.data.listId,
      jobId: String(job.id),
      state: normalizedState,
      correlationId,
    },
    'Read extension bulk enrichment job status',
  )

  return {
    jobId: String(job.id),
    correlationId,
    state: normalizedState as ExtensionBulkEnrichJobStatusResponse['state'],
    progress: (job.progress ??
      0) as ExtensionBulkEnrichJobStatusResponse['progress'],
    result: returnValue
      ? {
          totalRequested: returnValue.totalRequested,
          totalEnriched: returnValue.totalEnriched,
          totalFailed: returnValue.totalFailed,
          totalCreditsUsed: returnValue.totalCreditsUsed,
        }
      : undefined,
    errorMessage: job.failedReason || undefined,
  }
}

const getActiveListLeadIdsForOrganization = async (
  listId: string,
  organizationId: string,
): Promise<string[]> => {
  const rows = await db
    .selectFrom('lead_list_entry')
    .innerJoin('lead', 'lead.id', 'lead_list_entry.leadId')
    .where('lead_list_entry.listId', '=', listId)
    .where('lead_list_entry.removedAt', 'is', null)
    .where('lead.deletedAt', 'is', null)
    .where('lead.organizationId', '=', organizationId)
    .select('lead.id')
    .orderBy('lead_list_entry.sortOrder', 'asc')
    .execute()

  return rows.map((row) => row.id)
}

/**
 * Push all active list leads to a selected CRM provider in bulk.
 */
export const bulkPushListToCrm = async (
  organizationId: string,
  userId: string,
  params: {
    listId: string
    provider: CrmProvider
  },
): Promise<ExtensionBulkCrmPushResponse> => {
  await leadListService.getList(params.listId, organizationId)

  const leadIds = await getActiveListLeadIdsForOrganization(
    params.listId,
    organizationId,
  )
  if (leadIds.length === 0) {
    throw new Error('This list has no leads to push')
  }
  if (leadIds.length > 100) {
    throw new Error(
      `Batch limit exceeded: list has ${leadIds.length} leads, max 100 per bulk CRM push`,
    )
  }

  const correlationId = randomUUID()
  logger.info(
    {
      eventType: EXTENSION_FLOW_EVENT.CRM_BULK_PUSH_STARTED,
      organizationId,
      userId,
      listId: params.listId,
      provider: params.provider,
      totalRequested: leadIds.length,
      correlationId,
    },
    'Starting bulk CRM push for extension list',
  )
  const results: ExtensionBulkCrmPushResponse['results'] = []
  let totalPushed = 0
  let totalFailed = 0

  for (const leadId of leadIds) {
    try {
      const pushResult = await crmService.pushLeadToCrm(
        organizationId,
        leadId,
        params.provider,
      )
      results.push({
        leadId,
        success: true,
        externalId: pushResult.externalId,
        externalUrl: pushResult.externalUrl,
      })
      totalPushed++
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'CRM push failed'
      results.push({
        leadId,
        success: false,
        errorMessage,
      })
      logger.warn(
        {
          eventType: EXTENSION_FLOW_EVENT.CRM_BULK_PUSH_LEAD_FAILED,
          organizationId,
          userId,
          listId: params.listId,
          provider: params.provider,
          leadId,
          errorMessage,
          correlationId,
        },
        'Bulk CRM push failed for lead',
      )
      totalFailed++
    }
  }

  logger.info(
    {
      eventType: EXTENSION_FLOW_EVENT.CRM_BULK_PUSH_COMPLETED,
      organizationId,
      userId,
      listId: params.listId,
      provider: params.provider,
      totalRequested: leadIds.length,
      totalPushed,
      totalFailed,
      correlationId,
    },
    'Completed bulk CRM push for extension list',
  )

  return {
    provider: params.provider,
    totalRequested: leadIds.length,
    totalPushed,
    totalFailed,
    correlationId,
    results,
  }
}

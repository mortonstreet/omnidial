import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import { encrypt, decrypt } from '@/lib/encryption'
import type {
  VendorConnectionResponse,
  VendorTestResult,
  ContactInfoResponse,
  EnrichLeadResponse,
  BulkEnrichResponse,
  EnrichmentHistoryRecordResponse,
  DataVendorProvider,
  ContactInfoType,
  VendorDataType,
  VendorEnrichmentResult,
} from '@shared/types/src/requests/enrichment'
import * as prospeoClient from '@/clients/prospeo.client'
import * as foragerClient from '@/clients/forager.client'
import * as leadmagicClient from '@/clients/leadmagic.client'
import * as firecrawlClient from '@/clients/firecrawl.client'
import { validateAndNormalizePhone } from '@/lib/phone'
import logger from '@/lib/logger'
import type { EnrichedPhoneNumber } from '@shared/types/src/requests/extension'
import * as enrichmentCacheRepo from '@/repositories/enrichmentCache.repository'
import {
  buildLinkedInLookupKey,
  buildIdentityLookupKey,
} from '@/lib/enrichmentCache'
import * as crmService from './crm.service'
import {
  executeWithVendorPolicy,
  classifyVendorResultByMessage,
  formatVendorErrorForHistory,
} from './vendorCompliance.service'

// === Vendor Connection Management ===

export const connectVendor = async (
  organizationId: string,
  connectedById: string,
  data: {
    provider: DataVendorProvider
    apiKey: string
    priority?: number
    creditsLimit?: number
    enabledDataTypes?: string[]
  },
): Promise<VendorConnectionResponse> => {
  // Check if already connected
  const existing = await db
    .selectFrom('data_vendor_connection')
    .where('organizationId', '=', organizationId)
    .where('provider', '=', data.provider)
    .selectAll()
    .executeTakeFirst()

  if (existing) {
    throw new Error(`${data.provider} is already connected`)
  }

  const connection = await db
    .insertInto('data_vendor_connection')
    .values({
      id: uuidv4(),
      organizationId,
      provider: data.provider,
      apiKeyEncrypted: encrypt(data.apiKey),
      isActive: true,
      priority: data.priority ?? 0,
      enabledDataTypes: data.enabledDataTypes ?? ['phone', 'email', 'profile'],
      creditsUsed: 0,
      creditsLimit: data.creditsLimit ?? null,
      connectedById,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformConnection(connection, null)
}

export const updateVendorConnection = async (
  connectionId: string,
  data: {
    apiKey?: string
    isActive?: boolean
    priority?: number
    creditsLimit?: number | null
    enabledDataTypes?: string[]
  },
): Promise<VendorConnectionResponse> => {
  const updateData: any = { updatedAt: new Date() }

  if (data.apiKey !== undefined) {
    updateData.apiKeyEncrypted = encrypt(data.apiKey)
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive
  }
  if (data.priority !== undefined) {
    updateData.priority = data.priority
  }
  if (data.creditsLimit !== undefined) {
    updateData.creditsLimit = data.creditsLimit
  }
  if (data.enabledDataTypes !== undefined) {
    updateData.enabledDataTypes = data.enabledDataTypes
  }

  const updated = await db
    .updateTable('data_vendor_connection')
    .set(updateData)
    .where('id', '=', connectionId)
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformConnection(updated, null)
}

export const disconnectVendor = async (connectionId: string): Promise<void> => {
  await db
    .deleteFrom('data_vendor_connection')
    .where('id', '=', connectionId)
    .execute()
}

export const listVendorConnections = async (
  organizationId: string,
  filters: { isActive?: boolean },
): Promise<VendorConnectionResponse[]> => {
  let query = db
    .selectFrom('data_vendor_connection as dvc')
    .leftJoin('user as u', 'u.id', 'dvc.connectedById')
    .where('dvc.organizationId', '=', organizationId)

  if (filters.isActive !== undefined) {
    query = query.where('dvc.isActive', '=', filters.isActive)
  }

  const connections = await query
    .select([
      'dvc.id',
      'dvc.organizationId',
      'dvc.provider',
      'dvc.isActive',
      'dvc.priority',
      'dvc.enabledDataTypes',
      'dvc.creditsUsed',
      'dvc.creditsLimit',
      'dvc.lastSyncAt',
      'dvc.connectedById',
      'dvc.createdAt',
      'dvc.updatedAt',
      'u.name as connectedByName',
    ])
    .orderBy('dvc.priority', 'asc')
    .execute()

  return connections.map((c) => ({
    id: c.id,
    organizationId: c.organizationId,
    provider: c.provider as DataVendorProvider,
    isActive: c.isActive,
    priority: c.priority,
    enabledDataTypes: (c.enabledDataTypes as any) ?? [
      'phone',
      'email',
      'profile',
    ],
    creditsUsed: c.creditsUsed,
    creditsLimit: c.creditsLimit,
    creditsRemaining: c.creditsLimit ? c.creditsLimit - c.creditsUsed : null,
    lastSyncAt: c.lastSyncAt?.toISOString() || null,
    connectedById: c.connectedById,
    connectedByName: c.connectedByName,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }))
}

export const testVendorConnection = async (
  connectionId: string,
): Promise<VendorTestResult> => {
  const connection = await db
    .selectFrom('data_vendor_connection')
    .where('id', '=', connectionId)
    .selectAll()
    .executeTakeFirst()

  if (!connection) {
    throw new Error('Connection not found')
  }

  const apiKey = decrypt(connection.apiKeyEncrypted)
  const startTime = Date.now()

  try {
    const adapter = getVendorAdapter(connection.provider as DataVendorProvider)
    const result = await adapter.testConnection(apiKey)

    return {
      success: result.success,
      message: result.message,
      responseTimeMs: Date.now() - startTime,
      creditsRemaining: result.creditsRemaining,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      responseTimeMs: Date.now() - startTime,
      creditsRemaining: null,
    }
  }
}

// === Lead Enrichment ===

type LeadContactCoverage = {
  hasPhone: boolean
  hasEmail: boolean
}

const LINKEDIN_ENRICHMENT_PROVIDERS = new Set<DataVendorProvider>([
  'prospeo',
  'forager',
  'leadmagic',
])

const CONTACT_DATA_TYPES: VendorDataType[] = ['phone', 'email']
const DEFAULT_DATA_TYPES: VendorDataType[] = ['phone', 'email', 'profile']

const normalizeRequestedDataTypes = (
  dataTypes?: VendorDataType[],
): VendorDataType[] => {
  if (!dataTypes || dataTypes.length === 0) {
    return DEFAULT_DATA_TYPES
  }
  return Array.from(new Set(dataTypes))
}

const isValidEmailValue = (value?: string | null): boolean =>
  !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

const hasTenDigitPhoneValue = (value?: string | null): boolean => {
  if (!value) return false
  if (validateAndNormalizePhone(value)) return true
  const digits = value.replace(/\D/g, '')
  return (
    digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
  )
}

const getLeadContactCoverage = async (lead: {
  id: string
  email: string | null
  phone: string | null
  normalizedPhone: string | null
}): Promise<LeadContactCoverage> => {
  let hasPhone =
    hasTenDigitPhoneValue(lead.normalizedPhone) ||
    hasTenDigitPhoneValue(lead.phone)
  let hasEmail = isValidEmailValue(lead.email)

  if (hasPhone && hasEmail) {
    return { hasPhone, hasEmail }
  }

  const contacts = await db
    .selectFrom('lead_contact_info')
    .where('leadId', '=', lead.id)
    .select(['type', 'value'])
    .execute()

  for (const contact of contacts) {
    if (
      !hasPhone &&
      ['mobile', 'direct_dial', 'office'].includes(contact.type) &&
      hasTenDigitPhoneValue(contact.value)
    ) {
      hasPhone = true
    }

    if (
      !hasEmail &&
      ['work_email', 'personal_email'].includes(contact.type) &&
      isValidEmailValue(contact.value)
    ) {
      hasEmail = true
    }
  }

  return { hasPhone, hasEmail }
}

const missingRequestedContactTypes = (
  requestedDataTypes: VendorDataType[],
  coverage: LeadContactCoverage,
): VendorDataType[] =>
  requestedDataTypes.filter((type) => {
    if (type === 'phone') return !coverage.hasPhone
    if (type === 'email') return !coverage.hasEmail
    return true
  })

const buildAlreadyHasRequestedDataResponse = (
  leadId: string,
): EnrichLeadResponse => ({
  leadId,
  success: true,
  providersUsed: [],
  fieldsEnriched: [],
  creditsUsed: 0,
  errorMessage: 'Lead already has the requested contact data.',
})

export const enrichLead = async (
  organizationId: string,
  leadId: string,
  options: {
    providers?: DataVendorProvider[]
    dataTypes?: VendorDataType[]
    forceRefresh?: boolean
    requestMode?: 'interactive' | 'bulk'
  },
): Promise<EnrichLeadResponse> => {
  // Get the lead
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  const requestedDataTypes = normalizeRequestedDataTypes(options.dataTypes)
  const explicitDataTypes = !!options.dataTypes?.length
  const contactOnlyRequest =
    explicitDataTypes &&
    requestedDataTypes.every((type) => CONTACT_DATA_TYPES.includes(type))
  const contactCoverage = await getLeadContactCoverage(lead)
  const effectiveDataTypes = contactOnlyRequest
    ? missingRequestedContactTypes(requestedDataTypes, contactCoverage)
    : requestedDataTypes

  if (contactOnlyRequest && effectiveDataTypes.length === 0) {
    return buildAlreadyHasRequestedDataResponse(leadId)
  }

  // Check if already enriched and not forcing refresh
  if (
    lead.enrichmentStatus === 'enriched' &&
    !options.forceRefresh &&
    !explicitDataTypes
  ) {
    return {
      leadId,
      success: true,
      providersUsed: [],
      fieldsEnriched: [],
      creditsUsed: 0,
      errorMessage: 'Lead already enriched. Use forceRefresh to re-enrich.',
    }
  }

  if (
    lead.linkedInUrl &&
    (!options.providers?.length ||
      options.providers.some((provider) =>
        LINKEDIN_ENRICHMENT_PROVIDERS.has(provider),
      ))
  ) {
    return enrichLeadFromLinkedIn(organizationId, leadId, lead.linkedInUrl, {
      providers: options.providers,
      dataTypes: effectiveDataTypes,
      forceRefresh: options.forceRefresh,
      requestMode: options.requestMode,
      contactCoverage,
    })
  }

  // === Cache check ===
  if (!options.forceRefresh) {
    const lookupKey = lead.linkedInUrl
      ? buildLinkedInLookupKey(lead.linkedInUrl)
      : buildIdentityLookupKey(
          lead.firstName,
          lead.lastName,
          lead.email,
          lead.company,
        )

    if (lookupKey) {
      const cachedEntries =
        await enrichmentCacheRepo.findValidByLookupKey(lookupKey)
      if (cachedEntries.length > 0) {
        const cached = cachedEntries[0]
        const data = (
          typeof cached.normalizedData === 'string'
            ? JSON.parse(cached.normalizedData)
            : cached.normalizedData
        ) as Record<string, any>

        const cachedHasRequestedData = effectiveDataTypes.some((type) => {
          if (type === 'phone') {
            return !!(
              data.phone ||
              data.mobilePhone ||
              data.phoneNumbers?.length
            )
          }
          if (type === 'email') return !!data.email
          return !!(
            data.firstName ||
            data.lastName ||
            data.company ||
            data.title
          )
        })

        if (cachedHasRequestedData) {
          const updateData: Record<string, any> = {}
          const fieldsEnriched: EnrichLeadResponse['fieldsEnriched'] = []

          if (
            effectiveDataTypes.includes('profile') &&
            data.firstName &&
            !lead.firstName
          ) {
            updateData.firstName = data.firstName
            fieldsEnriched.push({
              field: 'firstName',
              previousValue: lead.firstName,
              newValue: data.firstName,
              source: cached.provider as DataVendorProvider,
              confidence: null,
            })
          }
          if (
            effectiveDataTypes.includes('profile') &&
            data.lastName &&
            !lead.lastName
          ) {
            updateData.lastName = data.lastName
            fieldsEnriched.push({
              field: 'lastName',
              previousValue: lead.lastName,
              newValue: data.lastName,
              source: cached.provider as DataVendorProvider,
              confidence: null,
            })
          }
          if (
            effectiveDataTypes.includes('email') &&
            data.email &&
            !contactCoverage.hasEmail
          ) {
            updateData.email = data.email
            fieldsEnriched.push({
              field: 'email',
              previousValue: lead.email,
              newValue: data.email,
              source: cached.provider as DataVendorProvider,
              confidence: null,
            })
          }
          if (
            effectiveDataTypes.includes('profile') &&
            data.company &&
            !lead.company
          ) {
            updateData.company = data.company
            fieldsEnriched.push({
              field: 'company',
              previousValue: lead.company,
              newValue: data.company,
              source: cached.provider as DataVendorProvider,
              confidence: null,
            })
          }
          if (
            effectiveDataTypes.includes('profile') &&
            data.title &&
            !lead.title
          ) {
            updateData.title = data.title
            fieldsEnriched.push({
              field: 'title',
              previousValue: lead.title,
              newValue: data.title,
              source: cached.provider as DataVendorProvider,
              confidence: null,
            })
          }
          if (
            effectiveDataTypes.includes('phone') &&
            data.phone &&
            !contactCoverage.hasPhone
          ) {
            updateData.phone = data.phone
            fieldsEnriched.push({
              field: 'phone',
              previousValue: lead.phone,
              newValue: data.phone,
              source: cached.provider as DataVendorProvider,
              confidence: null,
            })
          }

          if (Object.keys(updateData).length > 0) {
            updateData.enrichmentStatus = 'enriched'
            updateData.enrichmentSources = [
              ...(lead.enrichmentSources || []),
              cached.provider,
            ]
            updateData.updatedAt = new Date()
            await db
              .updateTable('lead')
              .set(updateData)
              .where('id', '=', leadId)
              .execute()
          }

          await enrichmentCacheRepo.recordHit(cached.id)

          await recordEnrichmentHistory(
            organizationId,
            leadId,
            null,
            cached.provider as DataVendorProvider,
            'person',
            effectiveDataTypes,
            fieldsEnriched.map((f) => f.field),
            0,
            true,
            null,
            0,
          )

          console.log('[Enrichment] Cache HIT for enrichLead:', {
            leadId,
            lookupKey,
            provider: cached.provider,
          })

          // Fire-and-forget auto CRM sync
          crmService
            .autoSyncAfterEnrichment(organizationId, leadId)
            .catch((err) =>
              console.error('[Enrichment] Auto CRM sync failed:', err),
            )

          return {
            leadId,
            success: true,
            providersUsed: [cached.provider as DataVendorProvider],
            fieldsEnriched,
            creditsUsed: 0,
            cacheHit: true,
            creditsSaved: 1,
            errorMessage: null,
          }
        }
      }
    }
  }

  // Get active vendor connections in priority order
  let connectionsQuery = db
    .selectFrom('data_vendor_connection')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)

  if (options.providers && options.providers.length > 0) {
    connectionsQuery = connectionsQuery.where(
      'provider',
      'in',
      options.providers,
    )
  }

  const connections = await connectionsQuery
    .selectAll()
    .orderBy('priority', 'asc')
    .execute()

  if (connections.length === 0) {
    return {
      leadId,
      success: false,
      providersUsed: [],
      fieldsEnriched: [],
      creditsUsed: 0,
      errorMessage: 'No active vendor connections available',
    }
  }

  // Waterfall enrichment - try each provider until we get data
  const fieldsEnriched: EnrichLeadResponse['fieldsEnriched'] = []
  const providersUsed: DataVendorProvider[] = []
  let totalCredits = 0

  for (let index = 0; index < connections.length; index++) {
    const connection = connections[index]
    const provider = connection.provider as DataVendorProvider
    const nextProvider =
      index + 1 < connections.length
        ? (connections[index + 1].provider as DataVendorProvider)
        : null

    // Check credits limit
    if (
      connection.creditsLimit &&
      connection.creditsUsed >= connection.creditsLimit
    ) {
      continue
    }

    const apiKey = decrypt(connection.apiKeyEncrypted)
    const adapter = getVendorAdapter(provider)

    const startTime = Date.now()
    let result: VendorEnrichmentResult

    try {
      result = await executeWithVendorPolicy({
        organizationId,
        provider,
        requestMode: options.requestMode ?? 'interactive',
        estimatedCredits: 1,
        operation: () =>
          adapter.enrichLead(apiKey, {
            email: lead.email || undefined,
            phone: lead.phone || undefined,
            firstName: lead.firstName || undefined,
            lastName: lead.lastName || undefined,
            company: lead.company || undefined,
          }),
        classifyResult: classifyVendorResultByMessage,
        extractCreditsUsed: (vendorResult) => vendorResult.creditsCost,
      })
    } catch (error) {
      const errorMessage = formatVendorErrorForHistory(error)
      // Log the failure and continue to next provider
      await recordEnrichmentHistory(
        organizationId,
        leadId,
        connection.id,
        provider,
        'person',
        [],
        [],
        0,
        false,
        errorMessage,
        Date.now() - startTime,
      )

      if (nextProvider) {
        logger.warn(
          {
            organizationId,
            failedProvider: provider,
            fallbackProvider: nextProvider,
            errorMessage,
          },
          'Enrichment provider failed, failing over to next vendor',
        )
      }
      continue
    }

    if (!result.success || !result.data) {
      const errorMessage = result.errorMessage ?? 'Vendor enrichment failed'
      await recordEnrichmentHistory(
        organizationId,
        leadId,
        connection.id,
        provider,
        'person',
        [],
        [],
        result.creditsCost,
        false,
        errorMessage,
        result.responseTimeMs,
      )

      if (nextProvider) {
        logger.warn(
          {
            organizationId,
            failedProvider: provider,
            fallbackProvider: nextProvider,
            errorMessage,
          },
          'Enrichment provider returned no usable data, failing over',
        )
      }
      continue
    }

    providersUsed.push(provider)
    totalCredits += result.creditsCost

    // Update lead with enriched data
    const updateData: Record<string, any> = {}
    const enrichedFields: string[] = []

    if (
      effectiveDataTypes.includes('profile') &&
      result.data.firstName &&
      !lead.firstName
    ) {
      updateData.firstName = result.data.firstName
      fieldsEnriched.push({
        field: 'firstName',
        previousValue: lead.firstName,
        newValue: result.data.firstName,
        source: provider,
        confidence: null,
      })
      enrichedFields.push('firstName')
    }
    if (
      effectiveDataTypes.includes('profile') &&
      result.data.lastName &&
      !lead.lastName
    ) {
      updateData.lastName = result.data.lastName
      fieldsEnriched.push({
        field: 'lastName',
        previousValue: lead.lastName,
        newValue: result.data.lastName,
        source: provider,
        confidence: null,
      })
      enrichedFields.push('lastName')
    }
    if (
      effectiveDataTypes.includes('email') &&
      result.data.email &&
      !contactCoverage.hasEmail
    ) {
      updateData.email = result.data.email
      fieldsEnriched.push({
        field: 'email',
        previousValue: lead.email,
        newValue: result.data.email,
        source: provider,
        confidence: null,
      })
      enrichedFields.push('email')
    }
    if (
      effectiveDataTypes.includes('profile') &&
      result.data.company &&
      !lead.company
    ) {
      updateData.company = result.data.company
      fieldsEnriched.push({
        field: 'company',
        previousValue: lead.company,
        newValue: result.data.company,
        source: provider,
        confidence: null,
      })
      enrichedFields.push('company')
    }
    if (
      effectiveDataTypes.includes('profile') &&
      result.data.title &&
      !lead.title
    ) {
      updateData.title = result.data.title
      fieldsEnriched.push({
        field: 'title',
        previousValue: lead.title,
        newValue: result.data.title,
        source: provider,
        confidence: null,
      })
      enrichedFields.push('title')
    }
    if (
      effectiveDataTypes.includes('profile') &&
      result.data.linkedInUrl &&
      !lead.linkedInUrl
    ) {
      updateData.linkedInUrl = result.data.linkedInUrl
      fieldsEnriched.push({
        field: 'linkedInUrl',
        previousValue: lead.linkedInUrl,
        newValue: result.data.linkedInUrl,
        source: provider,
        confidence: null,
      })
      enrichedFields.push('linkedInUrl')
    }

    // Store additional contact info
    if (effectiveDataTypes.includes('email') && result.data.additionalEmails) {
      for (const email of result.data.additionalEmails) {
        await addContactInfo(leadId, 'work_email', email, connection.provider)
      }
    }
    const primaryPhoneCandidate = result.data.mobilePhone || result.data.phone
    if (
      effectiveDataTypes.includes('phone') &&
      primaryPhoneCandidate &&
      !contactCoverage.hasPhone
    ) {
      await addContactInfo(leadId, 'mobile', primaryPhoneCandidate, provider)
      if (!lead.phone && !updateData.phone) {
        const normalizedPhone = validateAndNormalizePhone(primaryPhoneCandidate)
        if (normalizedPhone) {
          updateData.phone = normalizedPhone
          fieldsEnriched.push({
            field: 'phone',
            previousValue: lead.phone,
            newValue: normalizedPhone,
            source: provider,
            confidence: null,
          })
          enrichedFields.push('phone')
        }
      }
    }
    if (
      effectiveDataTypes.includes('phone') &&
      result.data.directDial &&
      !contactCoverage.hasPhone
    ) {
      await addContactInfo(
        leadId,
        'direct_dial',
        result.data.directDial,
        provider,
      )
    }

    // Update lead
    if (Object.keys(updateData).length > 0) {
      updateData.enrichmentStatus = 'enriched'
      updateData.enrichmentSources = [
        ...(lead.enrichmentSources || []),
        provider,
      ]
      updateData.updatedAt = new Date()

      await db
        .updateTable('lead')
        .set(updateData)
        .where('id', '=', leadId)
        .execute()
    }

    // Update vendor credits used
    await db
      .updateTable('data_vendor_connection')
      .set({
        creditsUsed: connection.creditsUsed + result.creditsCost,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where('id', '=', connection.id)
      .execute()

    // Record history
    await recordEnrichmentHistory(
      organizationId,
      leadId,
      connection.id,
      provider,
      'person',
      effectiveDataTypes,
      enrichedFields,
      result.creditsCost,
      true,
      null,
      result.responseTimeMs,
    )

    // Write to enrichment cache
    if (result.data) {
      const cacheKey = lead.linkedInUrl
        ? buildLinkedInLookupKey(lead.linkedInUrl)
        : buildIdentityLookupKey(
            lead.firstName,
            lead.lastName,
            lead.email,
            lead.company,
          )

      if (cacheKey) {
        enrichmentCacheRepo
          .upsert({
            lookupKey: cacheKey,
            lookupType: lead.linkedInUrl ? 'linkedin' : 'identity_hash',
            provider: connection.provider,
            rawResponse: result,
            normalizedData: {
              firstName: result.data.firstName,
              lastName: result.data.lastName,
              email: result.data.email,
              phone: result.data.phone,
              company: result.data.company,
              title: result.data.title,
            },
          })
          .catch((err) =>
            console.error('[Enrichment] Cache write failed:', err),
          )
      }
    }

    // If we got good data, stop the waterfall
    if (enrichedFields.length > 0) {
      break
    }
  }

  // Fire-and-forget auto CRM sync after successful enrichment
  if (providersUsed.length > 0) {
    crmService
      .autoSyncAfterEnrichment(organizationId, leadId)
      .catch((err) => console.error('[Enrichment] Auto CRM sync failed:', err))
  }

  return {
    leadId,
    success: providersUsed.length > 0,
    providersUsed,
    fieldsEnriched,
    creditsUsed: totalCredits,
    errorMessage:
      providersUsed.length === 0
        ? 'No providers were able to enrich this lead'
        : null,
  }
}

export const bulkEnrich = async (
  organizationId: string,
  leadIds: string[],
  options: {
    providers?: DataVendorProvider[]
    dataTypes?: VendorDataType[]
    forceRefresh?: boolean
  },
): Promise<BulkEnrichResponse> => {
  const results: EnrichLeadResponse[] = []
  let totalEnriched = 0
  let totalFailed = 0
  let totalCreditsUsed = 0

  for (const leadId of leadIds) {
    try {
      const result = await enrichLead(organizationId, leadId, {
        ...options,
        requestMode: 'bulk',
      })
      results.push(result)
      if (result.success && result.fieldsEnriched.length > 0) {
        totalEnriched++
      } else if (!result.success) {
        totalFailed++
      }
      totalCreditsUsed += result.creditsUsed
    } catch (error) {
      results.push({
        leadId,
        success: false,
        providersUsed: [],
        fieldsEnriched: [],
        creditsUsed: 0,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      })
      totalFailed++
    }
  }

  return {
    totalRequested: leadIds.length,
    totalEnriched,
    totalFailed,
    totalCreditsUsed,
    results,
  }
}

// === Contact Info Management ===

export const getLeadContactInfo = async (
  leadId: string,
): Promise<ContactInfoResponse[]> => {
  const contacts = await db
    .selectFrom('lead_contact_info')
    .where('leadId', '=', leadId)
    .selectAll()
    .orderBy('isPrimary', 'desc')
    .orderBy('createdAt', 'asc')
    .execute()

  if (contacts.length > 0) {
    return contacts.map((c) => ({
      id: c.id,
      leadId: c.leadId,
      type: c.type as ContactInfoType,
      value: c.value,
      isPrimary: c.isPrimary,
      isVerified: c.isVerified,
      source: c.source,
      confidence: c.confidence ? Number(c.confidence) : null,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  // Fallback: return contact info from the lead record itself
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .select(['id', 'email', 'phone', 'linkedInUrl', 'createdAt', 'updatedAt'])
    .executeTakeFirst()

  if (!lead) return []

  const fallback: ContactInfoResponse[] = []
  const now = lead.createdAt.toISOString()

  if (lead.email) {
    fallback.push({
      id: `${leadId}-email`,
      leadId,
      type: 'work_email' as ContactInfoType,
      value: lead.email,
      isPrimary: true,
      isVerified: false,
      source: 'imported',
      confidence: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (lead.phone) {
    fallback.push({
      id: `${leadId}-phone`,
      leadId,
      type: 'mobile' as ContactInfoType,
      value: lead.phone,
      isPrimary: true,
      isVerified: false,
      source: 'imported',
      confidence: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  return fallback
}

async function addContactInfo(
  leadId: string,
  type: ContactInfoType,
  value: string,
  source: string,
  isPrimary = false,
) {
  // Normalize phone for dedup check
  const normalizedValue = ['mobile', 'direct_dial', 'office'].includes(type)
    ? (validateAndNormalizePhone(value) ?? value)
    : value

  // Check if already exists (by normalized value for phones)
  const existing = await db
    .selectFrom('lead_contact_info')
    .where('leadId', '=', leadId)
    .where('type', '=', type)
    .where('value', '=', normalizedValue)
    .selectAll()
    .executeTakeFirst()

  if (existing) {
    return existing
  }

  return db
    .insertInto('lead_contact_info')
    .values({
      id: uuidv4(),
      leadId,
      type,
      value: normalizedValue,
      isPrimary,
      isVerified: false,
      source,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirst()
}

// === Enrichment History ===

async function recordEnrichmentHistory(
  organizationId: string,
  leadId: string,
  vendorConnectionId: string | null,
  provider: DataVendorProvider,
  requestType: string,
  fieldsRequested: string[],
  fieldsEnriched: string[],
  creditsCost: number,
  success: boolean,
  errorMessage: string | null,
  responseTimeMs: number,
) {
  await db
    .insertInto('enrichment_history')
    .values({
      id: uuidv4(),
      organizationId,
      leadId,
      vendorConnectionId,
      provider,
      requestType,
      fieldsRequested,
      fieldsEnriched,
      creditsCost,
      success,
      errorMessage,
      responseTimeMs,
      createdAt: new Date(),
    })
    .execute()
}

export const getEnrichmentHistory = async (
  organizationId: string,
  filters: {
    leadId?: string
    provider?: DataVendorProvider
    startDate?: Date
    endDate?: Date
  },
  pagination: { page: number; limit: number },
) => {
  let query = db
    .selectFrom('enrichment_history as eh')
    .leftJoin('lead as l', 'l.id', 'eh.leadId')
    .where('eh.organizationId', '=', organizationId)

  if (filters.leadId) {
    query = query.where('eh.leadId', '=', filters.leadId)
  }
  if (filters.provider) {
    query = query.where('eh.provider', '=', filters.provider)
  }
  if (filters.startDate) {
    query = query.where('eh.createdAt', '>=', filters.startDate)
  }
  if (filters.endDate) {
    query = query.where('eh.createdAt', '<=', filters.endDate)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const records = await query
    .select([
      'eh.id',
      'eh.organizationId',
      'eh.leadId',
      'eh.vendorConnectionId',
      'eh.provider',
      'eh.requestType',
      'eh.fieldsRequested',
      'eh.fieldsEnriched',
      'eh.creditsCost',
      'eh.success',
      'eh.errorMessage',
      'eh.responseTimeMs',
      'eh.createdAt',
      'l.firstName',
      'l.lastName',
    ])
    .orderBy('eh.createdAt', 'desc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  // Calculate aggregated stats
  const stats = await query
    .select((eb) => [
      eb.fn.sum('eh.creditsCost').as('totalCreditsUsed'),
      eb.fn
        .count('eh.id')
        .filterWhere('eh.success', '=', true)
        .as('totalSuccessful'),
      eb.fn
        .count('eh.id')
        .filterWhere('eh.success', '=', false)
        .as('totalFailed'),
    ])
    .executeTakeFirstOrThrow()

  const data: EnrichmentHistoryRecordResponse[] = records.map((r) => ({
    id: r.id,
    organizationId: r.organizationId,
    leadId: r.leadId,
    leadName:
      r.firstName || r.lastName
        ? `${r.firstName || ''} ${r.lastName || ''}`.trim()
        : null,
    vendorConnectionId: r.vendorConnectionId,
    provider: r.provider as DataVendorProvider,
    requestType: r.requestType as any,
    fieldsRequested: r.fieldsRequested,
    fieldsEnriched: r.fieldsEnriched,
    creditsCost: r.creditsCost,
    success: r.success,
    errorMessage: r.errorMessage,
    responseTimeMs: r.responseTimeMs,
    createdAt: r.createdAt.toISOString(),
  }))

  return {
    data,
    total: Number(countResult.count),
    page: pagination.page,
    limit: pagination.limit,
    totalCreditsUsed: Number(stats.totalCreditsUsed) || 0,
    totalSuccessful: Number(stats.totalSuccessful) || 0,
    totalFailed: Number(stats.totalFailed) || 0,
  }
}

// === Vendor Adapters ===

interface VendorAdapter {
  testConnection(apiKey: string): Promise<{
    success: boolean
    message: string
    creditsRemaining: number | null
  }>
  enrichLead(
    apiKey: string,
    lead: {
      email?: string
      phone?: string
      firstName?: string
      lastName?: string
      company?: string
    },
  ): Promise<VendorEnrichmentResult>
}

function getVendorAdapter(provider: DataVendorProvider): VendorAdapter {
  switch (provider) {
    case 'apollo':
      return apolloAdapter
    case 'clearbit':
      return clearbitAdapter
    case 'zoominfo':
      return zoominfoAdapter
    case 'lusha':
      return lushaAdapter
    case 'enrichengine':
      return enrichEngineAdapter
    case 'prospeo':
      return prospeoAdapter
    case 'forager':
      return foragerAdapter
    case 'leadmagic':
      return leadmagicAdapter
    case 'firecrawl':
      return firecrawlAdapter
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}

// Stub adapters - implement actual API calls for each provider
const apolloAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    // Apollo API test - would make actual API call
    return {
      success: true,
      message: 'Apollo connection successful',
      creditsRemaining: null,
    }
  },
  async enrichLead(apiKey, lead) {
    // Apollo person enrichment API call
    return {
      provider: 'apollo',
      success: false,
      errorMessage: 'Apollo adapter not fully implemented',
      creditsCost: 0,
      responseTimeMs: 0,
      data: null,
    }
  },
}

const clearbitAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return {
      success: true,
      message: 'Clearbit connection successful',
      creditsRemaining: null,
    }
  },
  async enrichLead(apiKey, lead) {
    return {
      provider: 'clearbit',
      success: false,
      errorMessage: 'Clearbit adapter not fully implemented',
      creditsCost: 0,
      responseTimeMs: 0,
      data: null,
    }
  },
}

const zoominfoAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return {
      success: true,
      message: 'ZoomInfo connection successful',
      creditsRemaining: null,
    }
  },
  async enrichLead(apiKey, lead) {
    return {
      provider: 'zoominfo',
      success: false,
      errorMessage: 'ZoomInfo adapter not fully implemented',
      creditsCost: 0,
      responseTimeMs: 0,
      data: null,
    }
  },
}

const lushaAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return {
      success: true,
      message: 'Lusha connection successful',
      creditsRemaining: null,
    }
  },
  async enrichLead(apiKey, lead) {
    return {
      provider: 'lusha',
      success: false,
      errorMessage: 'Lusha adapter not fully implemented',
      creditsCost: 0,
      responseTimeMs: 0,
      data: null,
    }
  },
}

const enrichEngineAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return {
      success: true,
      message: 'EnrichEngine connection successful',
      creditsRemaining: null,
    }
  },
  async enrichLead(apiKey, lead) {
    return {
      provider: 'enrichengine',
      success: false,
      errorMessage: 'EnrichEngine adapter not fully implemented',
      creditsCost: 0,
      responseTimeMs: 0,
      data: null,
    }
  },
}

const prospeoAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return prospeoClient.testConnection(apiKey)
  },
  async enrichLead(apiKey, lead) {
    const startTime = Date.now()

    // Prospeo requires LinkedIn URL for enrichment
    // If we don't have it, we can't use Prospeo
    // This would need to be passed through a different mechanism
    // For now, return not implemented for non-LinkedIn enrichments
    return {
      provider: 'prospeo',
      success: false,
      errorMessage: 'Prospeo requires LinkedIn URL - use extension enrichment',
      creditsCost: 0,
      responseTimeMs: Date.now() - startTime,
      data: null,
    }
  },
}

const foragerAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return foragerClient.testConnection(apiKey)
  },
  async enrichLead(apiKey, lead) {
    const startTime = Date.now()

    // Try name + company enrichment if we have enough data
    if (lead.firstName && lead.lastName && lead.company) {
      const result = await foragerClient.enrichByNameAndCompany(
        apiKey,
        lead.firstName,
        lead.lastName,
        lead.company,
      )

      return {
        provider: 'forager',
        success: result.success,
        errorMessage: result.errorMessage ?? null,
        creditsCost: result.creditsUsed,
        responseTimeMs: Date.now() - startTime,
        data: result.success
          ? {
              firstName: result.firstName,
              lastName: result.lastName,
              email: result.email,
              phone: result.phone,
              mobilePhone: result.mobilePhone,
              directDial: result.directDial,
              company: result.company,
              title: result.title,
              location: result.location,
            }
          : null,
      }
    }

    return {
      provider: 'forager',
      success: false,
      errorMessage: 'Forager requires first name, last name, and company',
      creditsCost: 0,
      responseTimeMs: Date.now() - startTime,
      data: null,
    }
  },
}

const leadmagicAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    return leadmagicClient.testConnection(apiKey)
  },
  async enrichLead(apiKey, lead) {
    const startTime = Date.now()

    // LeadMagic requires LinkedIn URL for enrichment
    return {
      provider: 'leadmagic',
      success: false,
      errorMessage:
        'LeadMagic requires LinkedIn URL - use extension enrichment',
      creditsCost: 0,
      responseTimeMs: Date.now() - startTime,
      data: null,
    }
  },
}

const firecrawlAdapter: VendorAdapter = {
  async testConnection(apiKey: string) {
    const result = await firecrawlClient.testConnection(apiKey)
    return {
      ...result,
      creditsRemaining: null, // Firecrawl doesn't expose credits via API
    }
  },
  async enrichLead(apiKey, lead) {
    // Firecrawl is not designed for standard lead enrichment
    // It's for web research tasks with custom extraction schemas
    // Return not supported for standard enrichment flow
    return {
      provider: 'firecrawl' as const,
      success: false,
      errorMessage:
        'Firecrawl is for web research, not standard lead enrichment. Use research tasks instead.',
      creditsCost: 0,
      responseTimeMs: 0,
      data: null,
    }
  },
}

// === Phone Deduplication ===

interface CollectedPhoneNumber {
  rawValue: string
  normalizedValue: string
  type: 'mobile' | 'direct_dial' | 'office'
  source: string
  priority: number // lower = higher priority (from vendor priority)
}

function deduplicatePhones(
  phones: CollectedPhoneNumber[],
): CollectedPhoneNumber[] {
  // Sort by priority first (lower = higher priority)
  const sorted = [...phones].sort((a, b) => a.priority - b.priority)
  const seen = new Map<string, CollectedPhoneNumber>()
  for (const phone of sorted) {
    if (!seen.has(phone.normalizedValue)) {
      seen.set(phone.normalizedValue, phone)
    }
  }
  return Array.from(seen.values())
}

/**
 * Enrich a lead from LinkedIn URL using ALL active vendors in parallel.
 * Collects and deduplicates phone numbers from all vendors.
 */
export async function enrichLeadFromLinkedIn(
  organizationId: string,
  leadId: string,
  linkedInUrl: string,
  options: {
    providers?: DataVendorProvider[]
    dataTypes?: VendorDataType[]
    forceRefresh?: boolean
    requestMode?: 'interactive' | 'bulk'
    contactCoverage?: LeadContactCoverage
  } = {},
): Promise<EnrichLeadResponse & { phoneNumbers?: EnrichedPhoneNumber[] }> {
  const lead = await db
    .selectFrom('lead')
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!lead) {
    throw new Error('Lead not found')
  }

  const requestedDataTypes = normalizeRequestedDataTypes(options.dataTypes)
  const explicitDataTypes = !!options.dataTypes?.length
  const contactOnlyRequest =
    explicitDataTypes &&
    requestedDataTypes.every((type) => CONTACT_DATA_TYPES.includes(type))
  const contactCoverage =
    options.contactCoverage ?? (await getLeadContactCoverage(lead))
  const effectiveDataTypes = contactOnlyRequest
    ? missingRequestedContactTypes(requestedDataTypes, contactCoverage)
    : requestedDataTypes

  if (contactOnlyRequest && effectiveDataTypes.length === 0) {
    return {
      ...buildAlreadyHasRequestedDataResponse(leadId),
      phoneNumbers: [],
    }
  }

  // Get all active enrichment vendor connections, ordered by priority
  let connectionsQuery = db
    .selectFrom('data_vendor_connection')
    .where('organizationId', '=', organizationId)
    .where('isActive', '=', true)
    .where('provider', 'in', ['prospeo', 'forager', 'leadmagic'])

  if (options.providers?.length) {
    connectionsQuery = connectionsQuery.where(
      'provider',
      'in',
      options.providers.filter((provider) =>
        LINKEDIN_ENRICHMENT_PROVIDERS.has(provider),
      ),
    )
  }

  const connections = await connectionsQuery
    .selectAll()
    .orderBy('priority', 'asc')
    .execute()

  if (connections.length === 0) {
    console.log(
      '[Enrichment] No Prospeo, Forager, or LeadMagic connections configured for org:',
      organizationId,
    )
    return {
      leadId,
      success: false,
      providersUsed: [],
      fieldsEnriched: [],
      creditsUsed: 0,
      phoneNumbers: [],
      errorMessage:
        'No data vendors configured. Go to Settings > Data Vendors to add your Prospeo, Forager, or LeadMagic API key.',
    }
  }

  // Filter connections that haven't exceeded their credit limits
  const viableConnections = connections.filter((c) => {
    if (c.creditsLimit && c.creditsUsed >= c.creditsLimit) {
      console.log(`[Enrichment] ${c.provider} credits exhausted, skipping`)
      return false
    }
    return true
  })

  // === Cache check: split connections into cached and uncached ===
  const lookupKey = buildLinkedInLookupKey(linkedInUrl)
  const cachedEntries = options.forceRefresh
    ? []
    : await enrichmentCacheRepo.findValidByLookupKey(lookupKey)
  const cachedByProvider = new Map(cachedEntries.map((e) => [e.provider, e]))

  type VendorResult = {
    connection: (typeof viableConnections)[0]
    result: {
      success: boolean
      email?: string
      phone?: string
      phoneNumbers?: string[]
      firstName?: string
      lastName?: string
      company?: string
      title?: string
      creditsUsed?: number
      errorMessage?: string
    } | null
    success: boolean
    enabledTypes: string[]
  }

  const cachedResults: VendorResult[] = []
  const uncachedConnections: typeof viableConnections = []
  let totalCreditsSaved = 0

  for (const connection of viableConnections) {
    const cached = cachedByProvider.get(connection.provider)
    if (cached) {
      const data = (
        typeof cached.normalizedData === 'string'
          ? JSON.parse(cached.normalizedData)
          : cached.normalizedData
      ) as Record<string, any>

      const cachedHasRequestedData = effectiveDataTypes.some((type) => {
        if (type === 'phone') return !!(data.phone || data.phoneNumbers?.length)
        if (type === 'email') return !!data.email
        return !!(data.firstName || data.lastName || data.company || data.title)
      })

      if (!cachedHasRequestedData) {
        uncachedConnections.push(connection)
        continue
      }

      const enabledTypes = (connection.enabledDataTypes as string[]) ?? [
        'phone',
        'email',
        'profile',
      ]
      cachedResults.push({
        connection,
        result: {
          success: true,
          firstName: data.firstName,
          lastName: data.lastName,
          company: data.company,
          title: data.title,
          phone: data.phone,
          email: data.email,
          phoneNumbers: data.phoneNumbers ?? (data.phone ? [data.phone] : []),
          creditsUsed: 0,
        },
        success: true,
        enabledTypes,
      })
      totalCreditsSaved++

      // Record cache hit
      enrichmentCacheRepo.recordHit(cached.id).catch(() => {})
      await recordEnrichmentHistory(
        organizationId,
        leadId,
        connection.id,
        connection.provider as DataVendorProvider,
        'person',
        effectiveDataTypes,
        Object.keys(data).filter(
          (key) =>
            data[key] &&
            (effectiveDataTypes.includes(key as VendorDataType) ||
              (effectiveDataTypes.includes('profile') &&
                ['firstName', 'lastName', 'company', 'title'].includes(key))),
        ),
        0,
        true,
        null,
        0,
      )

      console.log('[Enrichment] Cache HIT for enrichLeadFromLinkedIn:', {
        provider: connection.provider,
        lookupKey,
      })
    } else {
      uncachedConnections.push(connection)
    }
  }

  // Call only UNCACHED vendors in parallel
  const vendorResults = await Promise.allSettled(
    uncachedConnections.map(async (connection) => {
      const provider = connection.provider as DataVendorProvider
      const apiKey = decrypt(connection.apiKeyEncrypted)
      const startTime = Date.now()
      const enabledTypes = (connection.enabledDataTypes as string[]) ?? [
        'phone',
        'email',
        'profile',
      ]

      try {
        let result: {
          success: boolean
          email?: string
          phone?: string
          phoneNumbers?: string[]
          firstName?: string
          lastName?: string
          company?: string
          title?: string
          creditsUsed?: number
          errorMessage?: string
        }
        result = await executeWithVendorPolicy({
          organizationId,
          provider,
          requestMode: options.requestMode ?? 'interactive',
          estimatedCredits: 1,
          operation: async () => {
            if (provider === 'prospeo') {
              const prospeoResult = await prospeoClient.enrichFromLinkedIn(
                apiKey,
                linkedInUrl,
              )
              return {
                success: prospeoResult.success,
                phone: prospeoResult.phone,
                phoneNumbers: prospeoResult.phoneNumbers,
                email: prospeoResult.email,
                firstName: prospeoResult.firstName,
                lastName: prospeoResult.lastName,
                company: prospeoResult.company,
                title: prospeoResult.title,
                creditsUsed: prospeoResult.success ? 1 : 0,
                errorMessage: prospeoResult.errorMessage,
              }
            }

            if (provider === 'leadmagic') {
              const lmResult = await leadmagicClient.enrichFromLinkedIn(
                apiKey,
                linkedInUrl,
              )
              return {
                success: lmResult.success,
                phone: lmResult.phone,
                email: lmResult.email,
                creditsUsed: lmResult.creditsUsed,
                errorMessage: lmResult.errorMessage,
              }
            }

            const fResult = await foragerClient.enrichFromLinkedIn(
              apiKey,
              linkedInUrl,
            )
            return {
              ...fResult,
              // Forager may return multiple phone fields
              phoneNumbers: [
                fResult.phone,
                fResult.mobilePhone,
                fResult.directDial,
              ].filter(Boolean) as string[],
            }
          },
          classifyResult: classifyVendorResultByMessage,
          extractCreditsUsed: (vendorResult) => vendorResult.creditsUsed ?? 1,
        })

        const responseTimeMs = Date.now() - startTime

        if (!result.success) {
          await recordEnrichmentHistory(
            organizationId,
            leadId,
            connection.id,
            provider,
            'person',
            [],
            [],
            0,
            false,
            result.errorMessage ?? 'Unknown error',
            responseTimeMs,
          )
          return { connection, result, success: false as const, enabledTypes }
        }

        // Record history and update credits
        const enrichedFields: string[] = []
        if (
          effectiveDataTypes.includes('phone') &&
          (result.phone || result.phoneNumbers?.length)
        ) {
          enrichedFields.push('phone')
        }
        if (effectiveDataTypes.includes('email') && result.email) {
          enrichedFields.push('email')
        }
        if (effectiveDataTypes.includes('profile')) {
          if (result.firstName) enrichedFields.push('firstName')
          if (result.lastName) enrichedFields.push('lastName')
          if (result.company) enrichedFields.push('company')
          if (result.title) enrichedFields.push('title')
        }

        await recordEnrichmentHistory(
          organizationId,
          leadId,
          connection.id,
          provider,
          'person',
          effectiveDataTypes,
          enrichedFields,
          result.creditsUsed ?? 1,
          true,
          null,
          responseTimeMs,
        )

        // Update vendor credits
        await db
          .updateTable('data_vendor_connection')
          .set({
            creditsUsed: connection.creditsUsed + (result.creditsUsed ?? 1),
            lastSyncAt: new Date(),
            updatedAt: new Date(),
          })
          .where('id', '=', connection.id)
          .execute()

        // Write to enrichment cache
        enrichmentCacheRepo
          .upsert({
            lookupKey,
            lookupType: 'linkedin',
            provider: connection.provider,
            rawResponse: result,
            normalizedData: {
              firstName: result.firstName,
              lastName: result.lastName,
              email: result.email,
              phone: result.phone,
              phoneNumbers: result.phoneNumbers,
              company: result.company,
              title: result.title,
            },
          })
          .catch((err) =>
            console.error('[Enrichment] Cache write failed:', err),
          )

        return { connection, result, success: true as const, enabledTypes }
      } catch (error) {
        await recordEnrichmentHistory(
          organizationId,
          leadId,
          connection.id,
          provider,
          'person',
          [],
          [],
          0,
          false,
          formatVendorErrorForHistory(error),
          Date.now() - startTime,
        )
        return {
          connection,
          result: null,
          success: false as const,
          enabledTypes,
        }
      }
    }),
  )

  // Merge cached results with fresh vendor results
  const allSettled = [
    ...cachedResults.map((r) => ({ status: 'fulfilled' as const, value: r })),
    ...vendorResults,
  ]

  // Collect results from all vendors (cached + fresh)
  const fieldsEnriched: EnrichLeadResponse['fieldsEnriched'] = []
  const providersUsed: DataVendorProvider[] = []
  let totalCredits = 0
  const allPhones: CollectedPhoneNumber[] = []
  const updateData: Record<string, any> = {}
  const enrichmentSourcesSet = new Set(lead.enrichmentSources || [])

  for (const settled of allSettled) {
    if (settled.status === 'rejected') continue
    const { connection, result, success, enabledTypes } = settled.value
    if (!success || !result) continue

    providersUsed.push(connection.provider as DataVendorProvider)
    totalCredits += result.creditsUsed ?? 1
    enrichmentSourcesSet.add(connection.provider)

    const phoneEnabled =
      enabledTypes.includes('phone') &&
      effectiveDataTypes.includes('phone') &&
      !contactCoverage.hasPhone
    const emailEnabled =
      enabledTypes.includes('email') &&
      effectiveDataTypes.includes('email') &&
      !contactCoverage.hasEmail
    const profileEnabled =
      enabledTypes.includes('profile') && effectiveDataTypes.includes('profile')

    // Collect phone numbers (if phone data type is enabled)
    if (phoneEnabled) {
      // Collect all phone numbers from this vendor
      const phones = result.phoneNumbers?.length
        ? result.phoneNumbers
        : result.phone
          ? [result.phone]
          : []

      for (const rawPhone of phones) {
        const normalized = validateAndNormalizePhone(rawPhone)
        if (normalized) {
          allPhones.push({
            rawValue: rawPhone,
            normalizedValue: normalized,
            type: 'mobile', // Default type
            source: connection.provider,
            priority: connection.priority,
          })
        }
      }
    }

    // Collect email (if email data type is enabled)
    if (emailEnabled && result.email && !updateData.email) {
      updateData.email = result.email
      fieldsEnriched.push({
        field: 'email',
        previousValue: lead.email,
        newValue: result.email,
        source: connection.provider as DataVendorProvider,
        confidence: null,
      })
    }

    // Collect profile data (if profile data type is enabled)
    // Use first successful vendor's profile data (highest priority)
    if (profileEnabled) {
      if (result.firstName && !lead.firstName && !updateData.firstName) {
        updateData.firstName = result.firstName
        fieldsEnriched.push({
          field: 'firstName',
          previousValue: lead.firstName,
          newValue: result.firstName,
          source: connection.provider as DataVendorProvider,
          confidence: null,
        })
      }
      if (result.lastName && !lead.lastName && !updateData.lastName) {
        updateData.lastName = result.lastName
        fieldsEnriched.push({
          field: 'lastName',
          previousValue: lead.lastName,
          newValue: result.lastName,
          source: connection.provider as DataVendorProvider,
          confidence: null,
        })
      }
      if (result.company && !lead.company && !updateData.company) {
        updateData.company = result.company
        fieldsEnriched.push({
          field: 'company',
          previousValue: lead.company,
          newValue: result.company,
          source: connection.provider as DataVendorProvider,
          confidence: null,
        })
      }
      if (result.title && !lead.title && !updateData.title) {
        updateData.title = result.title
        fieldsEnriched.push({
          field: 'title',
          previousValue: lead.title,
          newValue: result.title,
          source: connection.provider as DataVendorProvider,
          confidence: null,
        })
      }
    }
  }

  // Deduplicate phones
  const uniquePhones = deduplicatePhones(allPhones)

  // Set primary phone on lead (first = highest priority vendor)
  if (uniquePhones.length > 0 && !lead.phone) {
    updateData.phone = uniquePhones[0].normalizedValue
    fieldsEnriched.push({
      field: 'phone',
      previousValue: lead.phone,
      newValue: uniquePhones[0].normalizedValue,
      source: uniquePhones[0].source as DataVendorProvider,
      confidence: null,
    })
  }

  // Store ALL unique phones in lead_contact_info
  for (let i = 0; i < uniquePhones.length; i++) {
    const phone = uniquePhones[i]
    await addContactInfo(
      leadId,
      phone.type,
      phone.normalizedValue,
      phone.source,
      i === 0, // First phone is primary
    )
  }

  // Update lead
  if (Object.keys(updateData).length > 0) {
    updateData.enrichmentStatus = 'enriched'
    updateData.enrichmentSources = Array.from(enrichmentSourcesSet)
    updateData.updatedAt = new Date()

    await db
      .updateTable('lead')
      .set(updateData)
      .where('id', '=', leadId)
      .execute()
  }

  // Build phone numbers response
  const phoneNumbers: EnrichedPhoneNumber[] = uniquePhones.map((p, i) => ({
    value: p.normalizedValue,
    type: p.type,
    source: p.source,
    isPrimary: i === 0,
  }))

  // Build detailed error message
  let errorMessage: string | null = null
  if (fieldsEnriched.length === 0) {
    if (providersUsed.length === 0) {
      errorMessage =
        'All data vendors failed to respond. Check your API keys in Settings > Data Vendors.'
    } else {
      errorMessage = `No phone or email found for this profile. Tried: ${providersUsed.join(', ')}`
    }
  }

  console.log('[Enrichment] LinkedIn enrichment complete:', {
    leadId,
    providersUsed,
    fieldsEnriched: fieldsEnriched.map((f) => f.field),
    phoneNumbers: phoneNumbers.length,
    creditsUsed: totalCredits,
    creditsSaved: totalCreditsSaved,
    errorMessage,
  })

  // Fire-and-forget auto CRM sync after successful enrichment
  if (providersUsed.length > 0 && fieldsEnriched.length > 0) {
    crmService
      .autoSyncAfterEnrichment(organizationId, leadId)
      .catch((err) => console.error('[Enrichment] Auto CRM sync failed:', err))
  }

  return {
    leadId,
    success: providersUsed.length > 0 && fieldsEnriched.length > 0,
    providersUsed,
    fieldsEnriched,
    creditsUsed: totalCredits,
    phoneNumbers,
    cacheHit: totalCreditsSaved > 0,
    creditsSaved: totalCreditsSaved,
    errorMessage,
  }
}

function transformConnection(
  connection: any,
  connectedByName: string | null,
): VendorConnectionResponse {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    provider: connection.provider as DataVendorProvider,
    isActive: connection.isActive,
    priority: connection.priority,
    enabledDataTypes: connection.enabledDataTypes ?? [
      'phone',
      'email',
      'profile',
    ],
    creditsUsed: connection.creditsUsed,
    creditsLimit: connection.creditsLimit,
    creditsRemaining: connection.creditsLimit
      ? connection.creditsLimit - connection.creditsUsed
      : null,
    lastSyncAt: connection.lastSyncAt?.toISOString() || null,
    connectedById: connection.connectedById,
    connectedByName,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  }
}

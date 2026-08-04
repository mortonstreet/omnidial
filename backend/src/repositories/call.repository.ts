import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withIdAndTimestamps, withTimestamps, withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface CreateCallInput {
  twilioConfigId: string
  userId: string
  leadId?: string
  campaignId?: string
  twilioCallSid?: string
  fromNumber: string
  toNumber: string
  direction: 'outbound' | 'inbound'
  status?: string
}

export interface UpdateCallInput {
  twilioCallSid?: string
  dialCallSid?: string // Child call SID (Twilio to destination phone)
  conferenceSid?: string // Conference SID for manager listen/whisper/barge
  status?: string
  dispositionId?: string
  duration?: number
  recordingUrl?: string
  recordingSid?: string
  voicemailDropped?: boolean
  voicemailLeft?: boolean
  voicemailReadAt?: Date | null
  answeredAt?: Date
  endedAt?: Date
}

export interface CallFilters {
  twilioConfigId?: string
  userId?: string
  leadId?: string
  campaignId?: string
  direction?: string
  status?: string
  dispositionId?: string | null // null means calls without disposition
  startDate?: Date
  endDate?: Date
}

export const findById = async (id: string) => {
  return db
    .selectFrom('call')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByTwilioCallSid = async (twilioCallSid: string) => {
  return db
    .selectFrom('call')
    .where('twilioCallSid', '=', twilioCallSid)
    .selectAll()
    .executeTakeFirst()
}

export const findByConferenceSid = async (conferenceSid: string) => {
  return db
    .selectFrom('call')
    .where('conferenceSid', '=', conferenceSid)
    .selectAll()
    .executeTakeFirst()
}

// Org-scoped variants for user-facing API routes
export const findByIdForOrg = async (id: string, orgId: string) => {
  return db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('call.id', '=', id)
    .where('twilio_config.organizationId', '=', orgId)
    .selectAll('call')
    .executeTakeFirst()
}

export const findByTwilioCallSidForOrg = async (
  twilioCallSid: string,
  orgId: string,
) => {
  return db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('call.twilioCallSid', '=', twilioCallSid)
    .where('twilio_config.organizationId', '=', orgId)
    .selectAll('call')
    .executeTakeFirst()
}

export const findByConferenceSidForOrg = async (
  conferenceSid: string,
  orgId: string,
) => {
  return db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .where('call.conferenceSid', '=', conferenceSid)
    .where('twilio_config.organizationId', '=', orgId)
    .selectAll('call')
    .executeTakeFirst()
}

export const updateByConferenceSid = async (
  conferenceSid: string,
  data: UpdateCallInput,
) => {
  const record = withTimestamps(data)

  return db
    .updateTable('call')
    .set(record)
    .where('conferenceSid', '=', conferenceSid)
    .returningAll()
    .executeTakeFirst()
}

export const findMany = async (
  filters: CallFilters,
  pagination: DBPagination,
) => {
  // Join with disposition to get label and color, lead to get names, and user for user name
  let query = db
    .selectFrom('call')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .leftJoin('user', 'user.id', 'call.userId')
    .select([
      'call.id',
      'call.twilioConfigId',
      'call.userId',
      'call.leadId',
      'call.campaignId',
      'call.twilioCallSid',
      'call.dialCallSid',
      'call.fromNumber',
      'call.toNumber',
      'call.direction',
      'call.status',
      'call.dispositionId',
      'call.duration',
      'call.recordingUrl',
      'call.recordingSid',
      'call.voicemailDropped',
      'call.startedAt',
      'call.answeredAt',
      'call.endedAt',
      'call.createdAt',
      'call.updatedAt',
      'disposition.label as dispositionLabel',
      'disposition.color as dispositionColor',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'user.name as userName',
    ])

  if (filters.twilioConfigId) {
    query = query.where('call.twilioConfigId', '=', filters.twilioConfigId)
  }
  if (filters.userId) {
    query = query.where('call.userId', '=', filters.userId)
  }
  if (filters.leadId) {
    query = query.where('call.leadId', '=', filters.leadId)
  }
  if (filters.campaignId) {
    query = query.where('call.campaignId', '=', filters.campaignId)
  }
  if (filters.direction) {
    query = query.where('call.direction', '=', filters.direction)
  }
  if (filters.status) {
    query = query.where('call.status', '=', filters.status)
  }
  if (filters.dispositionId !== undefined) {
    if (filters.dispositionId === null) {
      query = query.where('call.dispositionId', 'is', null)
    } else {
      query = query.where('call.dispositionId', '=', filters.dispositionId)
    }
  }
  if (filters.startDate) {
    query = query.where('call.startedAt', '>=', filters.startDate)
  }
  if (filters.endDate) {
    query = query.where('call.startedAt', '<=', filters.endDate)
  }

  query = query.orderBy('call.startedAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  // Get total count
  let countQuery = db.selectFrom('call').select(db.fn.count('id').as('count'))

  if (filters.twilioConfigId) {
    countQuery = countQuery.where('twilioConfigId', '=', filters.twilioConfigId)
  }
  if (filters.userId) {
    countQuery = countQuery.where('userId', '=', filters.userId)
  }
  if (filters.leadId) {
    countQuery = countQuery.where('leadId', '=', filters.leadId)
  }
  if (filters.campaignId) {
    countQuery = countQuery.where('campaignId', '=', filters.campaignId)
  }
  if (filters.direction) {
    countQuery = countQuery.where('direction', '=', filters.direction)
  }
  if (filters.status) {
    countQuery = countQuery.where('status', '=', filters.status)
  }
  if (filters.dispositionId !== undefined) {
    if (filters.dispositionId === null) {
      countQuery = countQuery.where('dispositionId', 'is', null)
    } else {
      countQuery = countQuery.where('dispositionId', '=', filters.dispositionId)
    }
  }
  if (filters.startDate) {
    countQuery = countQuery.where('startedAt', '>=', filters.startDate)
  }
  if (filters.endDate) {
    countQuery = countQuery.where('startedAt', '<=', filters.endDate)
  }

  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.count || 0)

  return { data, total }
}

export const create = async (data: CreateCallInput) => {
  const record = withIdAndTimestamps(
    {
      ...data,
      status: data.status || 'initiated',
      startedAt: new Date(),
    },
    true,
  )

  return db
    .insertInto('call')
    .values(record)
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const update = async (id: string, data: UpdateCallInput) => {
  const record = withTimestamps(data)

  return db
    .updateTable('call')
    .set(record)
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const updateForOrg = async (
  id: string,
  orgId: string,
  data: UpdateCallInput,
) => {
  const call = await findByIdForOrg(id, orgId)
  if (!call) {
    return null
  }

  return update(id, data)
}

export const updateByTwilioCallSid = async (
  twilioCallSid: string,
  data: UpdateCallInput,
) => {
  const record = withTimestamps(data)

  return db
    .updateTable('call')
    .set(record)
    .where('twilioCallSid', '=', twilioCallSid)
    .returningAll()
    .executeTakeFirst()
}

// Simple find all calls by lead ID (for activity timeline)
export const findAllByLeadId = async (leadId: string) => {
  return db
    .selectFrom('call')
    .where('leadId', '=', leadId)
    .orderBy('startedAt', 'desc')
    .selectAll()
    .execute()
}

export const findByLeadId = async (
  leadId: string,
  pagination: DBPagination,
) => {
  const query = db
    .selectFrom('call')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .where('call.leadId', '=', leadId)
    .select([
      'call.id',
      'call.userId',
      'call.leadId',
      'call.campaignId',
      'call.fromNumber',
      'call.toNumber',
      'call.direction',
      'call.status',
      'call.duration',
      'call.recordingUrl',
      'call.voicemailDropped',
      'call.startedAt',
      'call.answeredAt',
      'call.endedAt',
      'call.createdAt',
      'disposition.id as dispositionId',
      'disposition.label as dispositionLabel',
      'disposition.color as dispositionColor',
    ])
    .orderBy('call.startedAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  const countResult = await db
    .selectFrom('call')
    .where('leadId', '=', leadId)
    .select(db.fn.count('id').as('count'))
    .executeTakeFirst()

  const total = Number(countResult?.count || 0)

  return { data, total }
}

/**
 * Link orphaned calls (calls with no leadId) to a lead by matching phone number.
 * Handles inbound calls where fromNumber matches, and outbound calls where toNumber matches.
 * Scoped to a specific twilioConfigId to ensure org-level isolation.
 */
export const linkOrphanedCallsByPhone = async (
  leadId: string,
  phone: string,
  twilioConfigId: string,
) => {
  const digitsOnly = phone.replace(/\D/g, '')
  const last10 = digitsOnly.slice(-10)

  if (!last10 || last10.length < 10) return 0

  const result = await db
    .updateTable('call')
    .set({ leadId, updatedAt: new Date() })
    .where('leadId', 'is', null)
    .where('twilioConfigId', '=', twilioConfigId)
    .where((eb) =>
      eb.or([
        // Inbound: caller's fromNumber matches lead's phone
        eb.and([
          eb('direction', '=', 'inbound'),
          eb.or([
            sql<boolean>`regexp_replace("fromNumber", '[^0-9]', '', 'g') = ${digitsOnly}`,
            sql<boolean>`RIGHT(regexp_replace("fromNumber", '[^0-9]', '', 'g'), 10) = ${last10}`,
          ]),
        ]),
        // Outbound: destination toNumber matches lead's phone
        eb.and([
          eb('direction', '=', 'outbound'),
          eb.or([
            sql<boolean>`regexp_replace("toNumber", '[^0-9]', '', 'g') = ${digitsOnly}`,
            sql<boolean>`RIGHT(regexp_replace("toNumber", '[^0-9]', '', 'g'), 10) = ${last10}`,
          ]),
        ]),
      ]),
    )
    .executeTakeFirst()

  const linked = Number(result?.numUpdatedRows || 0)
  if (linked > 0) {
    console.log(
      `Linked ${linked} orphaned call(s) to lead ${leadId} by phone ${phone}`,
    )
  }
  return linked
}

// === Voicemail Inbox ===

export const findVoicemails = async (
  twilioConfigId: string,
  filters: { unreadOnly?: boolean },
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('call')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .where('call.twilioConfigId', '=', twilioConfigId)
    .where('call.voicemailLeft', '=', true)
    .where('call.recordingUrl', 'is not', null)
    .select([
      'call.id',
      'call.fromNumber',
      'call.toNumber',
      'call.recordingUrl',
      'call.recordingSid',
      'call.duration',
      'call.voicemailReadAt',
      'call.startedAt',
      'call.createdAt',
      'call.leadId',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
    ])

  if (filters.unreadOnly) {
    query = query.where('call.voicemailReadAt', 'is', null)
  }

  query = query.orderBy('call.startedAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  // Get total count
  let countQuery = db
    .selectFrom('call')
    .select(db.fn.count('id').as('count'))
    .where('twilioConfigId', '=', twilioConfigId)
    .where('voicemailLeft', '=', true)
    .where('recordingUrl', 'is not', null)

  if (filters.unreadOnly) {
    countQuery = countQuery.where('voicemailReadAt', 'is', null)
  }

  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.count || 0)

  // Get unread count
  const unreadResult = await db
    .selectFrom('call')
    .select(db.fn.count('id').as('count'))
    .where('twilioConfigId', '=', twilioConfigId)
    .where('voicemailLeft', '=', true)
    .where('recordingUrl', 'is not', null)
    .where('voicemailReadAt', 'is', null)
    .executeTakeFirst()
  const unreadCount = Number(unreadResult?.count || 0)

  return { data, total, unreadCount }
}

export const markVoicemailRead = async (id: string) => {
  return db
    .updateTable('call')
    .set(withTimestamps({ voicemailReadAt: new Date() }))
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const markVoicemailReadForOrg = async (id: string, orgId: string) => {
  const call = await findByIdForOrg(id, orgId)
  if (!call) {
    return null
  }

  return markVoicemailRead(id)
}

export const markAllVoicemailsRead = async (twilioConfigId: string) => {
  const result = await db
    .updateTable('call')
    .set(withTimestamps({ voicemailReadAt: new Date() }))
    .where('twilioConfigId', '=', twilioConfigId)
    .where('voicemailLeft', '=', true)
    .where('voicemailReadAt', 'is', null)
    .executeTakeFirst()

  return Number(result?.numUpdatedRows || 0)
}

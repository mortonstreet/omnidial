import { db } from '@/lib/db'
import { withPagination } from './utils'
import { DBPagination } from '@shared/db/src/types'

export interface AdminCallFilters {
  status?: string
  direction?: string
  organizationId?: string
  userId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export const findCallsAdmin = async (
  filters: AdminCallFilters,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .innerJoin(
      'organization',
      'organization.id',
      'twilio_config.organizationId',
    )
    .leftJoin('user', 'user.id', 'call.userId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .select([
      'call.id',
      'call.twilioCallSid',
      'call.dialCallSid',
      'call.conferenceSid',
      'call.fromNumber',
      'call.toNumber',
      'call.direction',
      'call.status',
      'call.duration',
      'call.recordingUrl',
      'call.recordingSid',
      'call.voicemailDropped',
      'call.startedAt',
      'call.answeredAt',
      'call.endedAt',
      'call.createdAt',
      'user.name as userName',
      'organization.name as organizationName',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'disposition.label as dispositionLabel',
      'disposition.color as dispositionColor',
    ])

  if (filters.status) {
    query = query.where('call.status', '=', filters.status)
  }
  if (filters.direction) {
    query = query.where('call.direction', '=', filters.direction)
  }
  if (filters.organizationId) {
    query = query.where(
      'twilio_config.organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.userId) {
    query = query.where('call.userId', '=', filters.userId)
  }
  if (filters.startDate) {
    query = query.where('call.startedAt', '>=', new Date(filters.startDate))
  }
  if (filters.endDate) {
    query = query.where('call.startedAt', '<=', new Date(filters.endDate))
  }
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.where((eb) =>
      eb.or([
        eb('call.fromNumber', 'ilike', searchTerm),
        eb('call.toNumber', 'ilike', searchTerm),
        eb('call.twilioCallSid', 'ilike', searchTerm),
      ]),
    )
  }

  query = query.orderBy('call.startedAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  // Count query
  let countQuery = db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .select(db.fn.count('call.id').as('count'))

  if (filters.status) {
    countQuery = countQuery.where('call.status', '=', filters.status)
  }
  if (filters.direction) {
    countQuery = countQuery.where('call.direction', '=', filters.direction)
  }
  if (filters.organizationId) {
    countQuery = countQuery.where(
      'twilio_config.organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.userId) {
    countQuery = countQuery.where('call.userId', '=', filters.userId)
  }
  if (filters.startDate) {
    countQuery = countQuery.where(
      'call.startedAt',
      '>=',
      new Date(filters.startDate),
    )
  }
  if (filters.endDate) {
    countQuery = countQuery.where(
      'call.startedAt',
      '<=',
      new Date(filters.endDate),
    )
  }
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('call.fromNumber', 'ilike', searchTerm),
        eb('call.toNumber', 'ilike', searchTerm),
        eb('call.twilioCallSid', 'ilike', searchTerm),
      ]),
    )
  }

  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.count || 0)

  return { data, total }
}

export const findCallDetailAdmin = async (callId: string) => {
  const call = await db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .innerJoin(
      'organization',
      'organization.id',
      'twilio_config.organizationId',
    )
    .leftJoin('user', 'user.id', 'call.userId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .select([
      'call.id',
      'call.twilioCallSid',
      'call.dialCallSid',
      'call.conferenceSid',
      'call.fromNumber',
      'call.toNumber',
      'call.direction',
      'call.status',
      'call.duration',
      'call.recordingUrl',
      'call.recordingSid',
      'call.voicemailDropped',
      'call.startedAt',
      'call.answeredAt',
      'call.endedAt',
      'call.createdAt',
      'user.name as userName',
      'organization.name as organizationName',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'disposition.label as dispositionLabel',
      'disposition.color as dispositionColor',
    ])
    .where('call.id', '=', callId)
    .executeTakeFirst()

  if (!call) return null

  const transcript = await db
    .selectFrom('call_transcript')
    .select(['transcriptText', 'speakerLabels', 'durationSeconds', 'language'])
    .where('callId', '=', callId)
    .executeTakeFirst()

  const coaching = await db
    .selectFrom('call_coaching')
    .select(['overallScore', 'strengths', 'improvements', 'feedback'])
    .where('callId', '=', callId)
    .executeTakeFirst()

  return { ...call, transcript: transcript ?? null, coaching: coaching ?? null }
}

export const findRecordingsAdmin = async (
  filters: Omit<AdminCallFilters, 'direction'>,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .innerJoin(
      'organization',
      'organization.id',
      'twilio_config.organizationId',
    )
    .leftJoin('user', 'user.id', 'call.userId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .select([
      'call.id',
      'call.twilioCallSid',
      'call.fromNumber',
      'call.toNumber',
      'call.direction',
      'call.status',
      'call.duration',
      'call.recordingUrl',
      'call.recordingSid',
      'call.startedAt',
      'call.createdAt',
      'user.name as userName',
      'organization.name as organizationName',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
    ])
    .where('call.recordingUrl', 'is not', null)

  if (filters.status) {
    query = query.where('call.status', '=', filters.status)
  }
  if (filters.organizationId) {
    query = query.where(
      'twilio_config.organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.userId) {
    query = query.where('call.userId', '=', filters.userId)
  }
  if (filters.startDate) {
    query = query.where('call.startedAt', '>=', new Date(filters.startDate))
  }
  if (filters.endDate) {
    query = query.where('call.startedAt', '<=', new Date(filters.endDate))
  }
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.where((eb) =>
      eb.or([
        eb('call.fromNumber', 'ilike', searchTerm),
        eb('call.toNumber', 'ilike', searchTerm),
        eb('call.twilioCallSid', 'ilike', searchTerm),
      ]),
    )
  }

  query = query.orderBy('call.startedAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  // Count query
  let countQuery = db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .select(db.fn.count('call.id').as('count'))
    .where('call.recordingUrl', 'is not', null)

  if (filters.status) {
    countQuery = countQuery.where('call.status', '=', filters.status)
  }
  if (filters.organizationId) {
    countQuery = countQuery.where(
      'twilio_config.organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.userId) {
    countQuery = countQuery.where('call.userId', '=', filters.userId)
  }
  if (filters.startDate) {
    countQuery = countQuery.where(
      'call.startedAt',
      '>=',
      new Date(filters.startDate),
    )
  }
  if (filters.endDate) {
    countQuery = countQuery.where(
      'call.startedAt',
      '<=',
      new Date(filters.endDate),
    )
  }
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    countQuery = countQuery.where((eb) =>
      eb.or([
        eb('call.fromNumber', 'ilike', searchTerm),
        eb('call.toNumber', 'ilike', searchTerm),
        eb('call.twilioCallSid', 'ilike', searchTerm),
      ]),
    )
  }

  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.count || 0)

  return { data, total }
}

export interface AdminTranscriptionFilters {
  organizationId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export const findTranscriptionsAdmin = async (
  filters: AdminTranscriptionFilters,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('call_transcript')
    .innerJoin('call', 'call.id', 'call_transcript.callId')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .innerJoin(
      'organization',
      'organization.id',
      'twilio_config.organizationId',
    )
    .leftJoin('user', 'user.id', 'call.userId')
    .select([
      'call_transcript.id',
      'call_transcript.callId',
      'call_transcript.transcriptText',
      'call_transcript.durationSeconds',
      'call_transcript.language',
      'call_transcript.createdAt',
      'user.name as userName',
      'organization.name as organizationName',
      'call.fromNumber',
      'call.toNumber',
      'call.startedAt',
    ])

  if (filters.organizationId) {
    query = query.where(
      'twilio_config.organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.startDate) {
    query = query.where('call.startedAt', '>=', new Date(filters.startDate))
  }
  if (filters.endDate) {
    query = query.where('call.startedAt', '<=', new Date(filters.endDate))
  }
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    query = query.where('call_transcript.transcriptText', 'ilike', searchTerm)
  }

  query = query.orderBy('call_transcript.createdAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  // Count query
  let countQuery = db
    .selectFrom('call_transcript')
    .innerJoin('call', 'call.id', 'call_transcript.callId')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .select(db.fn.count('call_transcript.id').as('count'))

  if (filters.organizationId) {
    countQuery = countQuery.where(
      'twilio_config.organizationId',
      '=',
      filters.organizationId,
    )
  }
  if (filters.startDate) {
    countQuery = countQuery.where(
      'call.startedAt',
      '>=',
      new Date(filters.startDate),
    )
  }
  if (filters.endDate) {
    countQuery = countQuery.where(
      'call.startedAt',
      '<=',
      new Date(filters.endDate),
    )
  }
  if (filters.search) {
    const searchTerm = `%${filters.search}%`
    countQuery = countQuery.where(
      'call_transcript.transcriptText',
      'ilike',
      searchTerm,
    )
  }

  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.count || 0)

  return { data, total }
}

export const findTranscriptionDetailAdmin = async (id: string) => {
  return db
    .selectFrom('call_transcript')
    .innerJoin('call', 'call.id', 'call_transcript.callId')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .innerJoin(
      'organization',
      'organization.id',
      'twilio_config.organizationId',
    )
    .leftJoin('user', 'user.id', 'call.userId')
    .select([
      'call_transcript.id',
      'call_transcript.callId',
      'call_transcript.transcriptText',
      'call_transcript.speakerLabels',
      'call_transcript.durationSeconds',
      'call_transcript.language',
      'call_transcript.createdAt',
      'user.name as userName',
      'organization.name as organizationName',
      'call.fromNumber',
      'call.toNumber',
      'call.startedAt',
    ])
    .where('call_transcript.id', '=', id)
    .executeTakeFirst()
}

export interface AdminActivityFilters {
  organizationId?: string
  userId?: string
  type?: string
  startDate?: string
  endDate?: string
}

export const findActivityAdmin = async (
  filters: AdminActivityFilters,
  pagination: DBPagination,
) => {
  let query = db
    .selectFrom('activity')
    .innerJoin('organization', 'organization.id', 'activity.organizationId')
    .leftJoin('user', 'user.id', 'activity.userId')
    .select([
      'activity.id',
      'activity.type',
      'activity.description',
      'activity.metadata',
      'activity.createdAt',
      'user.name as userName',
      'organization.name as organizationName',
    ])

  if (filters.organizationId) {
    query = query.where('activity.organizationId', '=', filters.organizationId)
  }
  if (filters.userId) {
    query = query.where('activity.userId', '=', filters.userId)
  }
  if (filters.type) {
    query = query.where('activity.type', '=', filters.type)
  }
  if (filters.startDate) {
    query = query.where('activity.createdAt', '>=', new Date(filters.startDate))
  }
  if (filters.endDate) {
    query = query.where('activity.createdAt', '<=', new Date(filters.endDate))
  }

  query = query.orderBy('activity.createdAt', 'desc')

  const data = await withPagination(pagination, query).execute()

  // Count query
  let countQuery = db
    .selectFrom('activity')
    .select(db.fn.count('id').as('count'))

  if (filters.organizationId) {
    countQuery = countQuery.where('organizationId', '=', filters.organizationId)
  }
  if (filters.userId) {
    countQuery = countQuery.where('userId', '=', filters.userId)
  }
  if (filters.type) {
    countQuery = countQuery.where('type', '=', filters.type)
  }
  if (filters.startDate) {
    countQuery = countQuery.where(
      'createdAt',
      '>=',
      new Date(filters.startDate),
    )
  }
  if (filters.endDate) {
    countQuery = countQuery.where('createdAt', '<=', new Date(filters.endDate))
  }

  const countResult = await countQuery.executeTakeFirst()
  const total = Number(countResult?.count || 0)

  return { data, total }
}

import * as adminLogRepository from '@/repositories/adminLog.repository'
import type {
  GetAdminCallsResponse,
  AdminCallItem,
  AdminCallDetail,
  GetAdminRecordingsResponse,
  AdminRecordingItem,
  GetAdminTranscriptionsResponse,
  AdminTranscriptionItem,
  AdminTranscriptionDetail,
  GetAdminActivityResponse,
  AdminActivityItem,
} from '@shared/types/src'

// ============================================================================
// Calls
// ============================================================================

export interface GetAdminCallsParams {
  page: number
  limit: number
  status?: string
  direction?: string
  organizationId?: string
  userId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export const getAdminCalls = async (
  params: GetAdminCallsParams,
): Promise<GetAdminCallsResponse> => {
  const { page, limit, ...filters } = params
  const { data, total } = await adminLogRepository.findCallsAdmin(filters, {
    page,
    limit,
    offset: 0,
  })

  const items: AdminCallItem[] = data.map((row) => ({
    id: row.id,
    twilioCallSid: row.twilioCallSid,
    dialCallSid: row.dialCallSid,
    conferenceSid: row.conferenceSid,
    fromNumber: row.fromNumber,
    toNumber: row.toNumber,
    direction: row.direction,
    status: row.status,
    duration: row.duration,
    recordingUrl: row.recordingUrl,
    recordingSid: row.recordingSid,
    voicemailDropped: row.voicemailDropped,
    userName: row.userName,
    organizationName: row.organizationName,
    leadFirstName: row.leadFirstName,
    leadLastName: row.leadLastName,
    dispositionLabel: row.dispositionLabel,
    dispositionColor: row.dispositionColor,
    startedAt: row.startedAt ? (row.startedAt as Date).toISOString() : null,
    answeredAt: row.answeredAt ? (row.answeredAt as Date).toISOString() : null,
    endedAt: row.endedAt ? (row.endedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }))

  const totalPages = Math.ceil(total / limit)

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

// ============================================================================
// Call Detail
// ============================================================================

export const getAdminCallDetail = async (
  id: string,
): Promise<AdminCallDetail | null> => {
  const result = await adminLogRepository.findCallDetailAdmin(id)
  if (!result) return null

  return {
    id: result.id,
    twilioCallSid: result.twilioCallSid,
    dialCallSid: result.dialCallSid,
    conferenceSid: result.conferenceSid,
    fromNumber: result.fromNumber,
    toNumber: result.toNumber,
    direction: result.direction,
    status: result.status,
    duration: result.duration,
    recordingUrl: result.recordingUrl,
    recordingSid: result.recordingSid,
    voicemailDropped: result.voicemailDropped,
    userName: result.userName,
    organizationName: result.organizationName,
    leadFirstName: result.leadFirstName,
    leadLastName: result.leadLastName,
    dispositionLabel: result.dispositionLabel,
    dispositionColor: result.dispositionColor,
    startedAt: result.startedAt
      ? (result.startedAt as Date).toISOString()
      : null,
    answeredAt: result.answeredAt
      ? (result.answeredAt as Date).toISOString()
      : null,
    endedAt: result.endedAt ? (result.endedAt as Date).toISOString() : null,
    createdAt: (result.createdAt as Date).toISOString(),
    transcript: result.transcript
      ? {
          transcriptText: result.transcript.transcriptText,
          speakerLabels: result.transcript.speakerLabels,
          durationSeconds: result.transcript.durationSeconds,
          language: result.transcript.language,
        }
      : null,
    coaching: result.coaching
      ? {
          overallScore: result.coaching.overallScore,
          strengths: result.coaching.strengths as string[],
          improvements: result.coaching.improvements as string[],
          feedback: result.coaching.feedback,
        }
      : null,
  }
}

// ============================================================================
// Recordings
// ============================================================================

export interface GetAdminRecordingsParams {
  page: number
  limit: number
  status?: string
  organizationId?: string
  userId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export const getAdminRecordings = async (
  params: GetAdminRecordingsParams,
): Promise<GetAdminRecordingsResponse> => {
  const { page, limit, ...filters } = params
  const { data, total } = await adminLogRepository.findRecordingsAdmin(
    filters,
    { page, limit, offset: 0 },
  )

  const items: AdminRecordingItem[] = data.map((row) => ({
    id: row.id,
    twilioCallSid: row.twilioCallSid,
    fromNumber: row.fromNumber,
    toNumber: row.toNumber,
    direction: row.direction,
    status: row.status,
    duration: row.duration,
    recordingUrl: row.recordingUrl,
    recordingSid: row.recordingSid,
    userName: row.userName,
    organizationName: row.organizationName,
    leadFirstName: row.leadFirstName,
    leadLastName: row.leadLastName,
    startedAt: row.startedAt ? (row.startedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }))

  const totalPages = Math.ceil(total / limit)

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

// ============================================================================
// Transcriptions
// ============================================================================

export interface GetAdminTranscriptionsParams {
  page: number
  limit: number
  organizationId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export const getAdminTranscriptions = async (
  params: GetAdminTranscriptionsParams,
): Promise<GetAdminTranscriptionsResponse> => {
  const { page, limit, ...filters } = params
  const { data, total } = await adminLogRepository.findTranscriptionsAdmin(
    filters,
    { page, limit, offset: 0 },
  )

  const items: AdminTranscriptionItem[] = data.map((row) => ({
    id: row.id,
    callId: row.callId,
    transcriptPreview: row.transcriptText
      ? row.transcriptText.substring(0, 200)
      : '',
    durationSeconds: row.durationSeconds,
    language: row.language,
    userName: row.userName,
    organizationName: row.organizationName,
    fromNumber: row.fromNumber,
    toNumber: row.toNumber,
    startedAt: row.startedAt ? (row.startedAt as Date).toISOString() : null,
    createdAt: (row.createdAt as Date).toISOString(),
  }))

  const totalPages = Math.ceil(total / limit)

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

export const getAdminTranscriptionDetail = async (
  id: string,
): Promise<AdminTranscriptionDetail | null> => {
  const result = await adminLogRepository.findTranscriptionDetailAdmin(id)
  if (!result) return null

  return {
    id: result.id,
    callId: result.callId,
    transcriptText: result.transcriptText,
    speakerLabels: result.speakerLabels,
    durationSeconds: result.durationSeconds,
    language: result.language,
    userName: result.userName,
    organizationName: result.organizationName,
    fromNumber: result.fromNumber,
    toNumber: result.toNumber,
    startedAt: result.startedAt
      ? (result.startedAt as Date).toISOString()
      : null,
    createdAt: (result.createdAt as Date).toISOString(),
  }
}

// ============================================================================
// Activity
// ============================================================================

export interface GetAdminActivityParams {
  page: number
  limit: number
  organizationId?: string
  userId?: string
  type?: string
  startDate?: string
  endDate?: string
}

export const getAdminActivity = async (
  params: GetAdminActivityParams,
): Promise<GetAdminActivityResponse> => {
  const { page, limit, ...filters } = params
  const { data, total } = await adminLogRepository.findActivityAdmin(filters, {
    page,
    limit,
    offset: 0,
  })

  const items: AdminActivityItem[] = data.map((row) => ({
    id: row.id,
    type: row.type,
    description: row.description,
    userName: row.userName,
    organizationName: row.organizationName,
    metadata: row.metadata,
    createdAt: (row.createdAt as Date).toISOString(),
  }))

  const totalPages = Math.ceil(total / limit)

  return {
    data: items,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  }
}

import { db } from '@/lib/db'
import { withIdAndTimestamps } from './utils'

// Types
export interface CreateTranscriptInput {
  callId: string
  organizationId: string
  transcriptText: string
  transcriptSource?: string
  speakerLabels?: unknown[]
  durationSeconds?: number
  language?: string
}

export interface CreateCoachingInput {
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  overallScore: number
  unhingedQuote?: string | null
  strengths: string[]
  improvements: string[]
  feedback: unknown
  modelUsed?: string
  tokensUsed?: number
  analysisTimeMs?: number
}

export interface TranscriptWithCoaching {
  id: string
  callId: string
  organizationId: string
  transcriptText: string
  transcriptSource: string
  speakerLabels: unknown
  durationSeconds: number
  language: string
  createdAt: Date
  updatedAt: Date
}

export interface CoachingWithTranscript {
  id: string
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  overallScore: number
  unhingedQuote: string | null
  strengths: string[]
  improvements: string[]
  feedback: unknown
  modelUsed: string
  tokensUsed: number
  analysisTimeMs: number
  createdAt: Date
  updatedAt: Date
}

export interface CoachingWithLead extends CoachingWithTranscript {
  leadId: string | null
  leadFirstName: string | null
  leadLastName: string | null
  leadCompany: string | null
}

// Transcript Repository Functions
export async function createTranscript(
  input: CreateTranscriptInput,
): Promise<TranscriptWithCoaching> {
  const result = await db
    .insertInto('call_transcript')
    .values(
      withIdAndTimestamps({
        callId: input.callId,
        organizationId: input.organizationId,
        transcriptText: input.transcriptText,
        transcriptSource: input.transcriptSource || 'twilio',
        speakerLabels: JSON.stringify(input.speakerLabels || []),
        durationSeconds: input.durationSeconds || 0,
        language: input.language || 'en-US',
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()

  return result as TranscriptWithCoaching
}

export async function findTranscriptByCallId(
  callId: string,
  organizationId: string,
): Promise<TranscriptWithCoaching | null> {
  const result = await db
    .selectFrom('call_transcript')
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  return result as TranscriptWithCoaching | null
}

export async function deleteTranscript(
  callId: string,
  organizationId: string,
): Promise<void> {
  await db
    .deleteFrom('call_transcript')
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .execute()
}

export interface UpdateTranscriptInput {
  transcriptText: string
  transcriptSource: string
  speakerLabels?: unknown[]
  durationSeconds?: number
  language?: string
}

export async function updateTranscript(
  callId: string,
  organizationId: string,
  input: UpdateTranscriptInput,
): Promise<TranscriptWithCoaching> {
  const result = await db
    .updateTable('call_transcript')
    .set({
      transcriptText: input.transcriptText,
      transcriptSource: input.transcriptSource,
      speakerLabels: JSON.stringify(input.speakerLabels || []),
      durationSeconds: input.durationSeconds,
      language: input.language || 'en-US',
      updatedAt: new Date(),
    })
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .returningAll()
    .executeTakeFirstOrThrow()

  return result as TranscriptWithCoaching
}

// Coaching Repository Functions
export async function createCoaching(
  input: CreateCoachingInput,
): Promise<CoachingWithTranscript> {
  const result = await db
    .insertInto('call_coaching')
    .values(
      withIdAndTimestamps({
        callId: input.callId,
        transcriptId: input.transcriptId,
        organizationId: input.organizationId,
        userId: input.userId,
        overallScore: input.overallScore,
        unhingedQuote: input.unhingedQuote,
        strengths: input.strengths,
        improvements: input.improvements,
        feedback: JSON.stringify(input.feedback),
        modelUsed: input.modelUsed || 'claude-3-sonnet',
        tokensUsed: input.tokensUsed || 0,
        analysisTimeMs: input.analysisTimeMs || 0,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()

  return result as CoachingWithTranscript
}

export async function findCoachingByCallId(
  callId: string,
  organizationId: string,
): Promise<CoachingWithTranscript | null> {
  const result = await db
    .selectFrom('call_coaching')
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  return result as CoachingWithTranscript | null
}

export async function findCoachingByUserId(
  userId: string,
  organizationId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<CoachingWithTranscript[]> {
  let query = db
    .selectFrom('call_coaching')
    .where('userId', '=', userId)
    .where('organizationId', '=', organizationId)
    .orderBy('createdAt', 'desc')

  if (options.limit) {
    query = query.limit(options.limit)
  }
  if (options.offset) {
    query = query.offset(options.offset)
  }

  const results = await query.selectAll().execute()
  return results as CoachingWithTranscript[]
}

export async function findRecentCoaching(
  organizationId: string,
  options: {
    limit?: number
    offset?: number
    minScore?: number
    maxScore?: number
  } = {},
): Promise<CoachingWithLead[]> {
  let query = db
    .selectFrom('call_coaching')
    .leftJoin('call', 'call.id', 'call_coaching.callId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .where('call_coaching.organizationId', '=', organizationId)
    .orderBy('call_coaching.createdAt', 'desc')

  if (options.minScore !== undefined) {
    query = query.where('call_coaching.overallScore', '>=', options.minScore)
  }
  if (options.maxScore !== undefined) {
    query = query.where('call_coaching.overallScore', '<=', options.maxScore)
  }
  if (options.limit) {
    query = query.limit(options.limit)
  }
  if (options.offset) {
    query = query.offset(options.offset)
  }

  const results = await query
    .select([
      'call_coaching.id',
      'call_coaching.callId',
      'call_coaching.transcriptId',
      'call_coaching.organizationId',
      'call_coaching.userId',
      'call_coaching.overallScore',
      'call_coaching.unhingedQuote',
      'call_coaching.strengths',
      'call_coaching.improvements',
      'call_coaching.feedback',
      'call_coaching.modelUsed',
      'call_coaching.tokensUsed',
      'call_coaching.analysisTimeMs',
      'call_coaching.createdAt',
      'call_coaching.updatedAt',
      'lead.id as leadId',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.company as leadCompany',
    ])
    .execute()

  return results as CoachingWithLead[]
}

export async function deleteCoaching(
  callId: string,
  organizationId: string,
): Promise<void> {
  await db
    .deleteFrom('call_coaching')
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .execute()
}

export async function findCoachingByLeadId(
  leadId: string,
  organizationId: string,
  options: {
    limit?: number
    offset?: number
    minScore?: number
    maxScore?: number
  } = {},
): Promise<CoachingWithLead[]> {
  let query = db
    .selectFrom('call_coaching')
    .innerJoin('call', 'call.id', 'call_coaching.callId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .where('call_coaching.organizationId', '=', organizationId)
    .where('call.leadId', '=', leadId)
    .orderBy('call_coaching.createdAt', 'desc')

  if (options.minScore !== undefined) {
    query = query.where('call_coaching.overallScore', '>=', options.minScore)
  }
  if (options.maxScore !== undefined) {
    query = query.where('call_coaching.overallScore', '<=', options.maxScore)
  }
  if (options.limit) {
    query = query.limit(options.limit)
  }
  if (options.offset) {
    query = query.offset(options.offset)
  }

  const results = await query
    .select([
      'call_coaching.id',
      'call_coaching.callId',
      'call_coaching.transcriptId',
      'call_coaching.organizationId',
      'call_coaching.userId',
      'call_coaching.overallScore',
      'call_coaching.unhingedQuote',
      'call_coaching.strengths',
      'call_coaching.improvements',
      'call_coaching.feedback',
      'call_coaching.modelUsed',
      'call_coaching.tokensUsed',
      'call_coaching.analysisTimeMs',
      'call_coaching.createdAt',
      'call_coaching.updatedAt',
      'lead.id as leadId',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.company as leadCompany',
    ])
    .execute()

  return results as CoachingWithLead[]
}

export async function getCoachingStats(
  organizationId: string,
  userId?: string,
): Promise<{
  totalCoached: number
  averageScore: number
  scoreDistribution: Record<string, number>
}> {
  let query = db
    .selectFrom('call_coaching')
    .where('organizationId', '=', organizationId)

  if (userId) {
    query = query.where('userId', '=', userId)
  }

  const results = await query.select('overallScore').execute()

  const totalCoached = results.length
  const averageScore =
    totalCoached > 0
      ? results.reduce((sum, r) => sum + r.overallScore, 0) / totalCoached
      : 0

  const scoreDistribution: Record<string, number> = {}
  for (const r of results) {
    const bucket = `${Math.floor(r.overallScore)}`
    scoreDistribution[bucket] = (scoreDistribution[bucket] || 0) + 1
  }

  return {
    totalCoached,
    averageScore: Math.round(averageScore * 10) / 10,
    scoreDistribution,
  }
}

// Excluded dispositions for coaching eligibility
const EXCLUDED_DISPOSITION_LABELS = [
  'no answer',
  'voicemail',
  'busy',
  'wrong number',
  'disconnected',
  'left voicemail',
]

export interface EligibleCallForCoaching {
  id: string
  leadId: string | null
  leadName: string | null
  leadCompany: string | null
  phoneNumber: string
  duration: number
  direction: string
  recordingUrl: string
  createdAt: Date
  userId: string
  userName: string | null
}

/**
 * Find calls that are eligible for coaching but haven't been coached yet
 */
export async function findUncoachedCalls(
  organizationId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<EligibleCallForCoaching[]> {
  const minDurationSeconds = 60

  // Get all call IDs that already have coaching
  const coachedCallIds = await db
    .selectFrom('call_coaching')
    .where('organizationId', '=', organizationId)
    .select('callId')
    .execute()

  const coachedCallIdSet = new Set(coachedCallIds.map((c) => c.callId))

  // Build the query for eligible calls
  let query = db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .leftJoin('user', 'user.id', 'call.userId')
    .where('twilio_config.organizationId', '=', organizationId)
    .where('call.recordingUrl', 'is not', null)
    .where('call.duration', '>=', minDurationSeconds)
    .where((eb) =>
      eb.or([
        eb('call.answeredAt', 'is not', null),
        eb('call.status', '=', 'completed'),
      ]),
    )
    .orderBy('call.createdAt', 'desc')
    .select([
      'call.id',
      'call.leadId',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.company as leadCompany',
      'call.toNumber',
      'call.duration',
      'call.direction',
      'call.recordingUrl',
      'call.createdAt',
      'call.userId',
      'user.name as userName',
      'disposition.label as dispositionLabel',
    ])

  if (options.limit) {
    query = query.limit(options.limit + 50) // Get extra to filter out coached ones
  }

  const results = await query.execute()

  // Filter out coached calls and excluded dispositions in memory
  const eligibleCalls: EligibleCallForCoaching[] = []
  for (const call of results) {
    const callId = call.id as string
    if (coachedCallIdSet.has(callId)) {
      continue
    }

    // Check disposition
    if (call.dispositionLabel) {
      const normalizedLabel = call.dispositionLabel.toLowerCase().trim()
      if (
        EXCLUDED_DISPOSITION_LABELS.some((excluded) =>
          normalizedLabel.includes(excluded),
        )
      ) {
        continue
      }
    }

    const leadName =
      call.leadFirstName || call.leadLastName
        ? `${call.leadFirstName || ''} ${call.leadLastName || ''}`.trim()
        : null

    eligibleCalls.push({
      id: callId,
      leadId: call.leadId,
      leadName,
      leadCompany: call.leadCompany ?? null,
      phoneNumber: call.toNumber,
      duration: call.duration || 0,
      direction: call.direction,
      recordingUrl: call.recordingUrl!,
      createdAt: call.createdAt!,
      userId: call.userId,
      userName: call.userName ?? null,
    })

    if (options.limit && eligibleCalls.length >= options.limit) {
      break
    }
  }

  const offset = options.offset || 0
  return eligibleCalls.slice(
    offset,
    offset + (options.limit || eligibleCalls.length),
  )
}

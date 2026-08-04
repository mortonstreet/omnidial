import { db } from '@/lib/db'
import { withIdAndTimestamps } from './utils'

export interface CreateIntelligenceInput {
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  leadId?: string | null
  decisionMaker: unknown
  currentStrategies: unknown
  painPoints: unknown
  techStack: unknown
  talkingPoints: unknown
  summary: string
  modelUsed?: string
  tokensUsed?: number
  analysisTimeMs?: number
}

export interface IntelligenceRecord {
  id: string
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  leadId: string | null
  decisionMaker: unknown
  currentStrategies: unknown
  painPoints: unknown
  techStack: unknown
  talkingPoints: unknown
  summary: string
  modelUsed: string
  tokensUsed: number
  analysisTimeMs: number
  createdAt: Date
  updatedAt: Date
}

export interface IntelligenceWithLead extends IntelligenceRecord {
  leadFirstName: string | null
  leadLastName: string | null
  leadCompany: string | null
}

export async function createIntelligence(
  input: CreateIntelligenceInput,
): Promise<IntelligenceRecord> {
  const result = await db
    .insertInto('call_intelligence')
    .values(
      withIdAndTimestamps({
        callId: input.callId,
        transcriptId: input.transcriptId,
        organizationId: input.organizationId,
        userId: input.userId,
        leadId: input.leadId || null,
        decisionMaker: JSON.stringify(input.decisionMaker || {}),
        currentStrategies: JSON.stringify(input.currentStrategies || []),
        painPoints: JSON.stringify(input.painPoints || []),
        techStack: JSON.stringify(input.techStack || []),
        talkingPoints: JSON.stringify(input.talkingPoints || []),
        summary: input.summary || '',
        modelUsed: input.modelUsed || 'claude-3.5-sonnet',
        tokensUsed: input.tokensUsed || 0,
        analysisTimeMs: input.analysisTimeMs || 0,
      }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()

  return result as IntelligenceRecord
}

export async function findByCallId(
  callId: string,
  organizationId: string,
): Promise<IntelligenceRecord | null> {
  const result = await db
    .selectFrom('call_intelligence')
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .selectAll()
    .executeTakeFirst()

  return result as IntelligenceRecord | null
}

export async function findByLeadId(
  leadId: string,
  organizationId: string,
  options: { limit?: number; offset?: number } = {},
): Promise<IntelligenceWithLead[]> {
  let query = db
    .selectFrom('call_intelligence')
    .innerJoin('call', 'call.id', 'call_intelligence.callId')
    .leftJoin('lead', 'lead.id', 'call_intelligence.leadId')
    .where('call_intelligence.organizationId', '=', organizationId)
    .where('call_intelligence.leadId', '=', leadId)
    .orderBy('call_intelligence.createdAt', 'desc')

  if (options.limit) {
    query = query.limit(options.limit)
  }
  if (options.offset) {
    query = query.offset(options.offset)
  }

  const results = await query
    .select([
      'call_intelligence.id',
      'call_intelligence.callId',
      'call_intelligence.transcriptId',
      'call_intelligence.organizationId',
      'call_intelligence.userId',
      'call_intelligence.leadId',
      'call_intelligence.decisionMaker',
      'call_intelligence.currentStrategies',
      'call_intelligence.painPoints',
      'call_intelligence.techStack',
      'call_intelligence.talkingPoints',
      'call_intelligence.summary',
      'call_intelligence.modelUsed',
      'call_intelligence.tokensUsed',
      'call_intelligence.analysisTimeMs',
      'call_intelligence.createdAt',
      'call_intelligence.updatedAt',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.company as leadCompany',
    ])
    .execute()

  return results as IntelligenceWithLead[]
}

export async function deleteIntelligence(
  callId: string,
  organizationId: string,
): Promise<void> {
  await db
    .deleteFrom('call_intelligence')
    .where('callId', '=', callId)
    .where('organizationId', '=', organizationId)
    .execute()
}

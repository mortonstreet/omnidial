import { db } from '@/lib/db'
import { InsertDBDealSignal } from '@shared/db/src/types'
import { withIdAndTimestamps } from './utils'

export type DealSignalInput = Omit<
  InsertDBDealSignal,
  'id' | 'createdAt' | 'updatedAt'
>

/** One signal per touchpoint per lead: re-analysis replaces the scores. */
export const upsert = async (input: DealSignalInput) => {
  const { organizationId, source, sourceId, leadId, ...scores } = input
  return db
    .insertInto('deal_signal')
    .values(withIdAndTimestamps(input, true))
    .onConflict((oc) =>
      oc
        .columns(['organizationId', 'source', 'sourceId', 'leadId'])
        .doUpdateSet({ ...scores, updatedAt: new Date() }),
    )
    .returningAll()
    .executeTakeFirstOrThrow()
}

export const findBySource = async (
  organizationId: string,
  source: string,
  sourceId: string,
) => {
  return db
    .selectFrom('deal_signal')
    .select(['id', 'leadId', 'sourceUpdatedAt'])
    .where('organizationId', '=', organizationId)
    .where('source', '=', source)
    .where('sourceId', '=', sourceId)
    .execute()
}

export const findInRange = async (
  organizationId: string,
  startDate: Date,
  endDate: Date,
) => {
  return db
    .selectFrom('deal_signal')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('occurredAt', '>=', startDate)
    .where('occurredAt', '<=', endDate)
    .execute()
}

/** Most recent signal per lead, for "where does each deal stand right now". */
export const findLatestPerLead = async (organizationId: string) => {
  return db
    .selectFrom('deal_signal')
    .selectAll()
    .distinctOn('leadId')
    .where('organizationId', '=', organizationId)
    .orderBy('leadId')
    .orderBy('occurredAt', 'desc')
    .execute()
}

export const findByLead = async (
  organizationId: string,
  leadId: string,
  limit = 50,
) => {
  return db
    .selectFrom('deal_signal')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .orderBy('occurredAt', 'desc')
    .limit(limit)
    .execute()
}

/** Calls with a transcript that have not been scored yet, newest first. */
export const findUnscoredTranscribedCalls = async (
  organizationId: string,
  limit: number,
) => {
  return db
    .selectFrom('call_transcript')
    .innerJoin('call', 'call.id', 'call_transcript.callId')
    .select(['call.id as callId'])
    .where('call_transcript.organizationId', '=', organizationId)
    .where('call.leadId', 'is not', null)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom('deal_signal')
            .select('deal_signal.id')
            .where('deal_signal.organizationId', '=', organizationId)
            .where('deal_signal.source', '=', 'call')
            .whereRef('deal_signal.sourceId', '=', 'call.id'),
        ),
      ),
    )
    .orderBy('call.startedAt', 'desc')
    .limit(limit)
    .execute()
}

/** Pipeline leads with an email address, for Gmail thread matching. */
export const findPipelineLeadEmails = async (organizationId: string) => {
  return db
    .selectFrom('lead')
    .select(['id', 'email'])
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where('email', 'is not', null)
    .where('pipelineStageId', 'is not', null)
    .where('dealOutcome', 'is', null)
    .execute()
}

export const findLeadIdsByEmails = async (
  organizationId: string,
  emails: string[],
) => {
  if (emails.length === 0) return []
  return db
    .selectFrom('lead')
    .select(['id', 'email'])
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .where((eb) =>
      eb(
        eb.fn('lower', ['email']),
        'in',
        emails.map((e) => e.toLowerCase()),
      ),
    )
    .execute()
}

export const findCallForSignal = async (
  organizationId: string,
  callId: string,
) => {
  return db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .innerJoin('call_transcript', 'call_transcript.callId', 'call.id')
    .select([
      'call.id',
      'call.leadId',
      'call.userId',
      'call.startedAt',
      'call.duration',
      'call.direction',
      'call_transcript.transcriptText',
      'call_transcript.transcriptSource',
    ])
    .where('call.id', '=', callId)
    .where('twilio_config.organizationId', '=', organizationId)
    .executeTakeFirst()
}

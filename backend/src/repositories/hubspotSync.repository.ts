import { db } from '@/lib/db'
import { sql } from 'kysely'
import { withId } from './utils'

// ------------------------------------------------------------ audit trail

export interface SyncEventInput {
  organizationId: string
  leadId?: string | null
  direction: 'push' | 'pull' | 'reconcile'
  objectType: 'contact' | 'deal' | 'call' | 'task' | 'property' | 'email'
  externalId?: string | null
  status: 'applied' | 'skipped' | 'conflict' | 'failed'
  changes?: Record<string, unknown>
  message?: string | null
}

export const logEvents = async (events: SyncEventInput[]) => {
  if (events.length === 0) return
  await db
    .insertInto('crm_sync_event')
    .values(
      events.map((e) =>
        withId({
          organizationId: e.organizationId,
          leadId: e.leadId ?? null,
          provider: 'hubspot',
          direction: e.direction,
          objectType: e.objectType,
          externalId: e.externalId ?? null,
          status: e.status,
          changes: JSON.stringify(e.changes ?? {}),
          message: e.message?.slice(0, 2000) ?? null,
          createdAt: new Date(),
        }),
      ),
    )
    .execute()
}

export const recentEvents = (organizationId: string, limit = 50) =>
  db
    .selectFrom('crm_sync_event')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .execute()

export const eventCounts = async (organizationId: string, since: Date) =>
  db
    .selectFrom('crm_sync_event')
    .select(['direction', 'status', sql<number>`count(*)::int`.as('count')])
    .where('organizationId', '=', organizationId)
    .where('createdAt', '>=', since)
    .groupBy(['direction', 'status'])
    .execute()

// ------------------------------------------------------------ routing

export const findHubSpotIntegrationsByPortal = (portalId: string) =>
  db
    .selectFrom('integration')
    .selectAll()
    .where('provider', '=', 'hubspot')
    .where('externalAccountId', '=', portalId)
    .execute()

export const findHubSpotIntegrationsWithoutPortal = () =>
  db
    .selectFrom('integration')
    .selectAll()
    .where('provider', '=', 'hubspot')
    .where('externalAccountId', 'is', null)
    .execute()

export const findRecordByDeal = (organizationId: string, dealId: string) =>
  db
    .selectFrom('crm_sync_record')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('provider', '=', 'hubspot')
    .where('externalDealId', '=', dealId)
    .executeTakeFirst()

export const findRecordsByContact = (
  organizationId: string,
  contactId: string,
) =>
  db
    .selectFrom('crm_sync_record')
    .selectAll()
    .where('organizationId', '=', organizationId)
    .where('provider', '=', 'hubspot')
    .where('externalId', '=', contactId)
    .execute()

export const findLinkedRecords = (organizationId: string) =>
  db
    .selectFrom('crm_sync_record')
    .innerJoin('lead', 'lead.id', 'crm_sync_record.leadId')
    .selectAll('crm_sync_record')
    .where('crm_sync_record.organizationId', '=', organizationId)
    .where('crm_sync_record.provider', '=', 'hubspot')
    .where('crm_sync_record.remoteDeletedAt', 'is', null)
    .where('crm_sync_record.externalId', '!=', '')
    .where('lead.deletedAt', 'is', null)
    .execute()

/** Pipeline leads with no HubSpot link yet (never pushed, or push failed). */
export const findUnlinkedPipelineLeadIds = async (organizationId: string) => {
  const rows = await db
    .selectFrom('lead')
    .leftJoin('crm_sync_record', (join) =>
      join
        .onRef('crm_sync_record.leadId', '=', 'lead.id')
        .on('crm_sync_record.provider', '=', 'hubspot')
        .on('crm_sync_record.syncStatus', '=', 'synced'),
    )
    .select('lead.id')
    .where('lead.organizationId', '=', organizationId)
    .where('lead.deletedAt', 'is', null)
    .where('lead.pipelineStageId', 'is not', null)
    .where('crm_sync_record.id', 'is', null)
    .execute()
  return rows.map((r) => r.id)
}

// ------------------------------------------------------------ lead fields

export const findLeadsForSync = (organizationId: string, leadIds: string[]) =>
  leadIds.length === 0
    ? Promise.resolve([])
    : db
        .selectFrom('lead')
        .selectAll()
        .where('organizationId', '=', organizationId)
        .where('id', 'in', leadIds)
        .where('deletedAt', 'is', null)
        .execute()

/** Record when CRM-synced fields were last edited, for newest-wins. */
export const stampFieldEdits = async (
  organizationId: string,
  leadId: string,
  fields: string[],
  at: Date = new Date(),
) => {
  if (fields.length === 0) return
  const patch = JSON.stringify(
    Object.fromEntries(fields.map((f) => [f, at.toISOString()])),
  )
  await db
    .updateTable('lead')
    .set({
      syncFieldUpdatedAt: sql`coalesce("syncFieldUpdatedAt", '{}'::jsonb) || ${patch}::jsonb`,
    })
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .execute()
}

// ------------------------------------------------------------ activities

/** Completed, connected calls for a lead not yet logged to HubSpot. */
export const findUnloggedCalls = (
  organizationId: string,
  leadId: string,
  since: Date,
) =>
  db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .leftJoin('call_intelligence', 'call_intelligence.callId', 'call.id')
    .select([
      'call.id',
      'call.direction',
      'call.duration',
      'call.startedAt',
      'call.recordingUrl',
      'call.fromNumber',
      'call.toNumber',
      'disposition.label as dispositionLabel',
      'call_intelligence.summary as summary',
    ])
    .where('twilio_config.organizationId', '=', organizationId)
    .where('call.leadId', '=', leadId)
    .where('call.crmActivityId', 'is', null)
    .where('call.status', '=', 'completed')
    .where('call.startedAt', '>=', since)
    .orderBy('call.startedAt', 'asc')
    .limit(25)
    .execute()

export const setCallActivityId = (callId: string, activityId: string) =>
  db
    .updateTable('call')
    .set({ crmActivityId: activityId })
    .where('id', '=', callId)
    .execute()

export const findLeadIdForCall = async (callId: string) =>
  (await db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .select(['call.leadId', 'twilio_config.organizationId'])
    .where('call.id', '=', callId)
    .executeTakeFirst()) ?? null

export const findCallActivity = (callId: string) =>
  db
    .selectFrom('call')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .leftJoin('call_intelligence', 'call_intelligence.callId', 'call.id')
    .select([
      'call.crmActivityId',
      'disposition.label as dispositionLabel',
      'call_intelligence.summary as summary',
    ])
    .where('call.id', '=', callId)
    .executeTakeFirst()

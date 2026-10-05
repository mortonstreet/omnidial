import { db } from '@/lib/db'
import { InsertDBDealTouchpoint } from '@shared/db/src/types'
import { withId } from './utils'
import type { Touch } from '@/lib/sales-process'

export type TouchpointInput = Omit<InsertDBDealTouchpoint, 'id' | 'createdAt'>

/** Idempotent: re-syncing a thread or recording never duplicates touches. */
export const upsertMany = async (rows: TouchpointInput[]) => {
  if (rows.length === 0) return
  await db
    .insertInto('deal_touchpoint')
    .values(rows.map((row) => withId({ ...row, createdAt: new Date() })))
    .onConflict((oc) =>
      oc
        .columns(['organizationId', 'source', 'sourceId', 'leadId'])
        .doUpdateSet((eb) => ({
          direction: eb.ref('excluded.direction'),
          occurredAt: eb.ref('excluded.occurredAt'),
          durationSeconds: eb.ref('excluded.durationSeconds'),
        })),
    )
    .execute()
}

/** Email message counts and date range per thread, for HubSpot thread notes. */
export const threadStats = async (
  organizationId: string,
  leadId: string,
  threadId: string,
) =>
  db
    .selectFrom('deal_touchpoint')
    .select(['direction', 'occurredAt', 'threadId'])
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .where('threadId', '=', threadId)
    .orderBy('occurredAt', 'asc')
    .execute()

/** The touch row for one source item (e.g. a Grain recording's duration). */
export const findBySource = (
  organizationId: string,
  leadId: string,
  source: string,
  sourceId: string,
) =>
  db
    .selectFrom('deal_touchpoint')
    .select(['durationSeconds', 'occurredAt'])
    .where('organizationId', '=', organizationId)
    .where('leadId', '=', leadId)
    .where('source', '=', source)
    .where('sourceId', '=', sourceId)
    .executeTakeFirst()

/**
 * Full touch timeline per lead: OmniDial calls (read from `call`) plus email
 * messages and meetings (from `deal_touchpoint`).
 */
export const findTouchesForLeads = async (
  organizationId: string,
  leadIds: string[],
): Promise<Map<string, Touch[]>> => {
  const byLead = new Map<string, Touch[]>()
  if (leadIds.length === 0) return byLead
  const push = (leadId: string, touch: Touch) => {
    const list = byLead.get(leadId) ?? []
    list.push(touch)
    byLead.set(leadId, list)
  }

  const [calls, others] = await Promise.all([
    db
      .selectFrom('call')
      .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
      .select([
        'call.leadId',
        'call.direction',
        'call.startedAt',
        'call.duration',
        'call.status',
        'call.answeredAt',
      ])
      .where('twilio_config.organizationId', '=', organizationId)
      .where('call.leadId', 'in', leadIds)
      .execute(),
    db
      .selectFrom('deal_touchpoint')
      .select([
        'leadId',
        'kind',
        'direction',
        'occurredAt',
        'durationSeconds',
        'threadId',
      ])
      .where('organizationId', '=', organizationId)
      .where('leadId', 'in', leadIds)
      .execute(),
  ])

  for (const c of calls) {
    if (!c.leadId) continue
    push(c.leadId, {
      kind: 'call',
      direction: c.direction === 'inbound' ? 'inbound' : 'outbound',
      at: c.startedAt,
      durationSeconds: c.duration,
      connected: c.status === 'completed' && c.duration > 0,
    })
  }
  for (const t of others) {
    push(t.leadId, {
      kind: t.kind as Touch['kind'],
      direction: (t.direction as Touch['direction']) ?? null,
      at: t.occurredAt,
      durationSeconds: t.durationSeconds,
      threadId: t.threadId,
    })
  }
  return byLead
}

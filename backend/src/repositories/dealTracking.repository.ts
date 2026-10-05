import { db } from '@/lib/db'
import { sql } from 'kysely'
import { Decimal } from '@prisma/client/runtime/library'
import { InsertDBLeadStageHistory } from '@shared/db/src/types'
import { withId } from './utils'

export interface LeadDealState {
  id: string
  pipelineStageId: string | null
  dealValue: string | null
  initialDealValue: string | null
  dealOutcome: string | null
}

const dealStateColumns = [
  'id',
  'pipelineStageId',
  'dealValue',
  'initialDealValue',
  'dealOutcome',
] as const

export const findLeadDealState = async (
  organizationId: string,
  leadId: string,
): Promise<LeadDealState | undefined> => {
  return db
    .selectFrom('lead')
    .select(dealStateColumns)
    .where('id', '=', leadId)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .executeTakeFirst()
}

export const findLeadDealStates = async (
  organizationId: string,
  leadIds: string[],
): Promise<LeadDealState[]> => {
  if (leadIds.length === 0) return []
  return db
    .selectFrom('lead')
    .select(dealStateColumns)
    .where('id', 'in', leadIds)
    .where('organizationId', '=', organizationId)
    .where('deletedAt', 'is', null)
    .execute()
}

export const insertStageHistory = async (
  rows: Omit<InsertDBLeadStageHistory, 'id'>[],
): Promise<void> => {
  if (rows.length === 0) return
  await db
    .insertInto('lead_stage_history')
    .values(rows.map((row) => withId(row)))
    .execute()
}

export interface LeadDealFields {
  stageEnteredAt?: Date
  initialDealValue?: number
  dealOutcome?: string | null
  dealClosedAt?: Date | null
  dealOutcomeReason?: string | null
  dealOutcomeNotes?: string | null
}

export const updateLeadDealFields = async (
  organizationId: string,
  leadIds: string[],
  fields: LeadDealFields,
): Promise<void> => {
  if (leadIds.length === 0) return
  const { initialDealValue, ...rest } = fields
  await db
    .updateTable('lead')
    .set({
      ...rest,
      ...(initialDealValue !== undefined && {
        initialDealValue: new Decimal(initialDealValue).toString(),
      }),
    })
    .where('id', 'in', leadIds)
    .where('organizationId', '=', organizationId)
    .execute()
}

export interface StageHistoryRow {
  leadId: string
  toStageId: string | null
  createdAt: Date
}

/**
 * Every transition for leads that moved at least once since `since`, so the
 * stay that was in progress at `since` is still measurable.
 */
export const findStageHistoryForActiveLeads = async (
  organizationId: string,
  since: Date,
): Promise<StageHistoryRow[]> => {
  return db
    .selectFrom('lead_stage_history')
    .select(['leadId', 'toStageId', 'createdAt'])
    .where('organizationId', '=', organizationId)
    .where('leadId', 'in', (qb) =>
      qb
        .selectFrom('lead_stage_history')
        .select('leadId')
        .where('organizationId', '=', organizationId)
        .where('createdAt', '>=', since),
    )
    .orderBy('createdAt', 'asc')
    .execute()
}

export interface PipelineDealRow {
  id: string
  firstName: string | null
  lastName: string | null
  company: string | null
  pipelineStageId: string | null
  dealValue: string | null
  initialDealValue: string | null
  dealOutcome: string | null
  dealClosedAt: Date | null
  dealOutcomeReason: string | null
  stageEnteredAt: Date | null
  createdAt: Date
  firstStageAt: Date | null
}

/** Every lead that is or was in the pipeline, with when it first entered. */
export const findPipelineDeals = async (
  organizationId: string,
  clientId?: string,
): Promise<PipelineDealRow[]> => {
  let query = db
    .selectFrom('lead')
    .select([
      'lead.id',
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'lead.pipelineStageId',
      'lead.dealValue',
      'lead.initialDealValue',
      'lead.dealOutcome',
      'lead.dealClosedAt',
      'lead.dealOutcomeReason',
      'lead.stageEnteredAt',
      'lead.createdAt',
      (eb) =>
        eb
          .selectFrom('lead_stage_history')
          .select(sql<Date>`min("createdAt")`.as('firstStageAt'))
          .whereRef('lead_stage_history.leadId', '=', 'lead.id')
          .as('firstStageAt'),
    ])
    .where('lead.organizationId', '=', organizationId)
    .where('lead.deletedAt', 'is', null)
    .where((eb) =>
      eb.or([
        eb('lead.pipelineStageId', 'is not', null),
        eb('lead.dealOutcome', 'is not', null),
      ]),
    )

  if (clientId) {
    query = query.where('lead.clientId', '=', clientId)
  }

  return query.execute()
}

/** Lifetime talk time per lead, for won-vs-lost talk time comparisons. */
export const findTalkTimeByLead = async (
  organizationId: string,
  leadIds: string[],
): Promise<Map<string, number>> => {
  if (leadIds.length === 0) return new Map()
  const rows = await db
    .selectFrom('call')
    .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
    .select([
      'call.leadId',
      sql<number>`COALESCE(SUM(call.duration), 0)::int`.as('seconds'),
    ])
    .where('twilio_config.organizationId', '=', organizationId)
    .where('call.leadId', 'in', leadIds)
    .groupBy('call.leadId')
    .execute()
  return new Map(rows.map((r) => [r.leadId as string, Number(r.seconds)]))
}

export interface CallQualityStats {
  totalTalkTimeSeconds: number
  connectedCalls: number
  coachedCalls: number
  avgCoachingScore: number
}

export const findCallQualityStats = async (
  organizationId: string,
  startDate: Date,
  endDate: Date,
): Promise<CallQualityStats> => {
  const [talk, coaching] = await Promise.all([
    db
      .selectFrom('call')
      .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
      .select([
        sql<number>`COALESCE(SUM(call.duration), 0)::int`.as('seconds'),
        sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed' AND call.duration > 0)::int`.as(
          'connected',
        ),
      ])
      .where('twilio_config.organizationId', '=', organizationId)
      .where('call.startedAt', '>=', startDate)
      .where('call.startedAt', '<=', endDate)
      .executeTakeFirst(),
    db
      .selectFrom('call_coaching')
      .select([
        sql<number>`COUNT(*)::int`.as('count'),
        sql<number>`COALESCE(AVG("overallScore"), 0)::float`.as('avg'),
      ])
      .where('organizationId', '=', organizationId)
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .executeTakeFirst(),
  ])

  return {
    totalTalkTimeSeconds: Number(talk?.seconds ?? 0),
    connectedCalls: Number(talk?.connected ?? 0),
    coachedCalls: Number(coaching?.count ?? 0),
    avgCoachingScore: Number(coaching?.avg ?? 0),
  }
}

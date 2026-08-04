import { db } from '@/lib/db'
import { withId } from './utils'

export interface CreateParallelDialAttemptInput {
  sessionId: string
  leadId: string
  callSid?: string
}

export interface UpdateParallelDialAttemptInput {
  callSid?: string
  status?: string
  wasConnected?: boolean
  wasAbandoned?: boolean
  abandonedAfterMs?: number
  answeredAt?: Date
  endedAt?: Date
}

export const create = async (data: CreateParallelDialAttemptInput) => {
  const attempt = await db
    .insertInto('parallel_dial_attempt')
    .values({
      ...withId({
        sessionId: data.sessionId,
        leadId: data.leadId,
        callSid: data.callSid ?? null,
        status: 'dialing',
        wasConnected: false,
        wasAbandoned: false,
        startedAt: new Date(),
      }),
    })
    .returningAll()
    .executeTakeFirstOrThrow()
  return attempt
}

export const createMany = async (
  attempts: CreateParallelDialAttemptInput[],
) => {
  if (attempts.length === 0) return []

  const values = attempts.map((data) => ({
    ...withId({
      sessionId: data.sessionId,
      leadId: data.leadId,
      callSid: data.callSid ?? null,
      status: 'dialing',
      wasConnected: false,
      wasAbandoned: false,
      startedAt: new Date(),
    }),
  }))

  return db
    .insertInto('parallel_dial_attempt')
    .values(values)
    .returningAll()
    .execute()
}

export const findById = async (id: string) => {
  return db
    .selectFrom('parallel_dial_attempt')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export const findByIdWithOrganization = async (id: string) => {
  return db
    .selectFrom('parallel_dial_attempt as pda')
    .innerJoin('parallel_dial_session as pds', 'pds.id', 'pda.sessionId')
    .where('pda.id', '=', id)
    .select([
      'pda.id',
      'pda.sessionId',
      'pda.leadId',
      'pda.callSid',
      'pda.status',
      'pda.wasConnected',
      'pda.wasAbandoned',
      'pda.abandonedAfterMs',
      'pda.startedAt',
      'pda.answeredAt',
      'pda.endedAt',
      'pds.organizationId',
    ])
    .executeTakeFirst()
}

export const findByCallSid = async (callSid: string) => {
  return db
    .selectFrom('parallel_dial_attempt')
    .where('callSid', '=', callSid)
    .selectAll()
    .executeTakeFirst()
}

export const findBySessionId = async (sessionId: string) => {
  return db
    .selectFrom('parallel_dial_attempt')
    .where('sessionId', '=', sessionId)
    .selectAll()
    .orderBy('startedAt', 'asc')
    .execute()
}

export const findBySessionIdWithLeads = async (sessionId: string) => {
  return db
    .selectFrom('parallel_dial_attempt as pda')
    .innerJoin('lead', 'lead.id', 'pda.leadId')
    .where('pda.sessionId', '=', sessionId)
    .select([
      'pda.id',
      'pda.sessionId',
      'pda.leadId',
      'pda.callSid',
      'pda.status',
      'pda.wasConnected',
      'pda.wasAbandoned',
      'pda.abandonedAfterMs',
      'pda.startedAt',
      'pda.answeredAt',
      'pda.endedAt',
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'lead.phone',
    ])
    .orderBy('pda.startedAt', 'asc')
    .execute()
}

export const findActiveBySessionId = async (sessionId: string) => {
  return db
    .selectFrom('parallel_dial_attempt')
    .where('sessionId', '=', sessionId)
    .where('endedAt', 'is', null)
    .selectAll()
    .execute()
}

export const update = async (
  id: string,
  data: UpdateParallelDialAttemptInput,
) => {
  return db
    .updateTable('parallel_dial_attempt')
    .set({
      ...(data.callSid !== undefined && { callSid: data.callSid }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.wasConnected !== undefined && {
        wasConnected: data.wasConnected,
      }),
      ...(data.wasAbandoned !== undefined && {
        wasAbandoned: data.wasAbandoned,
      }),
      ...(data.abandonedAfterMs !== undefined && {
        abandonedAfterMs: data.abandonedAfterMs,
      }),
      ...(data.answeredAt !== undefined && { answeredAt: data.answeredAt }),
      ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
    })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}

export const updateByCallSid = async (
  callSid: string,
  data: UpdateParallelDialAttemptInput,
) => {
  return db
    .updateTable('parallel_dial_attempt')
    .set({
      ...(data.status !== undefined && { status: data.status }),
      ...(data.wasConnected !== undefined && {
        wasConnected: data.wasConnected,
      }),
      ...(data.wasAbandoned !== undefined && {
        wasAbandoned: data.wasAbandoned,
      }),
      ...(data.abandonedAfterMs !== undefined && {
        abandonedAfterMs: data.abandonedAfterMs,
      }),
      ...(data.answeredAt !== undefined && { answeredAt: data.answeredAt }),
      ...(data.endedAt !== undefined && { endedAt: data.endedAt }),
    })
    .where('callSid', '=', callSid)
    .returningAll()
    .executeTakeFirst()
}

export const markConnectedIfUnconnected = async (
  id: string,
  data: {
    callSid?: string
    answeredAt: Date
  },
) => {
  return db
    .updateTable('parallel_dial_attempt')
    .set({
      ...(data.callSid !== undefined && { callSid: data.callSid }),
      status: 'connected',
      wasConnected: true,
      answeredAt: data.answeredAt,
    })
    .where('id', '=', id)
    .where('wasConnected', '=', false)
    .where('wasAbandoned', '=', false)
    .where('status', '!=', 'abandoned')
    .where('status', '!=', 'voicemail')
    .returningAll()
    .executeTakeFirst()
}

// Mark all active attempts except one as abandoned
export const markOthersAbandoned = async (
  sessionId: string,
  exceptAttemptId: string,
) => {
  const now = new Date()
  return db
    .updateTable('parallel_dial_attempt')
    .set({
      status: 'abandoned',
      wasAbandoned: true,
      endedAt: now,
    })
    .where('sessionId', '=', sessionId)
    .where('id', '!=', exceptAttemptId)
    .where('endedAt', 'is', null)
    .execute()
}

// Get abandoned calls for compliance reporting
export const getAbandonedCalls = async (
  organizationId: string,
  filters: {
    startDate?: Date
    endDate?: Date
  },
  pagination: { page: number; limit: number },
) => {
  let query = db
    .selectFrom('parallel_dial_attempt as pda')
    .innerJoin('parallel_dial_session as pds', 'pds.id', 'pda.sessionId')
    .where('pds.organizationId', '=', organizationId)
    .where('pda.wasAbandoned', '=', true)
    .where('pda.answeredAt', 'is not', null) // Only count answered-then-abandoned

  if (filters.startDate) {
    query = query.where('pda.startedAt', '>=', filters.startDate)
  }
  if (filters.endDate) {
    query = query.where('pda.startedAt', '<=', filters.endDate)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const calls = await query
    .select([
      'pda.id',
      'pda.sessionId',
      'pda.leadId',
      'pda.abandonedAfterMs',
      'pda.answeredAt',
      'pda.endedAt',
      'pds.userId',
    ])
    .orderBy('pda.answeredAt', 'desc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  // Calculate total abandoned time
  const totalAbandonedMs = calls.reduce(
    (sum, call) => sum + (call.abandonedAfterMs || 0),
    0,
  )

  return {
    data: calls,
    total: Number(countResult.count),
    totalAbandonedMs,
  }
}

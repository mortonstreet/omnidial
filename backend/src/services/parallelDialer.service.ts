import * as parallelDialSessionRepository from '@/repositories/parallelDialSession.repository'
import * as parallelDialAttemptRepository from '@/repositories/parallelDialAttempt.repository'
import * as leadListEntryRepository from '@/repositories/leadListEntry.repository'
import * as leadRepository from '@/repositories/lead.repository'
import * as userPhoneNumberRepository from '@/repositories/userPhoneNumber.repository'
import * as callRepository from '@/repositories/call.repository'
import * as telnyxClient from '@/clients/telnyx.client'
import * as callingNotificationService from '@/services/callingNotification.service'
import { trigger as pusherTrigger } from '@/lib/pusher'
import { config } from '@/config'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import { PUSHER_EVENTS, channels } from '@shared/types/src/pusher'
import { NotFoundError, BadRequestError } from '@/lib/errors'
import type {
  ParallelDialSessionResponse,
  ParallelDialAttemptResponse,
  AbandonedCallRecord,
} from '@shared/types/src/requests/parallelDialer'

// Start a parallel dial session
export const startSession = async (
  organizationId: string,
  userId: string,
  options: {
    campaignId?: string
    listId?: string
    lineCount?: number
  },
): Promise<ParallelDialSessionResponse> => {
  console.log('[ParallelDialer] startSession called:', {
    organizationId,
    userId,
    options,
  })

  // Check billing guard before allowing the session
  const { canMakeCall } = await import('@/services/usageGuard.service')
  const guard = await canMakeCall(organizationId, userId)
  if (!guard.allowed) {
    const error = new Error(`Call blocked: ${guard.reason}`) as Error & {
      code: string
      guardResult: typeof guard
      statusCode?: number
    }
    error.code = guard.reason
    error.guardResult = guard
    if (guard.httpStatus) {
      error.statusCode = guard.httpStatus
    }
    throw error
  }

  // Auto-end any stale active session before starting a new one
  const existingSession =
    await parallelDialSessionRepository.findActiveByUserId(userId)
  if (existingSession) {
    console.log(
      '[ParallelDialer] Ending existing active session:',
      existingSession.id,
    )
    await endSession(existingSession.id)
  }

  // Create conference room name (rep will be connected here when dialing starts)
  const conferenceName = `parallel-dial-${userId}-${Date.now()}`
  console.log(
    '[ParallelDialer] Creating session with conference:',
    conferenceName,
  )

  // Create the session
  const session = await parallelDialSessionRepository.create({
    organizationId,
    userId,
    campaignId: options.campaignId,
    listId: options.listId,
    lineCount: options.lineCount ?? 2,
    conferenceId: conferenceName,
  })
  console.log('[ParallelDialer] Session created:', session.id)

  // Emit event
  await pusherTrigger(
    channels.presenceOrg(organizationId),
    PUSHER_EVENTS.PARALLEL_DIAL_STARTED,
    {
      sessionId: session.id,
      userId,
      lineCount: session.lineCount,
      conferenceId: conferenceName,
    },
  )

  // Notify organization owners asynchronously
  setImmediate(() => {
    callingNotificationService.notifyOwnersOfCallingSession({
      organizationId,
      userId,
      campaignId: options.campaignId,
      dialerType: 'parallel',
    })
  })

  return transformSession(session)
}

// Dial next batch of leads
export const dialNextBatch = async (
  sessionId: string,
  organizationId: string,
  userId: string,
): Promise<ParallelDialAttemptResponse[]> => {
  console.log('[ParallelDialer] dialNextBatch called:', {
    sessionId,
    organizationId,
    userId,
  })

  const session = await parallelDialSessionRepository.findById(sessionId)
  if (!session || session.status !== 'active') {
    console.error(
      '[ParallelDialer] Session not found or not active:',
      sessionId,
      session?.status,
    )
    throw new NotFoundError('Session not found or not active')
  }
  console.log('[ParallelDialer] Session found:', {
    id: session.id,
    listId: session.listId,
    lineCount: session.lineCount,
  })
  if (session.organizationId !== organizationId || session.userId !== userId) {
    throw new NotFoundError('Session not found or not active')
  }

  // Get leads to dial
  let leadsToCall: Array<{ id: string; phone: string }> = []

  if (session.listId) {
    // Get next leads from list
    console.log('[ParallelDialer] Fetching leads from list:', session.listId)
    const entries = await leadListEntryRepository.findNextToDialFromList(
      session.listId,
      session.lineCount,
      sessionId,
    )
    console.log('[ParallelDialer] Raw entries from list:', entries.length)
    // Filter out leads with null phones (wrong number disposition removes phone)
    leadsToCall = entries
      .filter((e): e is typeof e & { phone: string } => e.phone !== null)
      .map((e) => ({ id: e.leadId, phone: e.phone }))
    console.log('[ParallelDialer] Leads with valid phones:', leadsToCall.length)
  } else {
    console.warn('[ParallelDialer] Session has no listId')
  }

  if (leadsToCall.length === 0) {
    console.error('[ParallelDialer] No leads available to dial')
    throw new BadRequestError('No more leads to dial')
  }
  console.log(
    '[ParallelDialer] Leads to dial:',
    leadsToCall.map((l) => ({ id: l.id, phone: l.phone.slice(0, 6) + '...' })),
  )

  const attempts = await db.transaction().execute(async (trx) => {
    await sql`select pg_advisory_xact_lock(hashtext(${`caller-id-user:${organizationId}:${userId}`}))`.execute(
      trx,
    )

    // Parallel dialing needs N free numbers at once, so a single reservation
    // that was never closed out silently costs a whole line. Release this
    // rep's dead reservations first, exactly as the manual dialer does.
    await callRepository.markStaleOutboundReservationsFailed(
      organizationId,
      userId,
      trx as typeof db,
    )

    const assignments =
      await userPhoneNumberRepository.findAvailableByUserForDialing(
        organizationId,
        userId,
        {
          executor: trx as typeof db,
          limit: leadsToCall.length,
        },
      )

    if (assignments.length < leadsToCall.length) {
      const assignedNumbers = await userPhoneNumberRepository.findByUser(
        organizationId,
        userId,
        trx as typeof db,
      )
      const error = new BadRequestError(
        assignedNumbers.length === 0
          ? 'No caller ID is assigned to you. Ask an admin to assign you a phone number.'
          : `Parallel dialing needs ${leadsToCall.length} free assigned caller IDs, but only ${assignments.length} are available.`,
      ) as BadRequestError & { code?: string }
      error.code =
        assignedNumbers.length === 0
          ? 'NO_CALLER_ID_ASSIGNED'
          : 'CALLER_IDS_BUSY'
      throw error
    }

    const attemptInputs = leadsToCall.map((lead, index) => ({
      sessionId,
      leadId: lead.id,
      fromNumber: assignments[index].phoneNumber,
    }))

    return parallelDialAttemptRepository.createMany(
      attemptInputs,
      trx as typeof db,
    )
  })

  // Fetch full lead data for response
  const leadIds = leadsToCall.map((l) => l.id)
  const leads = await leadRepository.findByIds(leadIds, organizationId)
  const leadById = new Map(leads.map((l) => [l.id, l]))

  // Initiate calls for each attempt
  console.log('[ParallelDialer] Getting Telnyx client for org:', organizationId)
  const telnyx = await telnyxClient.getClientForOrganization(organizationId)
  console.log('[ParallelDialer] Got Telnyx client, initiating calls')

  const dialPromises = attempts.map(async (attempt, index) => {
    try {
      const lead = leadsToCall[index]
      const fromNumber = attempt.fromNumber
      if (!fromNumber) {
        throw new Error('No caller ID assigned to this attempt')
      }
      console.log(
        `[ParallelDialer] Dialing attempt ${attempt.id} to ${lead.phone.slice(0, 6)}... from ${fromNumber}`,
      )

      // Create outbound call that joins the conference when answered
      const webhookUrl = `${config.backendUrl}/api/webhooks/telnyx/parallel-dial-answered?attemptId=${attempt.id}&sessionId=${sessionId}`
      console.log(`[ParallelDialer] Webhook URL: ${webhookUrl}`)

      const call = await telnyx.createCall({
        to: lead.phone,
        from: fromNumber,
        url: webhookUrl,
        statusCallback: `${config.backendUrl}/api/webhooks/telnyx/parallel-dial-status?attemptId=${attempt.id}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        timeout: 30,
        // Enable Answering Machine Detection
        machineDetection: 'Enable',
        machineDetectionTimeout: 5000,
        asyncAmd: true,
        asyncAmdStatusCallback: `${config.backendUrl}/api/webhooks/telnyx/parallel-dial-amd?attemptId=${attempt.id}`,
      })
      console.log(`[ParallelDialer] Call created with SID: ${call.sid}`)

      // Update attempt with call SID
      return parallelDialAttemptRepository.update(attempt.id, {
        callSid: call.sid,
        status: 'dialing',
      })
    } catch (error) {
      console.error(
        `[ParallelDialer] Failed to dial attempt ${attempt.id}:`,
        error,
      )
      // Mark attempt as failed
      return parallelDialAttemptRepository.update(attempt.id, {
        status: 'failed',
        endedAt: new Date(),
      })
    }
  })

  const updatedAttempts = await Promise.all(dialPromises)

  // Increment session attempts
  await parallelDialSessionRepository.incrementStats(sessionId, {
    attempts: attempts.length,
  })

  return updatedAttempts
    .filter((a): a is NonNullable<typeof a> => a !== undefined)
    .map((attempt) => {
      const leadData = leadById.get(attempt.leadId)
      return transformAttempt(attempt, leadData)
    })
}

// Handle when a call is answered - bridge to conference and abandon others
export const handleCallAnswered = async (
  attemptId: string,
  callSid: string,
): Promise<{ conferenceId: string; abandonedCount: number }> => {
  const attempt = await parallelDialAttemptRepository.findById(attemptId)
  if (!attempt) {
    throw new NotFoundError('Attempt not found')
  }

  const session = await parallelDialSessionRepository.findById(
    attempt.sessionId,
  )
  if (!session) {
    throw new NotFoundError('Session not found')
  }

  // Idempotency: Telnyx may retry answered webhooks.
  if (attempt.wasConnected || attempt.status === 'connected') {
    return {
      conferenceId: session.conferenceId || '',
      abandonedCount: 0,
    }
  }

  // Mark this attempt as connected once (safe under concurrent webhook retries)
  const now = new Date()
  const connectedAttempt =
    await parallelDialAttemptRepository.markConnectedIfUnconnected(attemptId, {
      callSid,
      answeredAt: now,
    })

  if (!connectedAttempt) {
    return {
      conferenceId: session.conferenceId || '',
      abandonedCount: 0,
    }
  }

  // Get all active attempts before marking as abandoned (need their callSids)
  const activeAttempts =
    await parallelDialAttemptRepository.findActiveBySessionId(session.id)

  // Abandon all other active attempts in this batch
  const abandonedResult =
    await parallelDialAttemptRepository.markOthersAbandoned(
      session.id,
      attemptId,
    )

  const abandonedCount = abandonedResult.reduce(
    (sum, r) => sum + Number(r.numUpdatedRows ?? 0),
    0,
  )

  // Terminate abandoned calls by redirecting them to abandonment message
  const telnyx = await telnyxClient.getClientForOrganization(
    session.organizationId,
  )
  for (const otherAttempt of activeAttempts) {
    if (otherAttempt.id !== attemptId && otherAttempt.callSid) {
      try {
        // Redirect the call to play abandonment message and hang up
        await telnyx.updateCall(otherAttempt.callSid, {
          url: `${config.backendUrl}/api/webhooks/telnyx/parallel-dial-abandoned`,
          method: 'POST',
        })
      } catch (e) {
        // Call may have already ended, ignore errors
        console.log(
          `Could not terminate abandoned call ${otherAttempt.callSid}:`,
          e,
        )
      }
    }
  }

  // Update session stats
  await parallelDialSessionRepository.incrementStats(session.id, {
    connects: 1,
    abandoned: abandonedCount,
  })

  // Calculate abandoned time for compliance tracking
  const allAttempts = await parallelDialAttemptRepository.findBySessionId(
    session.id,
  )
  for (const otherAttempt of allAttempts) {
    if (
      otherAttempt.id !== attemptId &&
      otherAttempt.wasAbandoned &&
      otherAttempt.answeredAt
    ) {
      const abandonedAfterMs = now.getTime() - otherAttempt.answeredAt.getTime()
      await parallelDialAttemptRepository.update(otherAttempt.id, {
        abandonedAfterMs,
      })
    }
  }

  // Emit connected event
  const lead = await leadRepository.findById(
    connectedAttempt.leadId,
    session.organizationId,
  )
  await pusherTrigger(
    channels.presenceOrg(session.organizationId),
    PUSHER_EVENTS.PARALLEL_DIAL_CONNECTED,
    {
      sessionId: session.id,
      attempt: transformAttempt(connectedAttempt, lead ?? undefined),
      abandonedAttempts: [], // Could populate if needed
    },
  )

  return {
    conferenceId: session.conferenceId || '',
    abandonedCount,
  }
}

// Handle Answering Machine Detection result
export const handleAmdResult = async (
  attemptId: string,
  callSid: string,
  answeredBy: string,
): Promise<void> => {
  // If voicemail/machine detected, terminate the call
  const machineTypes = [
    'machine_start',
    'machine_end_beep',
    'machine_end_silence',
    'fax',
  ]

  if (machineTypes.includes(answeredBy)) {
    const attempt =
      await parallelDialAttemptRepository.findByIdWithOrganization(attemptId)
    if (!attempt) {
      console.log(`AMD: Attempt not found: ${attemptId}`)
      return
    }

    if (
      attempt.wasConnected ||
      attempt.wasAbandoned ||
      attempt.status === 'connected' ||
      attempt.status === 'abandoned' ||
      attempt.status === 'voicemail'
    ) {
      return
    }

    // Update attempt status to voicemail
    const updatedAttempt = await parallelDialAttemptRepository.update(
      attemptId,
      {
        status: 'voicemail',
        endedAt: new Date(),
      },
    )

    // Terminate the call
    try {
      const telnyx = await telnyxClient.getClientForOrganization(
        attempt.organizationId,
      )
      await telnyx.endCall(callSid)
    } catch (e) {
      console.log(`AMD: Could not terminate voicemail call ${callSid}:`, e)
    }

    // Emit status update event
    const session = await parallelDialSessionRepository.findById(
      attempt.sessionId,
    )
    if (session) {
      // Fetch lead data for the Pusher event
      const lead = await leadRepository.findById(
        attempt.leadId,
        session.organizationId,
      )
      await pusherTrigger(
        channels.presenceOrg(session.organizationId),
        PUSHER_EVENTS.PARALLEL_DIAL_ATTEMPT_UPDATE,
        {
          sessionId: session.id,
          attempt: transformAttempt(
            updatedAttempt ?? attempt,
            lead ?? undefined,
          ),
        },
      )
    }
  }
}

// Handle call status updates
export const handleCallStatusUpdate = async (
  attemptId: string,
  status: string,
) => {
  const attempt = await parallelDialAttemptRepository.findById(attemptId)
  if (!attempt) {
    return
  }

  let newStatus = attempt.status
  let shouldEndAttempt = status !== 'ringing'

  switch (status) {
    case 'ringing':
      if (attempt.status === 'dialing' || attempt.status === 'ringing') {
        newStatus = 'ringing'
      }
      shouldEndAttempt = false
      break
    case 'completed':
    case 'busy':
    case 'no-answer':
    case 'failed':
    case 'canceled':
      if (attempt.wasConnected || attempt.status === 'connected') {
        newStatus = 'connected'
      } else if (
        attempt.wasAbandoned ||
        attempt.status === 'abandoned' ||
        attempt.status === 'voicemail'
      ) {
        newStatus = attempt.status
      } else if (
        attempt.status === 'failed' ||
        attempt.status === 'no_answer'
      ) {
        newStatus = attempt.status
      } else {
        newStatus = status === 'no-answer' ? 'no_answer' : 'failed'
      }
      break
    default:
      shouldEndAttempt = false
      break
  }

  if (newStatus !== attempt.status || (shouldEndAttempt && !attempt.endedAt)) {
    await parallelDialAttemptRepository.update(attemptId, {
      status: newStatus,
      ...(shouldEndAttempt && !attempt.endedAt && { endedAt: new Date() }),
    })
  }

  // Emit status update event
  const session = await parallelDialSessionRepository.findById(
    attempt.sessionId,
  )
  if (session) {
    const updatedAttempt =
      await parallelDialAttemptRepository.findById(attemptId)
    if (updatedAttempt) {
      // Fetch lead data for the Pusher event
      const lead = await leadRepository.findById(
        updatedAttempt.leadId,
        session.organizationId,
      )
      await pusherTrigger(
        channels.presenceOrg(session.organizationId),
        PUSHER_EVENTS.PARALLEL_DIAL_ATTEMPT_UPDATE,
        {
          sessionId: session.id,
          attempt: transformAttempt(updatedAttempt, lead ?? undefined),
        },
      )
    }
  }
}

// End a parallel dial session
export const endSession = async (
  sessionId: string,
): Promise<ParallelDialSessionResponse> => {
  const session = await parallelDialSessionRepository.findById(sessionId)
  if (!session) {
    throw new NotFoundError('Session not found')
  }

  // End any active calls
  const activeAttempts =
    await parallelDialAttemptRepository.findActiveBySessionId(sessionId)
  const telnyx = await telnyxClient.getClientForOrganization(
    session.organizationId,
  )

  for (const attempt of activeAttempts) {
    if (attempt.callSid) {
      try {
        await telnyx.endCall(attempt.callSid)
      } catch (e) {
        // Call may already be ended
      }
    }
    await parallelDialAttemptRepository.update(attempt.id, {
      status: 'failed',
      endedAt: new Date(),
    })
  }

  // End the session
  const endedSession = await parallelDialSessionRepository.endSession(sessionId)
  if (!endedSession) {
    throw new BadRequestError('Failed to end session')
  }

  // Emit event
  await pusherTrigger(
    channels.presenceOrg(session.organizationId),
    PUSHER_EVENTS.PARALLEL_DIAL_ENDED,
    {
      sessionId: session.id,
      totalAttempts: endedSession.totalAttempts,
      totalConnects: endedSession.totalConnects,
      totalAbandoned: endedSession.totalAbandoned,
    },
  )

  return transformSession(endedSession)
}

// Pause session
export const pauseSession = async (sessionId: string) => {
  return parallelDialSessionRepository.update(sessionId, { status: 'paused' })
}

// Resume session
export const resumeSession = async (sessionId: string) => {
  return parallelDialSessionRepository.update(sessionId, { status: 'active' })
}

// Get session details
export const getSession = async (
  sessionId: string,
): Promise<ParallelDialSessionResponse | null> => {
  const session = await parallelDialSessionRepository.findById(sessionId)
  if (!session) {
    return null
  }

  const attempts =
    await parallelDialAttemptRepository.findBySessionIdWithLeads(sessionId)

  return {
    ...transformSession(session),
    currentAttempts: attempts.map((attempt) => transformAttempt(attempt)),
  }
}

// List sessions
export const listSessions = async (
  organizationId: string,
  filters: {
    status?: string
    userId?: string
  },
  pagination: { page: number; limit: number },
) => {
  const result = await parallelDialSessionRepository.findByOrganization(
    organizationId,
    filters,
    { ...pagination, offset: 0 },
  )

  return {
    data: result.data.map(transformSession),
    total: result.total,
    page: pagination.page,
    limit: pagination.limit,
  }
}

// Get abandoned calls report for compliance
export const getAbandonedCallsReport = async (
  organizationId: string,
  filters: {
    startDate?: string
    endDate?: string
  },
  pagination: { page: number; limit: number },
) => {
  const result = await parallelDialAttemptRepository.getAbandonedCalls(
    organizationId,
    {
      startDate: filters.startDate ? new Date(filters.startDate) : undefined,
      endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    },
    pagination,
  )

  // Fetch lead and user names
  const records: AbandonedCallRecord[] = await Promise.all(
    result.data.map(async (call) => {
      const lead = await leadRepository.findById(call.leadId, organizationId)
      return {
        id: call.id,
        sessionId: call.sessionId,
        leadId: call.leadId,
        leadName: lead
          ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
          : null,
        leadPhone: lead?.phone || '',
        abandonedAfterMs: call.abandonedAfterMs || 0,
        answeredAt: call.answeredAt?.toISOString() || '',
        endedAt: call.endedAt?.toISOString() || '',
        repUserId: call.userId,
        repName: null, // Would need to join with user table
      }
    }),
  )

  return {
    data: records,
    total: result.total,
    totalAbandonedMs: result.totalAbandonedMs,
    page: pagination.page,
    limit: pagination.limit,
  }
}

// Helper functions
function transformSession(session: any): ParallelDialSessionResponse {
  return {
    id: session.id,
    organizationId: session.organizationId,
    userId: session.userId,
    userName: null, // Would need to join
    campaignId: session.campaignId,
    campaignName: null, // Would need to join
    listId: session.listId,
    listName: null, // Would need to join
    lineCount: session.lineCount,
    status: session.status as any,
    conferenceId: session.conferenceId,
    totalAttempts: session.totalAttempts,
    totalConnects: session.totalConnects,
    totalAbandoned: session.totalAbandoned,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() || null,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

interface LeadData {
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  phone?: string | null
}

function transformAttempt(
  attempt: any,
  leadData?: LeadData,
): ParallelDialAttemptResponse {
  // Lead data can come from joined query fields or from separate leadData param
  const firstName = leadData?.firstName ?? attempt.firstName
  const lastName = leadData?.lastName ?? attempt.lastName
  const company = leadData?.company ?? attempt.company
  const phone = leadData?.phone ?? attempt.phone

  const leadName =
    firstName || lastName ? `${firstName || ''} ${lastName || ''}`.trim() : null

  return {
    id: attempt.id,
    sessionId: attempt.sessionId,
    leadId: attempt.leadId,
    leadName,
    leadCompany: company || null,
    leadPhone: phone || '',
    callSid: attempt.callSid,
    fromNumber: attempt.fromNumber ?? null,
    status: attempt.status as any,
    wasConnected: attempt.wasConnected,
    wasAbandoned: attempt.wasAbandoned,
    abandonedAfterMs: attempt.abandonedAfterMs,
    startedAt: attempt.startedAt.toISOString(),
    answeredAt: attempt.answeredAt?.toISOString() || null,
    endedAt: attempt.endedAt?.toISOString() || null,
  }
}

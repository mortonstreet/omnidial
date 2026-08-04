import { db } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'
import * as telnyxClient from '@/clients/telnyx.client'
import * as telnyxConfigRepository from '@/repositories/twilioConfig.repository'
import { trigger as pusherTrigger } from '@/lib/pusher'
import { PUSHER_EVENTS, channels } from '@shared/types/src/pusher'
import type {
  ManagerListenSessionResponse,
  ManagerListenMode,
} from '@shared/types/src/requests/salesFloor'

// Start a listen session
export const startListenSession = async (
  organizationId: string,
  managerId: string,
  repId: string,
  callId: string,
  mode: ManagerListenMode = 'listen',
): Promise<ManagerListenSessionResponse> => {
  // Get the call to find its conference SID
  const call = await db
    .selectFrom('call')
    .where('id', '=', callId)
    .select(['conferenceSid', 'userId', 'twilioCallSid', 'dialCallSid'])
    .executeTakeFirst()

  if (!call) {
    throw new Error('Call not found')
  }

  if (call.userId !== repId) {
    throw new Error('Call does not belong to specified rep')
  }

  // Use stored conferenceSid, or fall back to predictable conferenceId
  // Conference name is `call-{callId}` and is created when rep starts call
  const conferenceName = call.conferenceSid || `call-${callId}`

  // Create the listen session record
  const session = await db
    .insertInto('manager_listen_session')
    .values({
      id: uuidv4(),
      organizationId,
      managerId,
      repId,
      callId,
      conferenceSid: conferenceName,
      mode,
      startedAt: new Date(),
      createdAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // Add manager to the conference with appropriate settings
  const telnyx = await telnyxClient.getClientForOrganization(organizationId)

  // Dial out from one of the org's own numbers (required by Telnyx)
  const orgConfig =
    await telnyxConfigRepository.findByOrganizationId(organizationId)
  const fromNumber =
    orgConfig?.phoneNumbers?.[0] || process.env.TELNYX_DEFAULT_FROM_NUMBER
  if (!fromNumber) {
    throw new Error(
      'No phone number available to dial the manager into the conference',
    )
  }

  // The rep's leg of the call — whisper mode coaches this call SID
  const repCallSid = call.dialCallSid || call.twilioCallSid || undefined

  // Join the manager to the conference
  // In listen mode: muted, cannot speak
  // In whisper mode: muted to prospect, can speak to rep only (via coaching flag)
  // In barge mode: unmuted, everyone hears
  await telnyx.addConferenceParticipant(conferenceName, {
    from: fromNumber,
    to: `client:manager-${managerId}`, // Manager's WebRTC client identity
    label: `manager-${managerId}`,
    muted: mode === 'listen' || mode === 'whisper',
    coaching: mode === 'whisper',
    callSidToCoach: mode === 'whisper' ? repCallSid : undefined,
    // In whisper mode, manager speaks only to rep (the "call" participant)
  })

  // Get manager name for event
  const manager = await db
    .selectFrom('user')
    .where('id', '=', managerId)
    .select(['name'])
    .executeTakeFirst()

  // Emit event to rep (only if not in listen mode - they shouldn't know in pure listen)
  if (mode !== 'listen') {
    await pusherTrigger(
      channels.privateCall(callId),
      PUSHER_EVENTS.MANAGER_JOINED,
      {
        callId,
        managerId,
        managerName: manager?.name || 'Manager',
        mode,
      },
    )
  }

  return transformSession(session, manager?.name || null)
}

// Change listen mode
export const changeListenMode = async (
  sessionId: string,
  newMode: ManagerListenMode,
): Promise<ManagerListenSessionResponse> => {
  const session = await db
    .selectFrom('manager_listen_session')
    .where('id', '=', sessionId)
    .where('endedAt', 'is', null)
    .selectAll()
    .executeTakeFirst()

  if (!session) {
    throw new Error('Listen session not found or already ended')
  }

  // Update participant settings in the conference
  const telnyx = await telnyxClient.getClientForOrganization(
    session.organizationId,
  )

  // Find the manager participant
  const participants = await telnyx.listConferenceParticipants(
    session.conferenceSid!,
  )

  const managerParticipant = participants.find(
    (p) => p.label === `manager-${session.managerId}`,
  )

  if (managerParticipant) {
    // The rep's leg of the call — whisper mode coaches this call SID
    const repCall = await db
      .selectFrom('call')
      .where('id', '=', session.callId)
      .select(['twilioCallSid', 'dialCallSid'])
      .executeTakeFirst()
    const repCallSid =
      repCall?.dialCallSid || repCall?.twilioCallSid || undefined

    // Update mute and coaching settings based on new mode
    await telnyx.updateConferenceParticipant(
      session.conferenceSid!,
      managerParticipant.callSid,
      {
        muted: newMode === 'listen' || newMode === 'whisper',
        coaching: newMode === 'whisper',
        callSidToCoach: newMode === 'whisper' ? repCallSid : undefined,
      },
    )
  }

  // Update session record
  await db
    .updateTable('manager_listen_session')
    .set({ mode: newMode })
    .where('id', '=', sessionId)
    .execute()

  // Get manager name
  const manager = await db
    .selectFrom('user')
    .where('id', '=', session.managerId)
    .select(['name'])
    .executeTakeFirst()

  // Emit mode change event
  await pusherTrigger(
    channels.privateCall(session.callId),
    PUSHER_EVENTS.MANAGER_MODE_CHANGED,
    {
      callId: session.callId,
      managerId: session.managerId,
      managerName: manager?.name || 'Manager',
      mode: newMode,
    },
  )

  const updatedSession = await db
    .selectFrom('manager_listen_session')
    .where('id', '=', sessionId)
    .selectAll()
    .executeTakeFirstOrThrow()

  return transformSession(updatedSession, manager?.name || null)
}

// End listen session
export const endListenSession = async (
  sessionId: string,
): Promise<ManagerListenSessionResponse> => {
  const session = await db
    .selectFrom('manager_listen_session')
    .where('id', '=', sessionId)
    .selectAll()
    .executeTakeFirst()

  if (!session) {
    throw new Error('Listen session not found')
  }

  // Remove manager from conference
  if (session.conferenceSid) {
    try {
      const telnyx = await telnyxClient.getClientForOrganization(
        session.organizationId,
      )

      const participants = await telnyx.listConferenceParticipants(
        session.conferenceSid,
      )

      const managerParticipant = participants.find(
        (p) => p.label === `manager-${session.managerId}`,
      )

      if (managerParticipant) {
        await telnyx.removeConferenceParticipant(
          session.conferenceSid,
          managerParticipant.callSid,
        )
      }
    } catch (e) {
      // Conference may have ended already
    }
  }

  // Update session
  await db
    .updateTable('manager_listen_session')
    .set({ endedAt: new Date() })
    .where('id', '=', sessionId)
    .execute()

  // Emit event
  await pusherTrigger(
    channels.privateCall(session.callId),
    PUSHER_EVENTS.MANAGER_LEFT,
    {
      callId: session.callId,
      managerId: session.managerId,
    },
  )

  const updatedSession = await db
    .selectFrom('manager_listen_session')
    .where('id', '=', sessionId)
    .selectAll()
    .executeTakeFirstOrThrow()

  return transformSession(updatedSession, null)
}

// Get active listen sessions for an organization
export const getActiveListenSessions = async (
  organizationId: string,
): Promise<ManagerListenSessionResponse[]> => {
  const sessions = await db
    .selectFrom('manager_listen_session as mls')
    .leftJoin('user as manager', 'manager.id', 'mls.managerId')
    .leftJoin('user as rep', 'rep.id', 'mls.repId')
    .where('mls.organizationId', '=', organizationId)
    .where('mls.endedAt', 'is', null)
    .select([
      'mls.id',
      'mls.organizationId',
      'mls.managerId',
      'mls.repId',
      'mls.callId',
      'mls.conferenceSid',
      'mls.mode',
      'mls.startedAt',
      'mls.endedAt',
      'manager.name as managerName',
      'rep.name as repName',
    ])
    .execute()

  return sessions.map((s) => ({
    id: s.id,
    organizationId: s.organizationId,
    managerId: s.managerId,
    managerName: s.managerName,
    repId: s.repId,
    repName: s.repName,
    callId: s.callId,
    conferenceSid: s.conferenceSid,
    mode: s.mode as ManagerListenMode,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() || null,
  }))
}

// Auto-end listen sessions when call ends
export const handleCallEnded = async (callId: string) => {
  const activeSessions = await db
    .selectFrom('manager_listen_session')
    .where('callId', '=', callId)
    .where('endedAt', 'is', null)
    .selectAll()
    .execute()

  for (const session of activeSessions) {
    await db
      .updateTable('manager_listen_session')
      .set({ endedAt: new Date() })
      .where('id', '=', session.id)
      .execute()

    await pusherTrigger(
      channels.privateCall(callId),
      PUSHER_EVENTS.MANAGER_LEFT,
      {
        callId,
        managerId: session.managerId,
      },
    )
  }
}

function transformSession(
  session: any,
  managerName: string | null,
): ManagerListenSessionResponse {
  return {
    id: session.id,
    organizationId: session.organizationId,
    managerId: session.managerId,
    managerName,
    repId: session.repId,
    repName: null,
    callId: session.callId,
    conferenceSid: session.conferenceSid,
    mode: session.mode as ManagerListenMode,
    startedAt: session.startedAt.toISOString(),
    endedAt: session.endedAt?.toISOString() || null,
  }
}

import { db } from '@/lib/db'
import { sql } from 'kysely'
import { v4 as uuidv4 } from 'uuid'
import { trigger as pusherTrigger } from '@/lib/pusher'
import { PUSHER_EVENTS, channels } from '@shared/types/src/pusher'
import type {
  BlitzResponse,
  BlitzParticipantResponse,
  BlitzStatus,
  BlitzGoalType,
} from '@shared/types/src/requests/salesFloor'

// Create a new blitz
export const createBlitz = async (
  organizationId: string,
  createdById: string,
  data: {
    name: string
    description?: string
    startAt: Date
    endAt: Date
    goalType?: BlitzGoalType
    goalTarget?: number
    prizeDescription?: string
  },
): Promise<BlitzResponse> => {
  const blitz = await db
    .insertInto('call_blitz')
    .values({
      id: uuidv4(),
      organizationId,
      createdById,
      name: data.name,
      description: data.description ?? null,
      status: 'scheduled',
      startAt: data.startAt,
      endAt: data.endAt,
      goalType: data.goalType ?? 'calls',
      goalTarget: data.goalTarget ?? null,
      prizeDescription: data.prizeDescription ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  return transformBlitz(blitz, [], null)
}

// Update a blitz
export const updateBlitz = async (
  blitzId: string,
  data: {
    name?: string
    description?: string | null
    startAt?: Date
    endAt?: Date
    goalType?: BlitzGoalType
    goalTarget?: number | null
    prizeDescription?: string | null
  },
): Promise<BlitzResponse> => {
  const updated = await db
    .updateTable('call_blitz')
    .set({
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startAt !== undefined && { startAt: data.startAt }),
      ...(data.endAt !== undefined && { endAt: data.endAt }),
      ...(data.goalType !== undefined && { goalType: data.goalType }),
      ...(data.goalTarget !== undefined && { goalTarget: data.goalTarget }),
      ...(data.prizeDescription !== undefined && {
        prizeDescription: data.prizeDescription,
      }),
      updatedAt: new Date(),
    })
    .where('id', '=', blitzId)
    .returningAll()
    .executeTakeFirstOrThrow()

  const participants = await getBlitzParticipants(blitzId)
  return transformBlitz(updated, participants, null)
}

// Start a blitz
export const startBlitz = async (blitzId: string): Promise<BlitzResponse> => {
  const blitz = await db
    .selectFrom('call_blitz')
    .where('id', '=', blitzId)
    .selectAll()
    .executeTakeFirst()

  if (!blitz) {
    throw new Error('Blitz not found')
  }

  if (blitz.status !== 'scheduled') {
    throw new Error('Blitz can only be started from scheduled status')
  }

  const updated = await db
    .updateTable('call_blitz')
    .set({
      status: 'active',
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', blitzId)
    .returningAll()
    .executeTakeFirstOrThrow()

  const participants = await getBlitzParticipants(blitzId)
  const response = transformBlitz(updated, participants, null)

  // Emit blitz started event
  await pusherTrigger(
    channels.presenceOrg(blitz.organizationId),
    PUSHER_EVENTS.BLITZ_STARTED,
    { blitz: response },
  )

  return response
}

// End a blitz
export const endBlitz = async (blitzId: string): Promise<BlitzResponse> => {
  const blitz = await db
    .selectFrom('call_blitz')
    .where('id', '=', blitzId)
    .selectAll()
    .executeTakeFirst()

  if (!blitz) {
    throw new Error('Blitz not found')
  }

  const updated = await db
    .updateTable('call_blitz')
    .set({
      status: 'ended',
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where('id', '=', blitzId)
    .returningAll()
    .executeTakeFirstOrThrow()

  const participants = await getBlitzParticipants(blitzId)

  // Determine winner
  let winner: { userId: string; userName: string; score: number } | null = null
  if (participants.length > 0) {
    const sorted = [...participants].sort((a, b) => {
      switch (blitz.goalType) {
        case 'connects':
          return b.connectCount - a.connectCount
        case 'meetings':
          return b.meetingCount - a.meetingCount
        default:
          return b.callCount - a.callCount
      }
    })
    const top = sorted[0]
    winner = {
      userId: top.userId,
      userName: top.userName || 'Unknown',
      score:
        blitz.goalType === 'connects'
          ? top.connectCount
          : blitz.goalType === 'meetings'
            ? top.meetingCount
            : top.callCount,
    }
  }

  // Emit blitz ended event
  await pusherTrigger(
    channels.presenceOrg(blitz.organizationId),
    PUSHER_EVENTS.BLITZ_ENDED,
    {
      blitzId,
      winner,
    },
  )

  return transformBlitz(updated, participants, null)
}

// Join a blitz
export const joinBlitz = async (
  blitzId: string,
  userId: string,
): Promise<BlitzParticipantResponse> => {
  const blitz = await db
    .selectFrom('call_blitz')
    .where('id', '=', blitzId)
    .selectAll()
    .executeTakeFirst()

  if (!blitz) {
    throw new Error('Blitz not found')
  }

  if (blitz.status !== 'active' && blitz.status !== 'scheduled') {
    throw new Error('Cannot join a blitz that is not active or scheduled')
  }

  // Check if already joined
  const existing = await db
    .selectFrom('blitz_participant')
    .where('blitzId', '=', blitzId)
    .where('userId', '=', userId)
    .selectAll()
    .executeTakeFirst()

  if (existing) {
    throw new Error('Already joined this blitz')
  }

  const participant = await db
    .insertInto('blitz_participant')
    .values({
      id: uuidv4(),
      blitzId,
      userId,
      callCount: 0,
      connectCount: 0,
      meetingCount: 0,
      joinedAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirstOrThrow()

  // Get user name
  const user = await db
    .selectFrom('user')
    .where('id', '=', userId)
    .select(['name', 'image'])
    .executeTakeFirst()

  // Emit participant joined event
  await pusherTrigger(
    channels.privateBlitz(blitzId),
    PUSHER_EVENTS.BLITZ_PARTICIPANT_JOINED,
    {
      blitzId,
      userId,
      userName: user?.name || 'Unknown',
    },
  )

  return {
    id: participant.id,
    userId: participant.userId,
    userName: user?.name || 'Unknown',
    userImage: user?.image || null,
    callCount: participant.callCount,
    connectCount: participant.connectCount,
    meetingCount: participant.meetingCount,
    rank: null,
    joinedAt: participant.joinedAt.toISOString(),
  }
}

// Get blitz details
export const getBlitz = async (
  blitzId: string,
): Promise<BlitzResponse | null> => {
  const blitz = await db
    .selectFrom('call_blitz as cb')
    .leftJoin('user as u', 'u.id', 'cb.createdById')
    .where('cb.id', '=', blitzId)
    .select([
      'cb.id',
      'cb.organizationId',
      'cb.name',
      'cb.description',
      'cb.status',
      'cb.startAt',
      'cb.endAt',
      'cb.goalType',
      'cb.goalTarget',
      'cb.prizeDescription',
      'cb.createdById',
      'cb.startedAt',
      'cb.endedAt',
      'cb.createdAt',
      'cb.updatedAt',
      'u.name as createdByName',
    ])
    .executeTakeFirst()

  if (!blitz) {
    return null
  }

  const participants = await getBlitzParticipants(blitzId)
  return transformBlitz(blitz, participants, blitz.createdByName)
}

// List blitzes
export const listBlitzes = async (
  organizationId: string,
  filters: { status?: BlitzStatus },
  pagination: { page: number; limit: number },
) => {
  let query = db
    .selectFrom('call_blitz')
    .where('organizationId', '=', organizationId)

  if (filters.status) {
    query = query.where('status', '=', filters.status)
  }

  const countResult = await query
    .select((eb) => eb.fn.countAll().as('count'))
    .executeTakeFirstOrThrow()

  const offset = (pagination.page - 1) * pagination.limit

  const blitzes = await query
    .selectAll()
    .orderBy('startAt', 'desc')
    .limit(pagination.limit)
    .offset(offset)
    .execute()

  const blitzResponses = await Promise.all(
    blitzes.map(async (blitz) => {
      const participants = await getBlitzParticipants(blitz.id)
      return transformBlitz(blitz, participants, null)
    }),
  )

  return {
    data: blitzResponses,
    total: Number(countResult.count),
    page: pagination.page,
    limit: pagination.limit,
  }
}

// Record a call for blitz tracking
export const recordBlitzCall = async (
  userId: string,
  wasConnected: boolean,
) => {
  // Find active blitzes the user is participating in
  const participations = await db
    .selectFrom('blitz_participant as bp')
    .innerJoin('call_blitz as cb', 'cb.id', 'bp.blitzId')
    .where('bp.userId', '=', userId)
    .where('cb.status', '=', 'active')
    .select(['bp.id', 'bp.blitzId', 'cb.organizationId', 'cb.goalType'])
    .execute()

  for (const participation of participations) {
    // Increment counts
    await db
      .updateTable('blitz_participant')
      .set({
        callCount: sql`"callCount" + 1`,
        ...(wasConnected && { connectCount: sql`"connectCount" + 1` }),
        updatedAt: new Date(),
      })
      .where('id', '=', participation.id)
      .execute()

    // Update rankings and emit leaderboard update
    await updateBlitzRankings(participation.blitzId)
    await emitBlitzLeaderboardUpdate(participation.blitzId)
  }
}

// Update blitz rankings
async function updateBlitzRankings(blitzId: string) {
  const blitz = await db
    .selectFrom('call_blitz')
    .where('id', '=', blitzId)
    .select(['goalType'])
    .executeTakeFirst()

  if (!blitz) return

  // Get participants sorted by goal metric
  const participants = await db
    .selectFrom('blitz_participant')
    .where('blitzId', '=', blitzId)
    .selectAll()
    .execute()

  const sorted = [...participants].sort((a, b) => {
    switch (blitz.goalType) {
      case 'connects':
        return b.connectCount - a.connectCount
      case 'meetings':
        return b.meetingCount - a.meetingCount
      default:
        return b.callCount - a.callCount
    }
  })

  // Update ranks
  for (let i = 0; i < sorted.length; i++) {
    await db
      .updateTable('blitz_participant')
      .set({ rank: i + 1 })
      .where('id', '=', sorted[i].id)
      .execute()
  }
}

// Emit blitz leaderboard update
async function emitBlitzLeaderboardUpdate(blitzId: string) {
  const blitz = await db
    .selectFrom('call_blitz')
    .where('id', '=', blitzId)
    .select(['goalType', 'organizationId'])
    .executeTakeFirst()

  if (!blitz) return

  const participants = await db
    .selectFrom('blitz_participant as bp')
    .innerJoin('user as u', 'u.id', 'bp.userId')
    .where('bp.blitzId', '=', blitzId)
    .select([
      'bp.userId',
      'bp.rank',
      'bp.callCount',
      'bp.connectCount',
      'bp.meetingCount',
      'u.name as userName',
    ])
    .orderBy('bp.rank', 'asc')
    .execute()

  const leaderboard = participants.map((p) => ({
    rank: p.rank || 0,
    userId: p.userId,
    userName: p.userName || 'Unknown',
    score:
      blitz.goalType === 'connects'
        ? p.connectCount
        : blitz.goalType === 'meetings'
          ? p.meetingCount
          : p.callCount,
  }))

  await pusherTrigger(
    channels.privateBlitz(blitzId),
    PUSHER_EVENTS.BLITZ_LEADERBOARD_UPDATE,
    {
      blitzId,
      leaderboard,
    },
  )
}

// Get blitz participants
async function getBlitzParticipants(
  blitzId: string,
): Promise<BlitzParticipantResponse[]> {
  const participants = await db
    .selectFrom('blitz_participant as bp')
    .leftJoin('user as u', 'u.id', 'bp.userId')
    .where('bp.blitzId', '=', blitzId)
    .select([
      'bp.id',
      'bp.userId',
      'bp.callCount',
      'bp.connectCount',
      'bp.meetingCount',
      'bp.rank',
      'bp.joinedAt',
      'u.name as userName',
      'u.image as userImage',
    ])
    .orderBy('bp.rank', 'asc')
    .execute()

  return participants.map((p) => ({
    id: p.id,
    userId: p.userId,
    userName: p.userName || 'Unknown',
    userImage: p.userImage,
    callCount: p.callCount,
    connectCount: p.connectCount,
    meetingCount: p.meetingCount,
    rank: p.rank,
    joinedAt: p.joinedAt.toISOString(),
  }))
}

function transformBlitz(
  blitz: any,
  participants: BlitzParticipantResponse[],
  createdByName: string | null,
): BlitzResponse {
  // Calculate totals
  const totalCalls = participants.reduce((sum, p) => sum + p.callCount, 0)
  const totalConnects = participants.reduce((sum, p) => sum + p.connectCount, 0)
  const totalMeetings = participants.reduce((sum, p) => sum + p.meetingCount, 0)

  // Calculate goal progress
  let goalProgress: number | null = null
  if (blitz.goalTarget) {
    const currentTotal =
      blitz.goalType === 'connects'
        ? totalConnects
        : blitz.goalType === 'meetings'
          ? totalMeetings
          : totalCalls
    goalProgress = Math.min(100, (currentTotal / blitz.goalTarget) * 100)
  }

  return {
    id: blitz.id,
    organizationId: blitz.organizationId,
    name: blitz.name,
    description: blitz.description,
    status: blitz.status as BlitzStatus,
    startAt: blitz.startAt.toISOString(),
    endAt: blitz.endAt.toISOString(),
    goalType: blitz.goalType as BlitzGoalType,
    goalTarget: blitz.goalTarget,
    prizeDescription: blitz.prizeDescription,
    createdById: blitz.createdById,
    createdByName,
    startedAt: blitz.startedAt?.toISOString() || null,
    endedAt: blitz.endedAt?.toISOString() || null,
    createdAt: blitz.createdAt.toISOString(),
    updatedAt: blitz.updatedAt.toISOString(),
    participants,
    totalParticipants: participants.length,
    totalCalls,
    totalConnects,
    totalMeetings,
    goalProgress,
  }
}

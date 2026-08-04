import { db } from '@/lib/db'
import { sql } from 'kysely'
import { trigger as pusherTrigger } from '@/lib/pusher'
import { PUSHER_EVENTS, channels } from '@shared/types/src/pusher'
import type {
  SalesFloorStatusResponse,
  ActiveRepStatus,
  LeaderboardResponse,
  SalesFloorLeaderboardEntry,
  BlitzParticipantResponse,
  BlitzGoalType,
} from '@shared/types/src/requests/salesFloor'

// Get real-time sales floor status
export const getSalesFloorStatus = async (
  organizationId: string,
): Promise<SalesFloorStatusResponse> => {
  // Get all active dialer sessions
  const activeSessions = await db
    .selectFrom('active_dialer_session as ads')
    .innerJoin('user as u', 'u.id', 'ads.userId')
    .leftJoin('campaign as c', 'c.id', 'ads.campaignId')
    .where('ads.organizationId', '=', organizationId)
    .where('ads.status', 'in', ['active', 'paused'])
    .select([
      'ads.id',
      'ads.userId',
      'ads.status',
      'ads.currentCallId',
      'ads.currentLeadId',
      'ads.currentLeadName',
      'ads.campaignId',
      'ads.callsThisSession',
      'ads.connectedThisSession',
      'ads.startedAt',
      'u.name as userName',
      'u.image as userImage',
      'c.name as campaignName',
    ])
    .execute()

  // Get current call info for active sessions
  const activeReps: ActiveRepStatus[] = []
  let totalOnCalls = 0
  let totalDialing = 0

  for (const session of activeSessions) {
    let status: ActiveRepStatus['status'] = 'idle'
    let callDuration: number | null = null

    if (session.currentCallId) {
      // Get the current call details
      const call = await db
        .selectFrom('call')
        .where('id', '=', session.currentCallId)
        .select(['status', 'startedAt', 'answeredAt'])
        .executeTakeFirst()

      if (call) {
        if (call.status === 'in-progress') {
          status = 'on_call'
          totalOnCalls++
          if (call.answeredAt) {
            callDuration = Math.floor(
              (Date.now() - call.answeredAt.getTime()) / 1000,
            )
          }
        } else if (call.status === 'ringing' || call.status === 'initiated') {
          status = 'dialing'
          totalDialing++
        }
      }
    }

    activeReps.push({
      userId: session.userId,
      userName: session.userName || 'Unknown',
      userImage: session.userImage,
      status,
      currentCallId: session.currentCallId,
      currentLeadId: session.currentLeadId,
      currentLeadName: session.currentLeadName,
      callDuration,
      campaignId: session.campaignId,
      campaignName: session.campaignName,
      callsThisSession: session.callsThisSession,
      connectedThisSession: session.connectedThisSession,
      sessionStartedAt: session.startedAt.toISOString(),
    })
  }

  // Get today's totals
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const todayStats = await db
    .selectFrom('call as c')
    .innerJoin('twilio_config as tc', 'tc.id', 'c.twilioConfigId')
    .where('tc.organizationId', '=', organizationId)
    .where('c.direction', '=', 'outbound')
    .where('c.startedAt', '>=', today)
    .select([
      sql<number>`COUNT(*)::int`.as('totalCalls'),
      sql<number>`COUNT(*) FILTER (WHERE c."answeredAt" IS NOT NULL)::int`.as(
        'totalConnects',
      ),
    ])
    .executeTakeFirstOrThrow()

  // Get active blitz if any
  const activeBlitz = await db
    .selectFrom('call_blitz')
    .where('organizationId', '=', organizationId)
    .where('status', '=', 'active')
    .selectAll()
    .executeTakeFirst()

  let blitzResponse = null
  if (activeBlitz) {
    // Get participants from blitz_participant table
    const participants = await db
      .selectFrom('blitz_participant as bp')
      .leftJoin('user as u', 'u.id', 'bp.userId')
      .where('bp.blitzId', '=', activeBlitz.id)
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

    const participantResponses: BlitzParticipantResponse[] = participants.map(
      (p) => ({
        id: p.id,
        userId: p.userId,
        userName: p.userName || 'Unknown',
        userImage: p.userImage,
        callCount: p.callCount,
        connectCount: p.connectCount,
        meetingCount: p.meetingCount,
        rank: p.rank,
        joinedAt: p.joinedAt.toISOString(),
      }),
    )

    // Calculate totals from participants
    const totalCalls = participantResponses.reduce(
      (sum, p) => sum + p.callCount,
      0,
    )
    const totalConnects = participantResponses.reduce(
      (sum, p) => sum + p.connectCount,
      0,
    )
    const totalMeetings = participantResponses.reduce(
      (sum, p) => sum + p.meetingCount,
      0,
    )

    // Calculate goal progress
    let goalProgress: number | null = null
    if (activeBlitz.goalTarget) {
      const goalType = activeBlitz.goalType as BlitzGoalType
      const currentTotal =
        goalType === 'connects'
          ? totalConnects
          : goalType === 'meetings'
            ? totalMeetings
            : totalCalls
      goalProgress = Math.min(
        100,
        Math.round((currentTotal / activeBlitz.goalTarget) * 100),
      )
    }

    blitzResponse = {
      id: activeBlitz.id,
      organizationId: activeBlitz.organizationId,
      name: activeBlitz.name,
      description: activeBlitz.description,
      status: activeBlitz.status as any,
      startAt: activeBlitz.startAt.toISOString(),
      endAt: activeBlitz.endAt.toISOString(),
      goalType: activeBlitz.goalType as BlitzGoalType,
      goalTarget: activeBlitz.goalTarget,
      prizeDescription: activeBlitz.prizeDescription,
      createdById: activeBlitz.createdById,
      createdByName: null,
      startedAt: activeBlitz.startedAt?.toISOString() || null,
      endedAt: activeBlitz.endedAt?.toISOString() || null,
      createdAt: activeBlitz.createdAt.toISOString(),
      updatedAt: activeBlitz.updatedAt.toISOString(),
      participants: participantResponses,
      totalParticipants: participantResponses.length,
      totalCalls,
      totalConnects,
      totalMeetings,
      goalProgress,
    }
  }

  return {
    organizationId,
    activeReps,
    totalActiveReps: activeReps.length,
    totalOnCalls,
    totalDialing,
    totalCallsToday: todayStats.totalCalls,
    totalConnectsToday: todayStats.totalConnects,
    activeBlitz: blitzResponse,
  }
}

// Get leaderboard
export const getLeaderboard = async (
  organizationId: string,
  period: 'today' | 'week' | 'month' | '90d' | 'all',
  metric: 'calls' | 'connects' | 'talkTime',
): Promise<LeaderboardResponse> => {
  // Determine date filter
  let startDate: Date | null = null
  const now = new Date()

  switch (period) {
    case 'today':
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
      break
    case 'week':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 7)
      break
    case 'month':
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 1)
      break
    case '90d':
      startDate = new Date(now)
      startDate.setDate(now.getDate() - 90)
      break
    case 'all':
      startDate = null
      break
  }

  // Build query for call stats by user
  let query = db
    .selectFrom('call as c')
    .innerJoin('twilio_config as tc', 'tc.id', 'c.twilioConfigId')
    .innerJoin('user as u', 'u.id', 'c.userId')
    .where('tc.organizationId', '=', organizationId)
    .where('c.direction', '=', 'outbound')
    .groupBy(['c.userId', 'u.name', 'u.image'])

  if (startDate) {
    query = query.where('c.startedAt', '>=', startDate)
  }

  const stats = await query
    .select([
      'c.userId',
      'u.name as userName',
      'u.image as userImage',
      sql<number>`COUNT(*)::int`.as('callCount'),
      sql<number>`COUNT(*) FILTER (WHERE c."answeredAt" IS NOT NULL)::int`.as(
        'connectCount',
      ),
      sql<number>`COALESCE(SUM(c.duration), 0)::int`.as('talkTimeSeconds'),
    ])
    .execute()

  // Get meeting counts (from schedule events)
  const meetingCounts = new Map<string, number>()
  let meetingQuery = db
    .selectFrom('schedule_event')
    .where('organizationId', '=', organizationId)
    .where('type', '=', 'meeting')

  if (startDate) {
    meetingQuery = meetingQuery.where('createdAt', '>=', startDate)
  }

  const meetingStats = await meetingQuery
    .groupBy('userId')
    .select(['userId', sql<number>`COUNT(*)::int`.as('count')])
    .execute()

  for (const ms of meetingStats) {
    meetingCounts.set(ms.userId, ms.count)
  }

  // Combine and sort
  const entries: SalesFloorLeaderboardEntry[] = stats.map((s) => ({
    rank: 0,
    userId: s.userId,
    userName: s.userName || 'Unknown',
    userImage: s.userImage,
    callCount: s.callCount,
    connectCount: s.connectCount,
    talkTimeSeconds: s.talkTimeSeconds,
    meetingCount: meetingCounts.get(s.userId) || 0,
  }))

  // Sort by selected metric
  entries.sort((a, b) => {
    switch (metric) {
      case 'calls':
        return b.callCount - a.callCount
      case 'connects':
        return b.connectCount - a.connectCount
      case 'talkTime':
        return b.talkTimeSeconds - a.talkTimeSeconds
      default:
        return b.callCount - a.callCount
    }
  })

  // Assign ranks
  entries.forEach((entry, index) => {
    entry.rank = index + 1
  })

  return {
    organizationId,
    period,
    metric,
    entries,
  }
}

// Emit rep status update (called when dialer session changes)
export const emitRepStatusUpdate = async (
  organizationId: string,
  userId: string,
) => {
  // Get updated session info
  const session = await db
    .selectFrom('active_dialer_session as ads')
    .innerJoin('user as u', 'u.id', 'ads.userId')
    .leftJoin('campaign as c', 'c.id', 'ads.campaignId')
    .where('ads.organizationId', '=', organizationId)
    .where('ads.userId', '=', userId)
    .where('ads.status', 'in', ['active', 'paused'])
    .select([
      'ads.id',
      'ads.userId',
      'ads.status',
      'ads.currentCallId',
      'ads.currentLeadId',
      'ads.currentLeadName',
      'ads.campaignId',
      'ads.callsThisSession',
      'ads.connectedThisSession',
      'ads.startedAt',
      'u.name as userName',
      'u.image as userImage',
      'c.name as campaignName',
    ])
    .executeTakeFirst()

  if (!session) {
    return
  }

  let status: ActiveRepStatus['status'] = 'idle'
  let callDuration: number | null = null

  if (session.currentCallId) {
    const call = await db
      .selectFrom('call')
      .where('id', '=', session.currentCallId)
      .select(['status', 'answeredAt'])
      .executeTakeFirst()

    if (call) {
      if (call.status === 'in-progress') {
        status = 'on_call'
        if (call.answeredAt) {
          callDuration = Math.floor(
            (Date.now() - call.answeredAt.getTime()) / 1000,
          )
        }
      } else if (call.status === 'ringing' || call.status === 'initiated') {
        status = 'dialing'
      }
    }
  }

  const rep: ActiveRepStatus = {
    userId: session.userId,
    userName: session.userName || 'Unknown',
    userImage: session.userImage,
    status,
    currentCallId: session.currentCallId,
    currentLeadId: session.currentLeadId,
    currentLeadName: session.currentLeadName,
    callDuration,
    campaignId: session.campaignId,
    campaignName: session.campaignName,
    callsThisSession: session.callsThisSession,
    connectedThisSession: session.connectedThisSession,
    sessionStartedAt: session.startedAt.toISOString(),
  }

  await pusherTrigger(
    channels.presenceOrg(organizationId),
    PUSHER_EVENTS.REP_STATUS_UPDATE,
    { rep },
  )
}

// Emit leaderboard update (called after call completion)
export const emitLeaderboardUpdate = async (organizationId: string) => {
  const leaderboard = await getLeaderboard(organizationId, 'today', 'calls')

  await pusherTrigger(
    channels.presenceOrg(organizationId),
    PUSHER_EVENTS.LEADERBOARD_UPDATE,
    {
      period: 'today',
      entries: leaderboard.entries.slice(0, 10), // Top 10
    },
  )
}

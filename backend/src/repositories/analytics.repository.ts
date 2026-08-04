import { db } from '@/lib/db'
import { sql } from 'kysely'

export interface CallMetrics {
  totalCalls: number
  outboundCalls: number
  inboundCalls: number
  connectedCalls: number
  connectionRate: number
  totalTalkTimeSeconds: number
  avgCallDurationSeconds: number
}

export interface DispositionBreakdown {
  dispositionId: string | null
  label: string
  count: number
  color: string
}

export interface CallsOverTime {
  date: string
  outbound: number
  inbound: number
  connected: number
}

export interface AnalyticsFilters {
  twilioConfigId: string
  startDate: Date
  endDate: Date
  userId?: string
  campaignId?: string
  clientId?: string
}

/**
 * Get aggregate call metrics for a time period
 */
export const getCallMetrics = async (
  filters: AnalyticsFilters,
): Promise<CallMetrics> => {
  let query = db
    .selectFrom('call')
    .select([
      db.fn.count('id').as('totalCalls'),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'outbound')`.as(
        'outboundCalls',
      ),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'inbound')`.as(
        'inboundCalls',
      ),
      sql<number>`COUNT(*) FILTER (WHERE status = 'completed' AND duration > 0)`.as(
        'connectedCalls',
      ),
      sql<number>`COALESCE(SUM(duration), 0)`.as('totalTalkTimeSeconds'),
      sql<number>`COALESCE(AVG(NULLIF(duration, 0)), 0)`.as(
        'avgCallDurationSeconds',
      ),
    ])
    .where('twilioConfigId', '=', filters.twilioConfigId)
    .where('startedAt', '>=', filters.startDate)
    .where('startedAt', '<=', filters.endDate)

  if (filters.userId) {
    query = query.where('userId', '=', filters.userId)
  }
  if (filters.campaignId) {
    query = query.where('campaignId', '=', filters.campaignId)
  }

  const result = await query.executeTakeFirst()

  const totalCalls = Number(result?.totalCalls || 0)
  const connectedCalls = Number(result?.connectedCalls || 0)

  return {
    totalCalls,
    outboundCalls: Number(result?.outboundCalls || 0),
    inboundCalls: Number(result?.inboundCalls || 0),
    connectedCalls,
    connectionRate:
      totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
    totalTalkTimeSeconds: Number(result?.totalTalkTimeSeconds || 0),
    avgCallDurationSeconds: Math.round(
      Number(result?.avgCallDurationSeconds || 0),
    ),
  }
}

/**
 * Get call counts grouped by disposition
 */
export const getDispositionBreakdown = async (
  filters: AnalyticsFilters,
): Promise<DispositionBreakdown[]> => {
  let query = db
    .selectFrom('call')
    .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
    .select([
      'call.dispositionId',
      sql<string>`COALESCE(disposition.label, 'No Status')`.as('label'),
      sql<string>`COALESCE(disposition.color, '#6B7280')`.as('color'),
      db.fn.count('call.id').as('count'),
    ])
    .where('call.twilioConfigId', '=', filters.twilioConfigId)
    .where('call.startedAt', '>=', filters.startDate)
    .where('call.startedAt', '<=', filters.endDate)
    .groupBy(['call.dispositionId', 'disposition.label', 'disposition.color'])
    .orderBy(db.fn.count('call.id'), 'desc')

  if (filters.userId) {
    query = query.where('call.userId', '=', filters.userId)
  }
  if (filters.campaignId) {
    query = query.where('call.campaignId', '=', filters.campaignId)
  }

  const results = await query.execute()

  return results.map((row) => ({
    dispositionId: row.dispositionId,
    label: row.label,
    color: row.color,
    count: Number(row.count),
  }))
}

/**
 * Get calls grouped by day for charting
 */
export const getCallsOverTime = async (
  filters: AnalyticsFilters,
): Promise<CallsOverTime[]> => {
  let query = db
    .selectFrom('call')
    .select([
      sql<string>`DATE(call."startedAt")`.as('date'),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'outbound')`.as(
        'outbound',
      ),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'inbound')`.as('inbound'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'completed' AND duration > 0)`.as(
        'connected',
      ),
    ])
    .where('twilioConfigId', '=', filters.twilioConfigId)
    .where('startedAt', '>=', filters.startDate)
    .where('startedAt', '<=', filters.endDate)
    .groupBy(sql`DATE(call."startedAt")`)
    .orderBy('date', 'asc')

  if (filters.userId) {
    query = query.where('userId', '=', filters.userId)
  }
  if (filters.campaignId) {
    query = query.where('campaignId', '=', filters.campaignId)
  }

  const results = await query.execute()

  return results.map((row) => ({
    date: row.date,
    outbound: Number(row.outbound),
    inbound: Number(row.inbound),
    connected: Number(row.connected),
  }))
}

/**
 * Get rep leaderboard data
 */
export const getLeaderboard = async (
  filters: AnalyticsFilters,
): Promise<
  Array<{
    userId: string
    userName: string | null
    totalCalls: number
    connectedCalls: number
    connectionRate: number
    totalTalkTimeSeconds: number
  }>
> => {
  let query = db
    .selectFrom('call')
    .innerJoin('user', 'user.id', 'call.userId')
    .select([
      'call.userId',
      'user.name as userName',
      db.fn.count('call.id').as('totalCalls'),
      sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed' AND call.duration > 0)`.as(
        'connectedCalls',
      ),
      sql<number>`COALESCE(SUM(call.duration), 0)`.as('totalTalkTimeSeconds'),
    ])
    .where('call.twilioConfigId', '=', filters.twilioConfigId)
    .where('call.startedAt', '>=', filters.startDate)
    .where('call.startedAt', '<=', filters.endDate)
    .groupBy(['call.userId', 'user.name'])
    .orderBy(db.fn.count('call.id'), 'desc')

  if (filters.campaignId) {
    query = query.where('call.campaignId', '=', filters.campaignId)
  }

  const results = await query.execute()

  return results.map((row) => {
    const totalCalls = Number(row.totalCalls)
    const connectedCalls = Number(row.connectedCalls)
    return {
      userId: row.userId,
      userName: row.userName,
      totalCalls,
      connectedCalls,
      connectionRate:
        totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0,
      totalTalkTimeSeconds: Number(row.totalTalkTimeSeconds),
    }
  })
}

// Time-of-day breakdown interfaces
export interface TimeOfDayStats {
  calls: number
  connects: number
  connectionRate: number
  totalTalkTimeSeconds: number
  avgCallDurationSeconds: number
  appointments: number
}

export interface TimeOfDayBreakdown {
  am: TimeOfDayStats
  pm: TimeOfDayStats
}

export interface HourlyActivityRow {
  hour: number
  calls: number
  connects: number
  avgDurationSeconds: number
}

/**
 * Get AM/PM breakdown for calls (AM = 0-11, PM = 12-23)
 */
export const getTimeOfDayBreakdown = async (
  filters: AnalyticsFilters & { userId?: string },
): Promise<TimeOfDayBreakdown> => {
  let query = db
    .selectFrom('call')
    .select([
      // AM stats (hours 0-11)
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12)`.as(
        'amCalls',
      ),
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12 AND call.status = 'completed' AND call.duration > 0)`.as(
        'amConnects',
      ),
      sql<number>`COALESCE(SUM(call.duration) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12), 0)`.as(
        'amTalkTime',
      ),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12), 0)`.as(
        'amAvgDuration',
      ),
      sql<number>`0`.as('amAppointments'),
      // PM stats (hours 12-23)
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12)`.as(
        'pmCalls',
      ),
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12 AND call.status = 'completed' AND call.duration > 0)`.as(
        'pmConnects',
      ),
      sql<number>`COALESCE(SUM(call.duration) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12), 0)`.as(
        'pmTalkTime',
      ),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12), 0)`.as(
        'pmAvgDuration',
      ),
      sql<number>`0`.as('pmAppointments'),
    ])
    .where('call.twilioConfigId', '=', filters.twilioConfigId)
    .where('call.startedAt', '>=', filters.startDate)
    .where('call.startedAt', '<=', filters.endDate)

  if (filters.userId) {
    query = query.where('call.userId', '=', filters.userId)
  }
  if (filters.campaignId) {
    query = query.where('call.campaignId', '=', filters.campaignId)
  }

  const result = await query.executeTakeFirst()

  const amCalls = Number(result?.amCalls || 0)
  const amConnects = Number(result?.amConnects || 0)
  const pmCalls = Number(result?.pmCalls || 0)
  const pmConnects = Number(result?.pmConnects || 0)

  return {
    am: {
      calls: amCalls,
      connects: amConnects,
      connectionRate:
        amCalls > 0 ? Math.round((amConnects / amCalls) * 100) : 0,
      totalTalkTimeSeconds: Number(result?.amTalkTime || 0),
      avgCallDurationSeconds: Math.round(Number(result?.amAvgDuration || 0)),
      appointments: Number(result?.amAppointments || 0),
    },
    pm: {
      calls: pmCalls,
      connects: pmConnects,
      connectionRate:
        pmCalls > 0 ? Math.round((pmConnects / pmCalls) * 100) : 0,
      totalTalkTimeSeconds: Number(result?.pmTalkTime || 0),
      avgCallDurationSeconds: Math.round(Number(result?.pmAvgDuration || 0)),
      appointments: Number(result?.pmAppointments || 0),
    },
  }
}

/**
 * Get hourly activity breakdown (24 hours)
 */
export const getHourlyActivity = async (
  filters: AnalyticsFilters & { userId?: string },
): Promise<HourlyActivityRow[]> => {
  let query = db
    .selectFrom('call')
    .select([
      sql<number>`EXTRACT(HOUR FROM call."startedAt")::int`.as('hour'),
      db.fn.count('call.id').as('calls'),
      sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed' AND call.duration > 0)`.as(
        'connects',
      ),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)), 0)`.as('avgDuration'),
    ])
    .where('call.twilioConfigId', '=', filters.twilioConfigId)
    .where('call.startedAt', '>=', filters.startDate)
    .where('call.startedAt', '<=', filters.endDate)
    .groupBy(sql`EXTRACT(HOUR FROM call."startedAt")`)
    .orderBy(sql`EXTRACT(HOUR FROM call."startedAt")`, 'asc')

  if (filters.userId) {
    query = query.where('call.userId', '=', filters.userId)
  }
  if (filters.campaignId) {
    query = query.where('call.campaignId', '=', filters.campaignId)
  }

  const results = await query.execute()

  // Create a full 24-hour array with zeros for missing hours
  const hourlyMap = new Map(
    results.map((row) => [
      Number(row.hour),
      {
        hour: Number(row.hour),
        calls: Number(row.calls),
        connects: Number(row.connects),
        avgDurationSeconds: Math.round(Number(row.avgDuration)),
      },
    ]),
  )

  return Array.from(
    { length: 24 },
    (_, hour) =>
      hourlyMap.get(hour) || {
        hour,
        calls: 0,
        connects: 0,
        avgDurationSeconds: 0,
      },
  )
}

/**
 * Get rep stats with user info for profile
 */
export const getRepStats = async (
  filters: AnalyticsFilters & { userId: string },
): Promise<{
  userId: string
  userName: string | null
  userImage: string | null
  totalCalls: number
  totalConnects: number
  connectionRate: number
  totalTalkTimeSeconds: number
  avgCallDurationSeconds: number
  appointments: number
} | null> => {
  const result = await db
    .selectFrom('call')
    .innerJoin('user', 'user.id', 'call.userId')
    .select([
      'call.userId',
      'user.name as userName',
      'user.image as userImage',
      db.fn.count('call.id').as('totalCalls'),
      sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed' AND call.duration > 0)`.as(
        'totalConnects',
      ),
      sql<number>`COALESCE(SUM(call.duration), 0)`.as('totalTalkTime'),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)), 0)`.as('avgDuration'),
      sql<number>`0`.as('appointments'),
    ])
    .where('call.twilioConfigId', '=', filters.twilioConfigId)
    .where('call.startedAt', '>=', filters.startDate)
    .where('call.startedAt', '<=', filters.endDate)
    .where('call.userId', '=', filters.userId)
    .groupBy(['call.userId', 'user.name', 'user.image'])
    .executeTakeFirst()

  if (!result) return null

  const totalCalls = Number(result.totalCalls)
  const totalConnects = Number(result.totalConnects)

  return {
    userId: result.userId,
    userName: result.userName,
    userImage: result.userImage,
    totalCalls,
    totalConnects,
    connectionRate:
      totalCalls > 0 ? Math.round((totalConnects / totalCalls) * 100) : 0,
    totalTalkTimeSeconds: Number(result.totalTalkTime),
    avgCallDurationSeconds: Math.round(Number(result.avgDuration)),
    appointments: Number(result.appointments),
  }
}

/**
 * Get campaign-level time of day stats for a user
 */
export const getCampaignTimeOfDayStats = async (
  filters: AnalyticsFilters & { userId: string },
): Promise<
  Array<{
    campaignId: string
    campaignName: string
    am: TimeOfDayStats
    pm: TimeOfDayStats
  }>
> => {
  const results = await db
    .selectFrom('call')
    .innerJoin('campaign', 'campaign.id', 'call.campaignId')
    .select([
      'call.campaignId',
      'campaign.name as campaignName',
      // AM stats
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12)`.as(
        'amCalls',
      ),
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12 AND call.status = 'completed' AND call.duration > 0)`.as(
        'amConnects',
      ),
      sql<number>`COALESCE(SUM(call.duration) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12), 0)`.as(
        'amTalkTime',
      ),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") < 12), 0)`.as(
        'amAvgDuration',
      ),
      sql<number>`0`.as('amAppointments'),
      // PM stats
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12)`.as(
        'pmCalls',
      ),
      sql<number>`COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12 AND call.status = 'completed' AND call.duration > 0)`.as(
        'pmConnects',
      ),
      sql<number>`COALESCE(SUM(call.duration) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12), 0)`.as(
        'pmTalkTime',
      ),
      sql<number>`COALESCE(AVG(NULLIF(call.duration, 0)) FILTER (WHERE EXTRACT(HOUR FROM call."startedAt") >= 12), 0)`.as(
        'pmAvgDuration',
      ),
      sql<number>`0`.as('pmAppointments'),
    ])
    .where('call.twilioConfigId', '=', filters.twilioConfigId)
    .where('call.startedAt', '>=', filters.startDate)
    .where('call.startedAt', '<=', filters.endDate)
    .where('call.userId', '=', filters.userId)
    .where('call.campaignId', 'is not', null)
    .groupBy(['call.campaignId', 'campaign.name'])
    .orderBy(db.fn.count('call.id'), 'desc')
    .execute()

  return results.map((row) => {
    const amCalls = Number(row.amCalls || 0)
    const amConnects = Number(row.amConnects || 0)
    const pmCalls = Number(row.pmCalls || 0)
    const pmConnects = Number(row.pmConnects || 0)

    return {
      campaignId: row.campaignId!,
      campaignName: row.campaignName,
      am: {
        calls: amCalls,
        connects: amConnects,
        connectionRate:
          amCalls > 0 ? Math.round((amConnects / amCalls) * 100) : 0,
        totalTalkTimeSeconds: Number(row.amTalkTime || 0),
        avgCallDurationSeconds: Math.round(Number(row.amAvgDuration || 0)),
        appointments: Number(row.amAppointments || 0),
      },
      pm: {
        calls: pmCalls,
        connects: pmConnects,
        connectionRate:
          pmCalls > 0 ? Math.round((pmConnects / pmCalls) * 100) : 0,
        totalTalkTimeSeconds: Number(row.pmTalkTime || 0),
        avgCallDurationSeconds: Math.round(Number(row.pmAvgDuration || 0)),
        appointments: Number(row.pmAppointments || 0),
      },
    }
  })
}

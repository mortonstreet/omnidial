import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import * as leadRepository from '@/repositories/lead.repository'
import * as callRepository from '@/repositories/call.repository'
import * as userRepository from '@/repositories/user.repository'
import { db } from '@/lib/db'
import { sql } from 'kysely'

// Type for organization context passed from validated API key
interface McpContext {
  organizationId: string
}

export function createMcpServer(context: McpContext) {
  const { organizationId } = context

  const mcpServer = new McpServer({
    name: 'omnidial-mcp-server',
    version: '1.0.0',
  })

  // Tool: get_analytics - Call metrics for a period
  mcpServer.tool(
    'get_analytics',
    {
      startDate: z
        .string()
        .describe('Start date in ISO format (e.g., 2024-01-01)'),
      endDate: z.string().describe('End date in ISO format (e.g., 2024-01-31)'),
      userId: z.string().optional().describe('Filter by specific user ID'),
    },
    async ({ startDate, endDate, userId }) => {
      const startDateObj = new Date(startDate)
      const endDateObj = new Date(endDate)

      let query = db
        .selectFrom('call')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .where('twilio_config.organizationId', '=', organizationId)
        .where('call.startedAt', '>=', startDateObj)
        .where('call.startedAt', '<=', endDateObj)

      if (userId) {
        query = query.where('call.userId', '=', userId)
      }

      const metrics = await query
        .select([
          sql<number>`count(*)::int`.as('totalCalls'),
          sql<number>`count(*) filter (where direction = 'outbound')::int`.as(
            'outboundCalls',
          ),
          sql<number>`count(*) filter (where direction = 'inbound')::int`.as(
            'inboundCalls',
          ),
          sql<number>`count(*) filter (where "answeredAt" is not null)::int`.as(
            'connectedCalls',
          ),
          sql<number>`coalesce(sum(duration), 0)::int`.as(
            'totalTalkTimeSeconds',
          ),
          sql<number>`coalesce(avg(duration) filter (where duration > 0), 0)::int`.as(
            'avgCallDurationSeconds',
          ),
        ])
        .executeTakeFirst()

      const connectionRate =
        metrics?.totalCalls && metrics.totalCalls > 0
          ? Math.round((metrics.connectedCalls / metrics.totalCalls) * 100)
          : 0

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                period: { startDate, endDate },
                metrics: {
                  totalCalls: metrics?.totalCalls || 0,
                  outboundCalls: metrics?.outboundCalls || 0,
                  inboundCalls: metrics?.inboundCalls || 0,
                  connectedCalls: metrics?.connectedCalls || 0,
                  connectionRate,
                  totalTalkTimeSeconds: metrics?.totalTalkTimeSeconds || 0,
                  avgCallDurationSeconds: metrics?.avgCallDurationSeconds || 0,
                },
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Tool: get_leaderboard - Rep performance ranking
  mcpServer.tool(
    'get_leaderboard',
    {
      startDate: z.string().describe('Start date in ISO format'),
      endDate: z.string().describe('End date in ISO format'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe('Number of reps to return'),
    },
    async ({ startDate, endDate, limit }) => {
      const leaderboard = await db
        .selectFrom('call')
        .innerJoin('user', 'user.id', 'call.userId')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .where('twilio_config.organizationId', '=', organizationId)
        .where('call.startedAt', '>=', new Date(startDate))
        .where('call.startedAt', '<=', new Date(endDate))
        .groupBy(['call.userId', 'user.name', 'user.email'])
        .select([
          'call.userId',
          'user.name',
          'user.email',
          sql<number>`count(*)::int`.as('totalCalls'),
          sql<number>`count(*) filter (where "answeredAt" is not null)::int`.as(
            'connectedCalls',
          ),
          sql<number>`coalesce(sum(duration), 0)::int`.as(
            'totalTalkTimeSeconds',
          ),
        ])
        .orderBy(sql`count(*) filter (where "answeredAt" is not null)`, 'desc')
        .limit(limit)
        .execute()

      const rankings = leaderboard.map((rep, index) => ({
        rank: index + 1,
        userId: rep.userId,
        name: rep.name || rep.email,
        totalCalls: rep.totalCalls,
        connectedCalls: rep.connectedCalls,
        connectionRate:
          rep.totalCalls > 0
            ? Math.round((rep.connectedCalls / rep.totalCalls) * 100)
            : 0,
        totalTalkTimeSeconds: rep.totalTalkTimeSeconds,
      }))

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              { period: { startDate, endDate }, rankings },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Tool: search_leads - Search leads by query
  mcpServer.tool(
    'search_leads',
    {
      query: z
        .string()
        .describe('Search query (matches name, email, phone, company)'),
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Maximum results to return'),
    },
    async ({ query, limit }) => {
      const results = await leadRepository.findMany(
        { organizationId, search: query },
        { page: 1, limit, offset: 0 },
      )

      const leads = results.data.map((lead) => ({
        id: lead.id,
        name:
          [lead.firstName, lead.lastName].filter(Boolean).join(' ') ||
          'Unknown',
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        title: lead.title,
        dealValue: lead.dealValue,
        pipelineStageId: lead.pipelineStageId,
      }))

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ total: results.total, leads }, null, 2),
          },
        ],
      }
    },
  )

  // Tool: get_lead - Get detailed lead information
  mcpServer.tool(
    'get_lead',
    {
      leadId: z.string().describe('Lead ID'),
    },
    async ({ leadId }) => {
      const lead = await leadRepository.findById(leadId, organizationId)

      if (!lead) {
        return {
          content: [{ type: 'text' as const, text: 'Lead not found' }],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: lead.id,
                firstName: lead.firstName,
                lastName: lead.lastName,
                email: lead.email,
                phone: lead.phone,
                company: lead.company,
                title: lead.title,
                linkedInUrl: lead.linkedInUrl,
                website: lead.website,
                dealValue: lead.dealValue,
                pipelineStageId: lead.pipelineStageId,
                aiCompanySummary: lead.aiCompanySummary,
                createdAt: lead.createdAt,
                updatedAt: lead.updatedAt,
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Tool: list_calls - List recent calls
  mcpServer.tool(
    'list_calls',
    {
      limit: z
        .number()
        .optional()
        .default(20)
        .describe('Number of calls to return'),
      direction: z
        .enum(['inbound', 'outbound'])
        .optional()
        .describe('Filter by call direction'),
      leadId: z.string().optional().describe('Filter by lead ID'),
    },
    async ({ limit, direction, leadId }) => {
      let query = db
        .selectFrom('call')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .where('twilio_config.organizationId', '=', organizationId)
        .orderBy('call.startedAt', 'desc')
        .limit(limit)

      if (direction) {
        query = query.where('call.direction', '=', direction)
      }

      if (leadId) {
        query = query.where('call.leadId', '=', leadId)
      }

      const calls = await query
        .select([
          'call.id',
          'call.leadId',
          'call.userId',
          'call.direction',
          'call.fromNumber',
          'call.toNumber',
          'call.startedAt',
          'call.endedAt',
          'call.duration',
          'call.answeredAt',
          'call.dispositionId',
          'call.status',
        ])
        .execute()

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ calls }, null, 2),
          },
        ],
      }
    },
  )

  // Tool: get_call - Get detailed call information
  mcpServer.tool(
    'get_call',
    {
      callId: z.string().describe('Call ID'),
    },
    async ({ callId }) => {
      const call = await callRepository.findById(callId)

      if (!call) {
        return {
          content: [{ type: 'text' as const, text: 'Call not found' }],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(call, null, 2),
          },
        ],
      }
    },
  )

  // Tool: get_transcript - Get call transcript/notes
  mcpServer.tool(
    'get_transcript',
    {
      callId: z.string().describe('Call ID'),
    },
    async ({ callId }) => {
      const call = await callRepository.findById(callId)

      if (!call) {
        return {
          content: [{ type: 'text' as const, text: 'Call not found' }],
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                callId: call.id,
                duration: call.duration,
                connected: call.answeredAt !== null,
                // Transcript would come from a separate transcript table/service if available
              },
              null,
              2,
            ),
          },
        ],
      }
    },
  )

  // Tool: analyze_performance - AI-ready performance summary
  mcpServer.tool(
    'analyze_performance',
    {
      userId: z
        .string()
        .optional()
        .describe('Filter by user ID (defaults to all users)'),
      period: z
        .enum(['today', 'week', 'month'])
        .describe('Time period for analysis'),
    },
    async ({ userId, period }) => {
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 1)
          break
      }

      let query = db
        .selectFrom('call')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .where('twilio_config.organizationId', '=', organizationId)
        .where('call.startedAt', '>=', startDate)
        .where('call.startedAt', '<=', now)

      if (userId) {
        query = query.where('call.userId', '=', userId)
      }

      const metrics = await query
        .select([
          sql<number>`count(*)::int`.as('totalCalls'),
          sql<number>`count(*) filter (where "answeredAt" is not null)::int`.as(
            'connectedCalls',
          ),
          sql<number>`count(*) filter (where direction = 'outbound')::int`.as(
            'outboundCalls',
          ),
          sql<number>`count(*) filter (where direction = 'inbound')::int`.as(
            'inboundCalls',
          ),
          sql<number>`coalesce(sum(duration), 0)::int`.as(
            'totalTalkTimeSeconds',
          ),
          sql<number>`coalesce(avg(duration) filter (where duration > 0), 0)::int`.as(
            'avgCallDurationSeconds',
          ),
        ])
        .executeTakeFirst()

      // Get disposition breakdown
      const dispositions = await db
        .selectFrom('call')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
        .where('twilio_config.organizationId', '=', organizationId)
        .where('call.startedAt', '>=', startDate)
        .where('call.startedAt', '<=', now)
        .groupBy('disposition.label')
        .select([
          sql<string>`coalesce(disposition.label, 'No Disposition')`.as(
            'label',
          ),
          sql<number>`count(*)::int`.as('count'),
        ])
        .execute()

      const summary = {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        metrics: {
          totalCalls: metrics?.totalCalls || 0,
          connectedCalls: metrics?.connectedCalls || 0,
          connectionRate:
            metrics?.totalCalls && metrics.totalCalls > 0
              ? Math.round((metrics.connectedCalls / metrics.totalCalls) * 100)
              : 0,
          outboundCalls: metrics?.outboundCalls || 0,
          inboundCalls: metrics?.inboundCalls || 0,
          totalTalkTimeSeconds: metrics?.totalTalkTimeSeconds || 0,
          avgCallDurationSeconds: metrics?.avgCallDurationSeconds || 0,
        },
        dispositionBreakdown: dispositions,
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      }
    },
  )

  // Tool: get_cold_call_insights - Aggregated call patterns
  mcpServer.tool(
    'get_cold_call_insights',
    {
      period: z
        .enum(['week', 'month', 'quarter'])
        .describe('Time period for analysis'),
    },
    async ({ period }) => {
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - 7)
          break
        case 'month':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 1)
          break
        case 'quarter':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 3)
          break
      }

      // Best times to call (by hour)
      const hourlyPerformance = await db
        .selectFrom('call')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .where('twilio_config.organizationId', '=', organizationId)
        .where('call.startedAt', '>=', startDate)
        .where('call.direction', '=', 'outbound')
        .groupBy(sql`extract(hour from "startedAt")`)
        .select([
          sql<number>`extract(hour from "startedAt")::int`.as('hour'),
          sql<number>`count(*)::int`.as('totalCalls'),
          sql<number>`count(*) filter (where "answeredAt" is not null)::int`.as(
            'connectedCalls',
          ),
        ])
        .orderBy(sql`count(*) filter (where "answeredAt" is not null)`, 'desc')
        .execute()

      // Best days of week
      const dailyPerformance = await db
        .selectFrom('call')
        .innerJoin('twilio_config', 'twilio_config.id', 'call.twilioConfigId')
        .where('twilio_config.organizationId', '=', organizationId)
        .where('call.startedAt', '>=', startDate)
        .where('call.direction', '=', 'outbound')
        .groupBy(sql`extract(dow from "startedAt")`)
        .select([
          sql<number>`extract(dow from "startedAt")::int`.as('dayOfWeek'),
          sql<number>`count(*)::int`.as('totalCalls'),
          sql<number>`count(*) filter (where "answeredAt" is not null)::int`.as(
            'connectedCalls',
          ),
        ])
        .orderBy(sql`count(*) filter (where "answeredAt" is not null)`, 'desc')
        .execute()

      const dayNames = [
        'Sunday',
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
      ]

      const insights = {
        period,
        bestHoursToCall: hourlyPerformance.slice(0, 5).map((h) => ({
          hour: h.hour,
          hourFormatted: `${h.hour}:00`,
          connectionRate:
            h.totalCalls > 0
              ? Math.round((h.connectedCalls / h.totalCalls) * 100)
              : 0,
          totalCalls: h.totalCalls,
        })),
        bestDaysToCall: dailyPerformance.slice(0, 5).map((d) => ({
          dayOfWeek: d.dayOfWeek,
          dayName: dayNames[d.dayOfWeek],
          connectionRate:
            d.totalCalls > 0
              ? Math.round((d.connectedCalls / d.totalCalls) * 100)
              : 0,
          totalCalls: d.totalCalls,
        })),
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(insights, null, 2),
          },
        ],
      }
    },
  )

  return mcpServer
}

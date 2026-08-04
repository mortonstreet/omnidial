/**
 * Slack Ask Service
 *
 * Handles AI-powered natural language queries about sales data through Slack.
 * Uses Claude with tool definitions to query leads, calls, agents, and stats.
 */

import Anthropic from '@anthropic-ai/sdk'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import logger from '@/lib/logger'
import { config } from '@/config'
import type { SlackBlocks } from '@/clients/slack.client'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Tool definitions for sales data queries
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_lead_stats',
    description:
      'Get statistics about leads in the pipeline. Returns counts by stage, total pipeline value, and conversion metrics.',
    input_schema: {
      type: 'object' as const,
      properties: {
        timeframe: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter', 'all'],
          description: 'Time period to query. Defaults to all time.',
        },
        stage: {
          type: 'string',
          description:
            'Filter by specific pipeline stage name (e.g., "Qualified", "Proposal")',
        },
      },
      required: [],
    },
  },
  {
    name: 'search_leads',
    description:
      'Search for leads by name, company, email, or phone. Returns matching leads with their current status.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description:
            'Search query - matches against name, company, email, phone',
        },
        stage: {
          type: 'string',
          description: 'Filter by pipeline stage name',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results (default 5, max 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_call_stats',
    description:
      'Get call activity statistics including total calls, connected calls, talk time, and connect rate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        timeframe: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter'],
          description: 'Time period for stats. Defaults to today.',
        },
        userId: {
          type: 'string',
          description: 'Filter by specific user/rep ID',
        },
        direction: {
          type: 'string',
          enum: ['inbound', 'outbound'],
          description: 'Filter by call direction',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_agent_stats',
    description:
      'Get agent (AI assistant) performance metrics including messages sent, approvals pending, and activity.',
    input_schema: {
      type: 'object' as const,
      properties: {
        timeframe: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time period for stats. Defaults to week.',
        },
        agentId: {
          type: 'string',
          description: 'Filter by specific agent ID',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_recent_activity',
    description:
      'Get recent activity feed including calls, lead updates, and agent actions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          enum: ['calls', 'leads', 'agents', 'all'],
          description: 'Filter by activity type. Defaults to all.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of events (default 10, max 25)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_leaderboard',
    description:
      'Get sales rep leaderboard showing top performers by calls, connections, or deals.',
    input_schema: {
      type: 'object' as const,
      properties: {
        timeframe: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          description: 'Time period for leaderboard. Defaults to week.',
        },
        metric: {
          type: 'string',
          enum: ['calls', 'connections', 'talk_time'],
          description: 'Metric to rank by. Defaults to connections.',
        },
        limit: {
          type: 'number',
          description: 'Number of top performers (default 5, max 10)',
        },
      },
      required: [],
    },
  },
]

const SYSTEM_PROMPT = `You are a helpful sales data assistant for a sales dialer platform called OmniDial.
You help users understand their sales data by querying leads, calls, agents, and performance metrics.

When answering questions:
- Be concise and data-focused
- Use specific numbers when available
- Format currency values appropriately
- When showing lists, keep them brief (top 5 unless asked for more)
- If data is not available or empty, say so clearly
- Use natural language, not technical jargon

You have access to tools to query the OmniDial database. Use them to answer questions about:
- Lead pipeline and stages
- Call activity and metrics
- Sales rep performance
- AI agent activity

Always use the appropriate tool to get accurate data. Don't make up numbers.`

// Types
export interface AskQueryResult {
  response: string
  blocks: SlackBlocks
  tokensUsed: { input: number; output: number }
}

interface ToolInput {
  timeframe?: string
  query?: string
  stage?: string
  limit?: number
  userId?: string
  direction?: string
  agentId?: string
  type?: string
  metric?: string
}

// ============================================
// Main Query Handler
// ============================================

export async function processAskQuery(
  query: string,
  organizationId: string,
): Promise<AskQueryResult> {
  try {
    // Call Claude with tools
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: [{ role: 'user', content: query }],
    })

    // Process tool calls if any
    let finalResponse = ''
    const toolResults: Array<{ name: string; result: unknown }> = []

    // Handle tool use loop
    let currentResponse = response
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: query },
    ]

    while (currentResponse.stop_reason === 'tool_use') {
      const assistantContent = currentResponse.content
      messages.push({ role: 'assistant', content: assistantContent })

      const toolUseBlocks = assistantContent.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      )

      const toolResultContents: Anthropic.ToolResultBlockParam[] = []

      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as ToolInput,
          organizationId,
        )
        toolResults.push({ name: toolUse.name, result })

        toolResultContents.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        })
      }

      messages.push({ role: 'user', content: toolResultContents })

      // Continue the conversation
      currentResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        tools: TOOLS,
        messages,
      })
    }

    // Extract final text response
    for (const block of currentResponse.content) {
      if (block.type === 'text') {
        finalResponse += block.text
      }
    }

    // Build Slack blocks for the response
    const blocks = buildResponseBlocks(finalResponse, toolResults)

    return {
      response: finalResponse,
      blocks,
      tokensUsed: {
        input: currentResponse.usage.input_tokens,
        output: currentResponse.usage.output_tokens,
      },
    }
  } catch (error) {
    logger.error(
      { error, query, organizationId },
      'Failed to process ask query',
    )

    return {
      response:
        'Sorry, I encountered an error processing your question. Please try again.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':warning: Sorry, I encountered an error processing your question. Please try again.',
          },
        },
      ],
      tokensUsed: { input: 0, output: 0 },
    }
  }
}

// ============================================
// Tool Execution
// ============================================

async function executeToolCall(
  toolName: string,
  input: ToolInput,
  organizationId: string,
): Promise<unknown> {
  switch (toolName) {
    case 'get_lead_stats':
      return getLeadStats(organizationId, input)
    case 'search_leads':
      return searchLeads(organizationId, input)
    case 'get_call_stats':
      return getCallStats(organizationId, input)
    case 'get_agent_stats':
      return getAgentStats(organizationId, input)
    case 'get_recent_activity':
      return getRecentActivity(organizationId, input)
    case 'get_leaderboard':
      return getLeaderboard(organizationId, input)
    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

// ============================================
// Tool Implementations
// ============================================

async function getLeadStats(
  organizationId: string,
  input: ToolInput,
): Promise<unknown> {
  const { startDate } = getTimeframeDates(input.timeframe || 'all')

  // Get pipeline stages
  const stages = await db
    .selectFrom('pipeline_stage')
    .select(['id', 'label', 'color', 'sortOrder'])
    .where('organizationId', '=', organizationId)
    .orderBy('sortOrder', 'asc')
    .execute()

  // Build base query
  let query = db
    .selectFrom('lead')
    .leftJoin('pipeline_stage', 'pipeline_stage.id', 'lead.pipelineStageId')
    .select([
      'lead.pipelineStageId',
      'pipeline_stage.label as stageName',
      db.fn.count('lead.id').as('count'),
      sql<number>`COALESCE(SUM(lead."dealValue"), 0)`.as('totalValue'),
    ])
    .where('lead.organizationId', '=', organizationId)
    .groupBy(['lead.pipelineStageId', 'pipeline_stage.label'])

  if (startDate) {
    query = query.where('lead.createdAt', '>=', startDate)
  }

  if (input.stage) {
    query = query.where('pipeline_stage.label', 'ilike', `%${input.stage}%`)
  }

  const results = await query.execute()

  const totalLeads = results.reduce((sum, r) => sum + Number(r.count), 0)
  const totalValue = results.reduce((sum, r) => sum + Number(r.totalValue), 0)

  return {
    totalLeads,
    totalPipelineValue: totalValue,
    byStage: results.map((r) => ({
      stage: r.stageName || 'Unassigned',
      count: Number(r.count),
      value: Number(r.totalValue),
    })),
    stageOrder: stages.map((s) => s.label),
  }
}

async function searchLeads(
  organizationId: string,
  input: ToolInput,
): Promise<unknown> {
  if (!input.query) {
    return { error: 'Search query is required' }
  }

  const limit = Math.min(input.limit || 5, 10)
  const searchPattern = `%${input.query}%`

  let query = db
    .selectFrom('lead')
    .leftJoin('pipeline_stage', 'pipeline_stage.id', 'lead.pipelineStageId')
    .select([
      'lead.id',
      'lead.firstName',
      'lead.lastName',
      'lead.company',
      'lead.phone',
      'lead.email',
      'lead.dealValue',
      'pipeline_stage.label as pipelineStage',
    ])
    .where('lead.organizationId', '=', organizationId)
    .where((eb) =>
      eb.or([
        eb('lead.firstName', 'ilike', searchPattern),
        eb('lead.lastName', 'ilike', searchPattern),
        eb('lead.company', 'ilike', searchPattern),
        eb('lead.phone', 'ilike', searchPattern),
        eb('lead.email', 'ilike', searchPattern),
      ]),
    )

  if (input.stage) {
    query = query.where('pipeline_stage.label', 'ilike', `%${input.stage}%`)
  }

  const leads = await query.limit(limit).execute()

  return {
    count: leads.length,
    leads: leads.map((l) => ({
      name: [l.firstName, l.lastName].filter(Boolean).join(' ') || 'Unknown',
      company: l.company,
      phone: l.phone,
      email: l.email,
      dealValue: l.dealValue ? parseFloat(l.dealValue) : null,
      stage: l.pipelineStage || 'Unassigned',
    })),
  }
}

async function getCallStats(
  organizationId: string,
  input: ToolInput,
): Promise<unknown> {
  const { startDate, endDate } = getTimeframeDates(input.timeframe || 'today')

  // Get twilio config for this org
  const twilioConfig = await db
    .selectFrom('twilio_config')
    .select('id')
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  if (!twilioConfig) {
    return { error: 'No dialer configured for this organization' }
  }

  let query = db
    .selectFrom('call')
    .select([
      db.fn.count('id').as('total'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`.as('connected'),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'outbound')`.as(
        'outbound',
      ),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'inbound')`.as('inbound'),
      sql<number>`COALESCE(SUM(duration), 0)`.as('totalDuration'),
      sql<number>`COALESCE(AVG(duration) FILTER (WHERE status = 'completed'), 0)`.as(
        'avgDuration',
      ),
    ])
    .where('twilioConfigId', '=', twilioConfig.id)
    .where('startedAt', '>=', startDate)
    .where('startedAt', '<=', endDate)

  if (input.userId) {
    query = query.where('userId', '=', input.userId)
  }

  if (input.direction) {
    query = query.where('direction', '=', input.direction)
  }

  const stats = await query.executeTakeFirst()

  const total = Number(stats?.total || 0)
  const connected = Number(stats?.connected || 0)

  return {
    totalCalls: total,
    connectedCalls: connected,
    connectRate: total > 0 ? Math.round((connected / total) * 100) : 0,
    outboundCalls: Number(stats?.outbound || 0),
    inboundCalls: Number(stats?.inbound || 0),
    totalTalkTimeSeconds: Number(stats?.totalDuration || 0),
    avgCallDurationSeconds: Math.round(Number(stats?.avgDuration || 0)),
    timeframe: input.timeframe || 'today',
  }
}

async function getAgentStats(
  organizationId: string,
  input: ToolInput,
): Promise<unknown> {
  const { startDate } = getTimeframeDates(input.timeframe || 'week')

  // Get agent counts
  const agents = await db
    .selectFrom('agent')
    .select(['id', 'name', 'status', 'smsEnabled', 'emailEnabled'])
    .where('organizationId', '=', organizationId)
    .execute()

  // Get pending approvals count
  const pendingApprovals = await db
    .selectFrom('agent_approval')
    .select(db.fn.count('id').as('count'))
    .where('organizationId', '=', organizationId)
    .where('status', '=', 'pending')
    .executeTakeFirst()

  // Get recent execution counts
  const executions = await db
    .selectFrom('agent_execution')
    .select([
      db.fn.count('id').as('total'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`.as('completed'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'failed')`.as('failed'),
    ])
    .where('organizationId', '=', organizationId)
    .where('createdAt', '>=', startDate)
    .executeTakeFirst()

  return {
    totalAgents: agents.length,
    activeAgents: agents.filter((a) => a.status === 'active').length,
    agents: agents.map((a) => ({
      id: a.id,
      name: a.name,
      status: a.status,
      capabilities: [
        a.smsEnabled ? 'SMS' : null,
        a.emailEnabled ? 'Email' : null,
      ].filter(Boolean),
    })),
    pendingApprovals: Number(pendingApprovals?.count || 0),
    recentExecutions: {
      total: Number(executions?.total || 0),
      completed: Number(executions?.completed || 0),
      failed: Number(executions?.failed || 0),
    },
    timeframe: input.timeframe || 'week',
  }
}

async function getRecentActivity(
  organizationId: string,
  input: ToolInput,
): Promise<unknown> {
  const limit = Math.min(input.limit || 10, 25)
  const activityType = input.type || 'all'

  const activities: Array<{
    type: string
    description: string
    timestamp: Date
    metadata?: unknown
  }> = []

  // Get recent calls
  if (activityType === 'all' || activityType === 'calls') {
    const twilioConfig = await db
      .selectFrom('twilio_config')
      .select('id')
      .where('organizationId', '=', organizationId)
      .executeTakeFirst()

    if (twilioConfig) {
      const calls = await db
        .selectFrom('call')
        .leftJoin('lead', 'lead.id', 'call.leadId')
        .leftJoin('user', 'user.id', 'call.userId')
        .select([
          'call.id',
          'call.direction',
          'call.status',
          'call.duration',
          'call.startedAt',
          'lead.firstName as leadFirstName',
          'lead.lastName as leadLastName',
          'user.name as userName',
        ])
        .where('call.twilioConfigId', '=', twilioConfig.id)
        .orderBy('call.startedAt', 'desc')
        .limit(limit)
        .execute()

      for (const call of calls) {
        const leadName =
          [call.leadFirstName, call.leadLastName].filter(Boolean).join(' ') ||
          'Unknown'
        activities.push({
          type: 'call',
          description: `${call.direction} call ${call.status === 'completed' ? 'connected' : call.status} - ${call.userName || 'Unknown'} with ${leadName}${call.duration ? ` (${call.duration}s)` : ''}`,
          timestamp: call.startedAt!,
        })
      }
    }
  }

  // Get recent lead updates
  if (activityType === 'all' || activityType === 'leads') {
    const leads = await db
      .selectFrom('lead')
      .leftJoin('pipeline_stage', 'pipeline_stage.id', 'lead.pipelineStageId')
      .select([
        'lead.id',
        'lead.firstName',
        'lead.lastName',
        'lead.company',
        'lead.updatedAt',
        'pipeline_stage.label as stageName',
      ])
      .where('lead.organizationId', '=', organizationId)
      .orderBy('lead.updatedAt', 'desc')
      .limit(limit)
      .execute()

    for (const lead of leads) {
      const name =
        [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'
      activities.push({
        type: 'lead',
        description: `Lead updated: ${name}${lead.company ? ` at ${lead.company}` : ''} - ${lead.stageName || 'Unassigned'}`,
        timestamp: lead.updatedAt,
      })
    }
  }

  // Sort by timestamp and limit
  activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return {
    count: Math.min(activities.length, limit),
    activities: activities.slice(0, limit).map((a) => ({
      ...a,
      timestamp: a.timestamp.toISOString(),
    })),
  }
}

async function getLeaderboard(
  organizationId: string,
  input: ToolInput,
): Promise<unknown> {
  const { startDate, endDate } = getTimeframeDates(input.timeframe || 'week')
  const metric = input.metric || 'connections'
  const limit = Math.min(input.limit || 5, 10)

  const twilioConfig = await db
    .selectFrom('twilio_config')
    .select('id')
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()

  if (!twilioConfig) {
    return { error: 'No dialer configured for this organization' }
  }

  let orderByColumn: ReturnType<typeof sql>
  switch (metric) {
    case 'calls':
      orderByColumn = sql`COUNT(*)`
      break
    case 'talk_time':
      orderByColumn = sql`COALESCE(SUM(call.duration), 0)`
      break
    case 'connections':
    default:
      orderByColumn = sql`COUNT(*) FILTER (WHERE call.status = 'completed')`
  }

  const leaderboard = await db
    .selectFrom('call')
    .innerJoin('user', 'user.id', 'call.userId')
    .select([
      'user.id',
      'user.name',
      db.fn.count('call.id').as('totalCalls'),
      sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed')`.as(
        'connectedCalls',
      ),
      sql<number>`COALESCE(SUM(call.duration), 0)`.as('totalTalkTime'),
    ])
    .where('call.twilioConfigId', '=', twilioConfig.id)
    .where('call.startedAt', '>=', startDate)
    .where('call.startedAt', '<=', endDate)
    .groupBy(['user.id', 'user.name'])
    .orderBy(orderByColumn, 'desc')
    .limit(limit)
    .execute()

  return {
    metric,
    timeframe: input.timeframe || 'week',
    rankings: leaderboard.map((entry, index) => ({
      rank: index + 1,
      name: entry.name || 'Unknown',
      totalCalls: Number(entry.totalCalls),
      connectedCalls: Number(entry.connectedCalls),
      totalTalkTimeSeconds: Number(entry.totalTalkTime),
      connectRate:
        Number(entry.totalCalls) > 0
          ? Math.round(
              (Number(entry.connectedCalls) / Number(entry.totalCalls)) * 100,
            )
          : 0,
    })),
  }
}

// ============================================
// Block Builders
// ============================================

function buildResponseBlocks(
  response: string,
  _toolResults: Array<{ name: string; result: unknown }>,
): SlackBlocks {
  const blocks: SlackBlocks = []

  // Add the main response
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: response,
    },
  })

  // Add a context block showing this was AI-generated
  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `:robot_face: Powered by OmniDial AI | <${config.frontendUrl}/dashboard|View Dashboard>`,
      },
    ],
  })

  return blocks
}

// ============================================
// Utilities
// ============================================

function getTimeframeDates(timeframe: string): {
  startDate: Date
  endDate: Date
} {
  const now = new Date()
  const endDate = new Date(now)
  let startDate: Date

  switch (timeframe) {
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
    case 'quarter':
      startDate = new Date(now)
      startDate.setMonth(now.getMonth() - 3)
      break
    case 'all':
    default:
      startDate = new Date(0) // Beginning of time
      break
  }

  return { startDate, endDate }
}

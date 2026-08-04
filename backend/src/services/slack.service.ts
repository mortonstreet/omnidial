import {
  SlackClient,
  SlackBlocks,
  exchangeCodeForToken,
} from '@/clients/slack.client'
import * as workspaceRepo from '@/repositories/slackWorkspace.repository'
import * as userLinkRepo from '@/repositories/slackUserLink.repository'
import * as notificationRuleRepo from '@/repositories/slackNotificationRule.repository'
import * as messageLogRepo from '@/repositories/slackMessageLog.repository'
import * as slackLinkTokenRepo from '@/repositories/slackLinkToken.repository'
import * as coachingRepo from '@/repositories/coaching.repository'
import * as pipelineRepo from '@/repositories/pipeline.repository'
import { encrypt } from '@/lib/encryption'
import logger from '@/lib/logger'
import { db } from '@/lib/db'
import { sql } from 'kysely'
import { config } from '@/config'

// OAuth callback result types
export type OAuthCallbackResult =
  | { type: 'linked'; workspaceId: string }
  | { type: 'already_linked'; workspaceId: string }
  | { type: 'pending'; workspaceId: string; teamId: string; appId: string }

// ============================================
// OAUTH & WORKSPACE MANAGEMENT
// ============================================

/**
 * Handle OAuth callback - supports both OmniDial-first and App Directory flows
 *
 * OmniDial-first flow: state contains organizationId, workspace is immediately linked
 * App Directory flow: state is empty/missing, workspace is created in pending state
 */
export async function handleOAuthCallback(
  code: string,
  state: string | null,
): Promise<OAuthCallbackResult> {
  const redirectUri = `${config.backendUrl}/api/webhooks/slack/oauth/callback`
  const tokenData = await exchangeCodeForToken(code, redirectUri)

  // Check if workspace already exists
  const existing = await workspaceRepo.findByTeamId(tokenData.team.id)

  if (existing) {
    // Workspace already exists
    if (existing.organizationId && !existing.isPending) {
      // Already linked to an org - just update the token
      await workspaceRepo.update(existing.id, {
        botToken: encrypt(tokenData.accessToken),
        isActive: true,
      })
      return { type: 'already_linked', workspaceId: existing.id }
    }

    // Existing but pending - check if we should link now (OmniDial-first flow)
    if (state && (await isValidOrganizationId(state))) {
      await workspaceRepo.update(existing.id, {
        organizationId: state,
        isPending: false,
        botToken: encrypt(tokenData.accessToken),
        isActive: true,
      })
      return { type: 'linked', workspaceId: existing.id }
    }

    // Update token but keep pending
    await workspaceRepo.update(existing.id, {
      botToken: encrypt(tokenData.accessToken),
      isActive: true,
    })
    return {
      type: 'pending',
      workspaceId: existing.id,
      teamId: tokenData.team.id,
      appId: tokenData.appId,
    }
  }

  // OmniDial-first flow: state = organizationId
  if (state && (await isValidOrganizationId(state))) {
    const workspace = await workspaceRepo.create({
      organizationId: state,
      teamId: tokenData.team.id,
      teamName: tokenData.team.name,
      botToken: encrypt(tokenData.accessToken),
      botUserId: tokenData.botUserId,
      appId: tokenData.appId,
      enterpriseId: tokenData.enterprise?.id,
      enterpriseName: tokenData.enterprise?.name,
      installedBySlackId: tokenData.authedUser.id,
      settings: {},
      isPending: false,
    })
    return { type: 'linked', workspaceId: workspace.id }
  }

  // App Directory flow: no state or invalid state - create pending workspace
  const workspace = await workspaceRepo.create({
    organizationId: null,
    teamId: tokenData.team.id,
    teamName: tokenData.team.name,
    botToken: encrypt(tokenData.accessToken),
    botUserId: tokenData.botUserId,
    appId: tokenData.appId,
    enterpriseId: tokenData.enterprise?.id,
    enterpriseName: tokenData.enterprise?.name,
    installedBySlackId: tokenData.authedUser.id,
    settings: {},
    isPending: true,
  })

  return {
    type: 'pending',
    workspaceId: workspace.id,
    teamId: tokenData.team.id,
    appId: tokenData.appId,
  }
}

/**
 * Check if a string is a valid organization ID
 */
async function isValidOrganizationId(id: string): Promise<boolean> {
  if (!id || id.length < 10) return false

  const org = await db
    .selectFrom('organization')
    .select('id')
    .where('id', '=', id)
    .executeTakeFirst()

  return !!org
}

/**
 * Link a pending workspace to an organization
 */
export async function linkWorkspaceToOrganization(
  workspaceId: string,
  organizationId: string,
  userId: string,
): Promise<void> {
  await workspaceRepo.linkToOrganization(workspaceId, organizationId, userId)

  // Auto-link users by email
  try {
    await autoLinkUsersByEmail(workspaceId)
  } catch (error) {
    logger.error(
      { error, workspaceId },
      'Failed to auto-link users after workspace linking',
    )
  }
}

/**
 * Get or create a link token for a pending workspace
 */
export async function getOrCreateLinkToken(
  workspaceId: string,
  slackUserId: string,
): Promise<{ token: string; expiresAt: Date }> {
  // Check rate limit
  if (await slackLinkTokenRepo.isRateLimited(workspaceId)) {
    throw new Error('Too many link attempts. Please try again later.')
  }

  const linkToken = await slackLinkTokenRepo.findOrCreate(
    workspaceId,
    slackUserId,
  )
  return { token: linkToken.token, expiresAt: linkToken.expiresAt }
}

/**
 * Validate and consume a link token
 */
export async function validateAndConsumeLinkToken(token: string): Promise<{
  workspaceId: string
  slackUserId: string
} | null> {
  const linkToken = await slackLinkTokenRepo.findByToken(token)
  if (!linkToken) return null

  // Mark as used
  await slackLinkTokenRepo.markUsed(linkToken.id)

  return {
    workspaceId: linkToken.workspaceId,
    slackUserId: linkToken.slackUserId,
  }
}

export async function disconnectWorkspace(workspaceId: string): Promise<void> {
  await workspaceRepo.deactivate(workspaceId)
}

export async function getWorkspaceByTeamId(teamId: string) {
  return workspaceRepo.findByTeamId(teamId)
}

export async function getWorkspacesByOrganization(organizationId: string) {
  return workspaceRepo.findByOrganizationId(organizationId)
}

// ============================================
// USER LINKING
// ============================================

export async function linkSlackUser(
  workspaceId: string,
  userId: string,
  slackUserId: string,
  slackProfile?: {
    email?: string
    display_name?: string
    real_name?: string
    tz?: string
  },
): Promise<void> {
  await userLinkRepo.upsert({
    workspaceId,
    userId,
    slackUserId,
    slackEmail: slackProfile?.email,
    slackDisplayName: slackProfile?.display_name,
    slackRealName: slackProfile?.real_name,
    slackTimezone: slackProfile?.tz,
  })
}

export async function getUserLinkBySlackId(
  workspaceId: string,
  slackUserId: string,
) {
  return userLinkRepo.findByWorkspaceAndSlackUser(workspaceId, slackUserId)
}

export async function autoLinkUsersByEmail(
  workspaceId: string,
): Promise<number> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace || !workspace.organizationId) return 0

  const client = new SlackClient(workspace.botToken)
  const users = await db
    .selectFrom('user')
    .innerJoin('member', 'member.userId', 'user.id')
    .select(['user.id', 'user.email'])
    .where('member.organizationId', '=', workspace.organizationId)
    .execute()

  let linked = 0
  for (const user of users) {
    if (!user.email) continue
    const slackUser = await client.getUserByEmail(user.email)
    if (slackUser) {
      await linkSlackUser(workspaceId, user.id, slackUser.id!, {
        email: slackUser.profile?.email,
        display_name: slackUser.profile?.display_name,
        real_name: slackUser.profile?.real_name,
        tz: slackUser.tz,
      })
      linked++
    }
  }
  return linked
}

// Helper to get twilioConfigId for an organization
async function getTwilioConfigId(
  organizationId: string,
): Promise<string | null> {
  const config = await db
    .selectFrom('twilio_config')
    .select('id')
    .where('organizationId', '=', organizationId)
    .executeTakeFirst()
  return config?.id || null
}

// ============================================
// SLASH COMMANDS
// ============================================

export async function handleStatsCommand(
  workspaceId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  const twilioConfigId = await getTwilioConfigId(workspace.organizationId)
  if (!twilioConfigId) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No dialer configured for this organization.',
        },
      },
    ]
  }

  const period = args[0] || 'today'
  const { startDate, endDate } = getPeriodDates(period)

  // Get call analytics using raw SQL
  const analytics = await db
    .selectFrom('call')
    .select([
      db.fn.count('id').as('total'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`.as('completed'),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'outbound')`.as(
        'outbound',
      ),
      sql<number>`COUNT(*) FILTER (WHERE direction = 'inbound')`.as('inbound'),
      sql<number>`COALESCE(SUM(duration), 0)`.as('totalDuration'),
    ])
    .where('twilioConfigId', '=', twilioConfigId)
    .where('startedAt', '>=', startDate)
    .where('startedAt', '<=', endDate)
    .executeTakeFirst()

  const total = Number(analytics?.total || 0)
  const completed = Number(analytics?.completed || 0)
  const outbound = Number(analytics?.outbound || 0)
  const inbound = Number(analytics?.inbound || 0)
  const totalDuration = Number(analytics?.totalDuration || 0)
  const avgDuration = total > 0 ? Math.round(totalDuration / total) : 0
  const connectRate = total > 0 ? Math.round((completed / total) * 100) : 0

  return buildStatsBlocks({
    period,
    total,
    completed,
    outbound,
    inbound,
    totalDuration,
    avgDuration,
    connectRate,
  })
}

export async function handleLeadCommand(
  workspaceId: string,
  slackUserId: string,
  query: string,
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  if (!query) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please provide a search query. Example: `/omnidial lead John Smith`',
        },
      },
    ]
  }

  // Search leads with pipeline data
  const searchPattern = `%${query}%`
  const leads = await db
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
      'pipeline_stage.label as pipelineStageLabel',
      'pipeline_stage.color as pipelineStageColor',
    ])
    .where('lead.organizationId', '=', workspace.organizationId)
    .where((eb) =>
      eb.or([
        eb('lead.firstName', 'ilike', searchPattern),
        eb('lead.lastName', 'ilike', searchPattern),
        eb('lead.company', 'ilike', searchPattern),
        eb('lead.phone', 'ilike', searchPattern),
        eb('lead.email', 'ilike', searchPattern),
      ]),
    )
    .limit(5)
    .execute()

  // Get last call info for each lead (separate query to avoid complex joins)
  const leadIds = leads.map((l) => l.id)
  const lastCalls =
    leadIds.length > 0
      ? await db
          .selectFrom('call')
          .leftJoin('disposition', 'disposition.id', 'call.dispositionId')
          .leftJoin('call_coaching', 'call_coaching.callId', 'call.id')
          .select([
            'call.leadId',
            'call.createdAt as lastCallDate',
            'disposition.label as lastDisposition',
            'call_coaching.overallScore as coachingScore',
          ])
          .where('call.leadId', 'in', leadIds)
          .orderBy('call.createdAt', 'desc')
          .execute()
      : []

  // Create a map of lead ID to last call info
  const lastCallMap = new Map<
    string,
    {
      lastCallDate: Date | null
      lastDisposition: string | null
      coachingScore: number | null
    }
  >()
  for (const call of lastCalls) {
    if (call.leadId && !lastCallMap.has(call.leadId)) {
      lastCallMap.set(call.leadId, {
        lastCallDate: call.lastCallDate,
        lastDisposition: call.lastDisposition,
        coachingScore: call.coachingScore,
      })
    }
  }

  // Merge the data
  const enrichedLeads = leads.map((lead) => {
    const callInfo = lastCallMap.get(lead.id)
    return {
      ...lead,
      dealValue: lead.dealValue ? parseFloat(lead.dealValue) : null,
      lastCallDate: callInfo?.lastCallDate || null,
      lastDisposition: callInfo?.lastDisposition || null,
      coachingScore: callInfo?.coachingScore || null,
    }
  })

  if (leads.length === 0) {
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `No leads found matching "${query}"` },
      },
    ]
  }

  return buildLeadSearchBlocks(enrichedLeads)
}

export async function handleLeaderboardCommand(
  workspaceId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  const twilioConfigId = await getTwilioConfigId(workspace.organizationId)
  if (!twilioConfigId) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No dialer configured for this organization.',
        },
      },
    ]
  }

  const period = args[0] || 'week'
  const { startDate, endDate } = getPeriodDates(period)

  // Get leaderboard data
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
    ])
    .where('call.twilioConfigId', '=', twilioConfigId)
    .where('call.startedAt', '>=', startDate)
    .where('call.startedAt', '<=', endDate)
    .groupBy(['user.id', 'user.name'])
    .orderBy(sql`COUNT(*) FILTER (WHERE call.status = 'completed')`, 'desc')
    .limit(10)
    .execute()

  return buildLeaderboardBlocks(leaderboard, period)
}

export async function handleCallsCommand(
  workspaceId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  const twilioConfigId = await getTwilioConfigId(workspace.organizationId)
  if (!twilioConfigId) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No dialer configured for this organization.',
        },
      },
    ]
  }

  // Parse args for --limit, --direction
  let limit = 5
  let direction: string | null = null

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--limit' || args[i] === '-n') && args[i + 1]) {
      limit = Math.min(parseInt(args[i + 1], 10) || 5, 20)
      i++
    }
    if (args[i] === '--direction' && args[i + 1]) {
      direction = args[i + 1]
      i++
    }
  }

  let query = db
    .selectFrom('call')
    .leftJoin('lead', 'lead.id', 'call.leadId')
    .leftJoin('user', 'user.id', 'call.userId')
    .select([
      'call.id',
      'call.direction',
      'call.status',
      'call.duration',
      'call.startedAt',
      'call.toNumber',
      'lead.firstName as leadFirstName',
      'lead.lastName as leadLastName',
      'lead.company as leadCompany',
      'user.name as userName',
    ])
    .where('call.twilioConfigId', '=', twilioConfigId)
    .orderBy('call.startedAt', 'desc')
    .limit(limit)

  if (direction) {
    query = query.where('call.direction', '=', direction)
  }

  const calls = await query.execute()

  return buildCallsListBlocks(calls)
}

export async function handleCoachingCommand(
  workspaceId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  const callId = args[0]

  // If specific call ID provided, show that coaching
  if (callId) {
    const coaching = await coachingRepo.findCoachingByCallId(
      callId,
      workspace.organizationId,
    )

    if (!coaching) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `No coaching found for call \`${callId}\``,
          },
        },
      ]
    }

    return buildCoachingDetailBlocks(coaching)
  }

  // Show recent coaching for the linked user or all recent coaching
  const userLink = await userLinkRepo.findByWorkspaceAndSlackUser(
    workspaceId,
    slackUserId,
  )

  let coachingSessions
  if (userLink) {
    coachingSessions = await coachingRepo.findCoachingByUserId(
      userLink.userId,
      workspace.organizationId,
      { limit: 5 },
    )
  } else {
    coachingSessions = await coachingRepo.findRecentCoaching(
      workspace.organizationId,
      { limit: 5 },
    )
  }

  if (coachingSessions.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No coaching sessions found. Coaching is generated automatically for calls over 60 seconds.',
        },
      },
    ]
  }

  return buildCoachingListBlocks(coachingSessions, userLink?.userId)
}

export async function handleTranscriptCommand(
  workspaceId: string,
  slackUserId: string,
  callId: string,
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  if (!callId) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please provide a call ID. Example: `/omnidial transcript abc123`',
        },
      },
    ]
  }

  const transcript = await coachingRepo.findTranscriptByCallId(
    callId,
    workspace.organizationId,
  )

  if (!transcript) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `No transcript found for call \`${callId}\``,
        },
      },
    ]
  }

  // For short transcripts, show inline
  const maxInlineLength = 2000
  if (transcript.transcriptText.length <= maxInlineLength) {
    return [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'Call Transcript', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\`\`\`${transcript.transcriptText}\`\`\``,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Duration: ${formatDuration(transcript.durationSeconds)} | Language: ${transcript.language}`,
          },
        ],
      },
    ]
  }

  // For long transcripts, truncate and link to full view
  const truncated = transcript.transcriptText.substring(0, maxInlineLength)
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Call Transcript (Preview)',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `\`\`\`${truncated}...\`\`\``,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Showing first ${maxInlineLength} chars of ${transcript.transcriptText.length} total | Duration: ${formatDuration(transcript.durationSeconds)}`,
        },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'View Full Transcript',
            emoji: true,
          },
          url: `${config.frontendUrl}/dashboard/calls/${callId}`,
          style: 'primary',
        },
      ],
    },
  ]
}

export async function handlePipelineCommand(
  workspaceId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) throw new Error('Workspace not found')
  if (!workspace.organizationId)
    throw new Error('Workspace not linked to organization')

  const stageFilter = args.join(' ')

  // Get pipeline stages
  const stages = await pipelineRepo.findByOrganizationId(
    workspace.organizationId,
  )
  if (stages.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No pipeline stages configured for this organization.',
        },
      },
    ]
  }

  // Get lead counts per stage
  const leadCounts = await db
    .selectFrom('lead')
    .leftJoin('pipeline_stage', 'pipeline_stage.id', 'lead.pipelineStageId')
    .select([
      'lead.pipelineStageId',
      db.fn.count('lead.id').as('count'),
      sql<number>`COALESCE(SUM(lead."dealValue"), 0)`.as('totalValue'),
    ])
    .where('lead.organizationId', '=', workspace.organizationId)
    .groupBy('lead.pipelineStageId')
    .execute()

  const countMap = new Map(
    leadCounts.map((c) => [
      c.pipelineStageId,
      { count: Number(c.count), value: Number(c.totalValue) },
    ]),
  )

  const totalLeads = leadCounts.reduce((sum, c) => sum + Number(c.count), 0)
  const totalValue = leadCounts.reduce(
    (sum, c) => sum + Number(c.totalValue),
    0,
  )

  // If filtering by stage, show leads in that stage
  if (stageFilter) {
    const matchingStage = stages.find(
      (s) => s.label.toLowerCase() === stageFilter.toLowerCase(),
    )

    if (!matchingStage) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `Stage "${stageFilter}" not found. Available stages: ${stages.map((s) => s.label).join(', ')}`,
          },
        },
      ]
    }

    const leadsInStage = await db
      .selectFrom('lead')
      .select(['id', 'firstName', 'lastName', 'company', 'phone', 'dealValue'])
      .where('organizationId', '=', workspace.organizationId)
      .where('pipelineStageId', '=', matchingStage.id)
      .limit(10)
      .execute()

    return buildPipelineStageDetailBlocks(matchingStage, leadsInStage)
  }

  // Show overview of all stages
  return buildPipelineOverviewBlocks(stages, countMap, totalLeads, totalValue)
}

export async function handleHelpCommand(): Promise<SlackBlocks> {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'OmniDial Commands', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Available Commands:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '`/omnidial stats [today|week|month]` - View call statistics\n' +
          '`/omnidial lead [query]` - Search for leads\n' +
          '`/omnidial calls [--limit N] [--direction inbound|outbound]` - List recent calls\n' +
          '`/omnidial leaderboard [today|week|month]` - View team rankings\n' +
          '`/omnidial coaching [call_id]` - View coaching sessions\n' +
          '`/omnidial transcript <call_id>` - View call transcript\n' +
          '`/omnidial pipeline [stage]` - View pipeline overview\n' +
          '`/omnidial settings` - Configure notifications\n' +
          '`/omnidial help` - Show this help message',
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*AI-Powered Queries:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '`/omnidial ask <question>` - Ask natural language questions about your data\n' +
          '_Examples: "how many leads did we qualify this week?", "what\'s our call connect rate?"_',
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*Agent Management:*',
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '`/omnidial agent status` - List all agents\n' +
          '`/omnidial agent queue` - Show pending approvals\n' +
          '`/omnidial agent approve|reject <id>` - Respond to approvals\n' +
          '`/omnidial agent pause|resume <name>` - Control agent activity',
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Visit <${config.frontendUrl}|OmniDial> for full features`,
        },
      ],
    },
  ]
}

// ============================================
// NOTIFICATIONS
// ============================================

export async function sendInboundCallNotification(
  organizationId: string,
  callData: {
    id: string
    fromNumber: string
    toNumber: string
    leadId?: string | null
  },
): Promise<void> {
  const workspaces = await workspaceRepo.findByOrganizationId(organizationId)

  for (const workspace of workspaces) {
    const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
      workspace.id,
      'inbound_call',
    )
    if (rules.length === 0) continue

    // Get lead info if available
    let lead: {
      id: string
      firstName: string | null
      lastName: string | null
      company: string | null
    } | null = null
    if (callData.leadId) {
      const leadResult = await db
        .selectFrom('lead')
        .select(['id', 'firstName', 'lastName', 'company'])
        .where('id', '=', callData.leadId)
        .executeTakeFirst()
      lead = leadResult || null
    }

    const client = new SlackClient(workspace.botToken)
    const blocks = buildInboundCallBlocks(callData, lead)

    for (const rule of rules) {
      try {
        const result = await client.postMessage({
          channel: rule.channelId,
          blocks,
          text: `Incoming call from ${lead ? `${lead.firstName} ${lead.lastName}` : callData.fromNumber}`,
        })

        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          messageTs: result.ts,
          eventType: 'inbound_call',
          payload: { callId: callData.id },
          success: true,
        })
      } catch (error) {
        logger.error(
          { error, workspaceId: workspace.id, channelId: rule.channelId },
          'Failed to send inbound call notification',
        )
        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          eventType: 'inbound_call',
          payload: { callId: callData.id },
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    await workspaceRepo.updateLastActivity(workspace.id)
  }
}

export async function sendCallCompletedNotification(
  organizationId: string,
  callData: {
    id: string
    direction: string
    duration: number
    status: string
    disposition?: string | null
    userId?: string | null
    leadId?: string | null
  },
): Promise<void> {
  const workspaces = await workspaceRepo.findByOrganizationId(organizationId)

  for (const workspace of workspaces) {
    const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
      workspace.id,
      'call_completed',
    )
    if (rules.length === 0) continue

    // Get user and lead info
    let user: { id: string; name: string | null } | null = null
    let lead: {
      id: string
      firstName: string | null
      lastName: string | null
      company: string | null
    } | null = null

    if (callData.userId) {
      const userResult = await db
        .selectFrom('user')
        .select(['id', 'name'])
        .where('id', '=', callData.userId)
        .executeTakeFirst()
      user = userResult || null
    }
    if (callData.leadId) {
      const leadResult = await db
        .selectFrom('lead')
        .select(['id', 'firstName', 'lastName', 'company'])
        .where('id', '=', callData.leadId)
        .executeTakeFirst()
      lead = leadResult || null
    }

    // Get Slack user ID if linked
    let slackUserId: string | null = null
    if (callData.userId) {
      const userLink = await userLinkRepo.findByWorkspaceAndUser(
        workspace.id,
        callData.userId,
      )
      slackUserId = userLink?.slackUserId || null
    }

    const client = new SlackClient(workspace.botToken)
    const blocks = buildCallCompletedBlocks(callData, user, lead, slackUserId)

    for (const rule of rules) {
      try {
        const result = await client.postMessage({
          channel: rule.channelId,
          blocks,
          text: `Call completed: ${callData.duration}s`,
        })

        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          messageTs: result.ts,
          eventType: 'call_completed',
          payload: { callId: callData.id },
          success: true,
        })
      } catch (error) {
        logger.error(
          { error, workspaceId: workspace.id },
          'Failed to send call completed notification',
        )
        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          eventType: 'call_completed',
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    await workspaceRepo.updateLastActivity(workspace.id)
  }
}

export async function sendMilestoneNotification(
  organizationId: string,
  milestone: {
    type: string
    value: number
    topContributor?: { name: string; slackUserId?: string; count: number }
  },
): Promise<void> {
  const workspaces = await workspaceRepo.findByOrganizationId(organizationId)

  for (const workspace of workspaces) {
    const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
      workspace.id,
      'milestone_reached',
    )
    if (rules.length === 0) continue

    const client = new SlackClient(workspace.botToken)
    const blocks = buildMilestoneBlocks(milestone)

    for (const rule of rules) {
      try {
        await client.postMessage({
          channel: rule.channelId,
          blocks,
          text: `Milestone reached: ${milestone.value} ${milestone.type}!`,
        })
      } catch (error) {
        logger.error(
          { error, workspaceId: workspace.id },
          'Failed to send milestone notification',
        )
      }
    }
  }
}

export async function sendCoachingAvailableNotification(
  organizationId: string,
  coachingData: {
    callId: string
    userId: string
    overallScore: number
    unhingedQuote: string | null
    leadName?: string | null
  },
): Promise<void> {
  const workspaces = await workspaceRepo.findByOrganizationId(organizationId)

  for (const workspace of workspaces) {
    const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
      workspace.id,
      'coaching_available',
    )
    if (rules.length === 0) continue

    // Get Slack user ID if linked
    const userLink = await userLinkRepo.findByWorkspaceAndUser(
      workspace.id,
      coachingData.userId,
    )
    const slackUserId = userLink?.slackUserId || null

    const client = new SlackClient(workspace.botToken)
    const blocks = buildCoachingAvailableBlocks(coachingData, slackUserId)

    for (const rule of rules) {
      try {
        const result = await client.postMessage({
          channel: rule.channelId,
          blocks,
          text: `Coaching available: Score ${coachingData.overallScore}/10`,
        })

        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          messageTs: result.ts,
          eventType: 'coaching_available',
          payload: { callId: coachingData.callId },
          success: true,
        })
      } catch (error) {
        logger.error(
          { error, workspaceId: workspace.id, channelId: rule.channelId },
          'Failed to send coaching available notification',
        )
        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          eventType: 'coaching_available',
          payload: { callId: coachingData.callId },
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    await workspaceRepo.updateLastActivity(workspace.id)
  }
}

export async function sendPipelineStageChangeNotification(
  organizationId: string,
  data: {
    leadId: string
    leadName: string
    company: string | null
    dealValue: number | null
    newStage: string
    newStageColor: string
    previousStage: string | null
    changedByUserId: string | null
  },
): Promise<void> {
  const workspaces = await workspaceRepo.findByOrganizationId(organizationId)

  // Only notify for significant stage changes
  const notifyStages = ['Closed Won', 'Closed Lost']
  if (!notifyStages.includes(data.newStage)) {
    return
  }

  for (const workspace of workspaces) {
    const eventType = data.newStage === 'Closed Won' ? 'deal_won' : 'deal_lost'
    const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
      workspace.id,
      eventType,
    )
    if (rules.length === 0) continue

    // Get Slack user ID if linked
    let slackUserId: string | null = null
    if (data.changedByUserId) {
      const userLink = await userLinkRepo.findByWorkspaceAndUser(
        workspace.id,
        data.changedByUserId,
      )
      slackUserId = userLink?.slackUserId || null
    }

    const client = new SlackClient(workspace.botToken)
    const blocks = buildPipelineChangeBlocks(data, slackUserId)

    for (const rule of rules) {
      try {
        const result = await client.postMessage({
          channel: rule.channelId,
          blocks,
          text:
            data.newStage === 'Closed Won'
              ? `Deal Won: ${data.leadName}`
              : `Deal Lost: ${data.leadName}`,
        })

        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          messageTs: result.ts,
          eventType,
          payload: { leadId: data.leadId },
          success: true,
        })
      } catch (error) {
        logger.error(
          { error, workspaceId: workspace.id, channelId: rule.channelId },
          'Failed to send pipeline change notification',
        )
        await messageLogRepo.create({
          workspaceId: workspace.id,
          channelId: rule.channelId,
          eventType,
          payload: { leadId: data.leadId },
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    await workspaceRepo.updateLastActivity(workspace.id)
  }
}

export async function sendDailySummary(workspaceId: string): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace || !workspace.organizationId) return

  const twilioConfigId = await getTwilioConfigId(workspace.organizationId)
  if (!twilioConfigId) return

  const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
    workspaceId,
    'daily_summary',
  )
  if (rules.length === 0) return

  const today = new Date()
  const startOfDay = new Date(today)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  // Get analytics
  const analytics = await db
    .selectFrom('call')
    .select([
      db.fn.count('id').as('total'),
      sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`.as('connected'),
      sql<number>`COALESCE(SUM(duration), 0)`.as('totalDuration'),
    ])
    .where('twilioConfigId', '=', twilioConfigId)
    .where('startedAt', '>=', startOfDay)
    .where('startedAt', '<=', endOfDay)
    .executeTakeFirst()

  // Get top performers
  const topPerformers = await db
    .selectFrom('call')
    .innerJoin('user', 'user.id', 'call.userId')
    .select([
      'user.name',
      sql<number>`COUNT(*) FILTER (WHERE call.status = 'completed')`.as(
        'connected',
      ),
    ])
    .where('call.twilioConfigId', '=', twilioConfigId)
    .where('call.startedAt', '>=', startOfDay)
    .where('call.startedAt', '<=', endOfDay)
    .groupBy(['user.id', 'user.name'])
    .orderBy(sql`COUNT(*) FILTER (WHERE call.status = 'completed')`, 'desc')
    .limit(3)
    .execute()

  const client = new SlackClient(workspace.botToken)
  const blocks = buildDailySummaryBlocks(
    {
      total: Number(analytics?.total || 0),
      connected: Number(analytics?.connected || 0),
      totalDuration: Number(analytics?.totalDuration || 0),
    },
    topPerformers,
  )

  for (const rule of rules) {
    try {
      await client.postMessage({
        channel: rule.channelId,
        blocks,
        text: 'Daily Summary',
      })
    } catch (error) {
      logger.error({ error, workspaceId }, 'Failed to send daily summary')
    }
  }
}

// ============================================
// BLOCK BUILDERS
// ============================================

function buildStatsBlocks(stats: {
  period: string
  total: number
  completed: number
  outbound: number
  inbound: number
  totalDuration: number
  avgDuration: number
  connectRate: number
}): SlackBlocks {
  const periodLabel =
    stats.period.charAt(0).toUpperCase() + stats.period.slice(1)

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Call Stats - ${periodLabel}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total Calls*\n${stats.total}` },
        {
          type: 'mrkdwn',
          text: `*Connected*\n${stats.completed} (${stats.connectRate}%)`,
        },
        { type: 'mrkdwn', text: `*Outbound*\n${stats.outbound}` },
        { type: 'mrkdwn', text: `*Inbound*\n${stats.inbound}` },
        {
          type: 'mrkdwn',
          text: `*Talk Time*\n${formatDuration(stats.totalDuration)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Avg Duration*\n${formatDuration(stats.avgDuration)}`,
        },
      ],
    },
  ]
}

function buildLeadSearchBlocks(
  leads: Array<{
    id: string
    firstName: string | null
    lastName: string | null
    company: string | null
    phone: string | null
    email: string | null
    dealValue?: number | null
    pipelineStageLabel?: string | null
    pipelineStageColor?: string | null
    lastCallDate?: Date | null
    lastDisposition?: string | null
    coachingScore?: number | null
  }>,
): SlackBlocks {
  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Found ${leads.length} lead${leads.length !== 1 ? 's' : ''}`,
        emoji: true,
      },
    },
  ]

  for (const lead of leads) {
    const name =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'

    // Build status line with pipeline stage, deal value, etc.
    const statusParts: string[] = []

    if (lead.pipelineStageLabel) {
      const dot = lead.pipelineStageColor
        ? getColorDot(lead.pipelineStageColor)
        : ''
      statusParts.push(`${dot} ${lead.pipelineStageLabel}`)
    }

    if (lead.dealValue && lead.dealValue > 0) {
      statusParts.push(`$${formatCurrency(lead.dealValue)}`)
    }

    if (lead.lastCallDate) {
      const dateStr = new Date(lead.lastCallDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })
      const dispStr = lead.lastDisposition ? ` (${lead.lastDisposition})` : ''
      statusParts.push(`Last call: ${dateStr}${dispStr}`)
    }

    if (lead.coachingScore !== null && lead.coachingScore !== undefined) {
      statusParts.push(`Score: ${lead.coachingScore}/10`)
    }

    const statusLine =
      statusParts.length > 0 ? `\n${statusParts.join(' | ')}` : ''

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${name}*${lead.company ? ` at ${lead.company}` : ''}\n${lead.phone || 'No phone'} | ${lead.email || 'No email'}${statusLine}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'View', emoji: true },
        url: `${config.frontendUrl}/dashboard/leads/${lead.id}`,
        action_id: 'view_lead',
      },
    })

    // Add Call button if phone is available
    if (lead.phone) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: ':phone: Call', emoji: true },
            action_id: 'call_lead',
            value: JSON.stringify({ leadId: lead.id, phone: lead.phone }),
          },
        ],
      })
    }
  }

  return blocks
}

function buildLeaderboardBlocks(
  leaderboard: Array<{
    id: string
    name: string | null
    totalCalls: unknown
    connectedCalls: unknown
  }>,
  period: string,
): SlackBlocks {
  const medals = ['🥇', '🥈', '🥉']
  const periodLabel = period.charAt(0).toUpperCase() + period.slice(1)

  let text = ''
  leaderboard.forEach((entry, index) => {
    const prefix = index < 3 ? medals[index] : `${index + 1}.`
    const name = entry.name || 'Unknown'
    text += `${prefix} ${name} - ${entry.connectedCalls} connected (${entry.totalCalls} total)\n`
  })

  const totalConnected = leaderboard.reduce(
    (sum, e) => sum + Number(e.connectedCalls || 0),
    0,
  )
  const totalCalls = leaderboard.reduce(
    (sum, e) => sum + Number(e.totalCalls || 0),
    0,
  )

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Leaderboard - This ${periodLabel}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: text || 'No activity yet' },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Team Total: ${totalConnected} connected / ${totalCalls} calls (${totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : 0}% rate)`,
        },
      ],
    },
  ]
}

function buildCallsListBlocks(
  calls: Array<{
    id: string
    direction: string | null
    status: string | null
    duration: number | null
    startedAt: Date | null
    toNumber: string | null
    leadFirstName: string | null
    leadLastName: string | null
    leadCompany: string | null
    userName: string | null
  }>,
): SlackBlocks {
  if (calls.length === 0) {
    return [
      {
        type: 'section',
        text: { type: 'mrkdwn', text: 'No recent calls found.' },
      },
    ]
  }

  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Recent Calls (${calls.length})`,
        emoji: true,
      },
    },
  ]

  for (const call of calls) {
    const leadName =
      [call.leadFirstName, call.leadLastName].filter(Boolean).join(' ') ||
      call.toNumber ||
      'Unknown'
    const arrow = call.direction === 'inbound' ? '📞' : '📱'
    const duration = call.duration ? formatDuration(call.duration) : '-'

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${arrow} *${leadName}*${call.leadCompany ? ` (${call.leadCompany})` : ''}\n${call.status} | ${duration} | ${call.userName || 'Unknown rep'}`,
      },
    })
  }

  return blocks
}

function buildInboundCallBlocks(
  callData: { id: string; fromNumber: string; toNumber: string },
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    company: string | null
  } | null,
): SlackBlocks {
  const callerName = lead
    ? [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'
    : callData.fromNumber
  const subtitle = lead?.company ? `from *${lead.company}*` : ''

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Incoming Call', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${callerName}* ${subtitle}\n📱 ${callData.fromNumber}`,
      },
    },
    ...(lead
      ? [
          {
            type: 'actions' as const,
            elements: [
              {
                type: 'button' as const,
                text: {
                  type: 'plain_text' as const,
                  text: 'View Lead',
                  emoji: true,
                },
                url: `${config.frontendUrl}/dashboard/leads/${lead.id}`,
                style: 'primary' as const,
              },
            ],
          },
        ]
      : []),
  ]
}

function buildCallCompletedBlocks(
  callData: {
    id: string
    direction: string
    duration: number
    status: string
    disposition?: string | null
  },
  user: { id: string; name: string | null } | null,
  lead: {
    id: string
    firstName: string | null
    lastName: string | null
    company: string | null
  } | null,
  slackUserId: string | null,
): SlackBlocks {
  const userMention = slackUserId
    ? `<@${slackUserId}>`
    : user?.name || 'Unknown rep'
  const leadName = lead
    ? [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'
    : 'Unknown'

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `✅ *Call Completed*\n${userMention} finished a call with *${leadName}*`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Duration*\n${formatDuration(callData.duration)}`,
        },
        {
          type: 'mrkdwn',
          text: `*Disposition*\n${callData.disposition || 'Not set'}`,
        },
        { type: 'mrkdwn', text: `*Direction*\n${callData.direction}` },
        { type: 'mrkdwn', text: `*Status*\n${callData.status}` },
      ],
    },
  ]
}

function buildMilestoneBlocks(milestone: {
  type: string
  value: number
  topContributor?: { name: string; slackUserId?: string; count: number }
}): SlackBlocks {
  const contributor = milestone.topContributor
  const contributorText = contributor
    ? `\n\nTop contributor: ${contributor.slackUserId ? `<@${contributor.slackUserId}>` : contributor.name} with ${contributor.count} ${milestone.type} 🏆`
    : ''

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Milestone Reached!', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `The team just crossed *${milestone.value} ${milestone.type}*!${contributorText}`,
      },
    },
  ]
}

function buildDailySummaryBlocks(
  analytics: { total: number; connected: number; totalDuration: number },
  topPerformers: Array<{ name: string | null; connected: unknown }>,
): SlackBlocks {
  const date = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  const connectRate =
    analytics.total > 0
      ? Math.round((analytics.connected / analytics.total) * 100)
      : 0

  let performersText = ''
  topPerformers.forEach((p, i) => {
    const medals = ['🥇', '🥈', '🥉']
    performersText += `${medals[i] || `${i + 1}.`} ${p.name || 'Unknown'} - ${p.connected} connected\n`
  })

  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Daily Summary - ${date}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Team Performance*' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Total Calls*\n${analytics.total}` },
        {
          type: 'mrkdwn',
          text: `*Connected*\n${analytics.connected} (${connectRate}%)`,
        },
        {
          type: 'mrkdwn',
          text: `*Talk Time*\n${formatDuration(analytics.totalDuration)}`,
        },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🏆 Top Performers*\n${performersText || 'No activity today'}`,
      },
    },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `View full analytics in <${config.frontendUrl}/dashboard|OmniDial>`,
        },
      ],
    },
  ]
}

function buildCoachingAvailableBlocks(
  coachingData: {
    callId: string
    userId: string
    overallScore: number
    unhingedQuote: string | null
    leadName?: string | null
  },
  slackUserId: string | null,
): SlackBlocks {
  const scoreEmoji = getScoreEmoji(coachingData.overallScore)
  const userMention = slackUserId ? `<@${slackUserId}>` : 'A rep'

  const blocks: SlackBlocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${scoreEmoji} *New Coaching Available*\n${userMention} just completed a call${coachingData.leadName ? ` with *${coachingData.leadName}*` : ''} - Score: *${coachingData.overallScore}/10*`,
      },
    },
  ]

  if (coachingData.unhingedQuote) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `> _"${coachingData.unhingedQuote}"_`,
      },
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Full Report', emoji: true },
        url: `${config.frontendUrl}/dashboard/coaching/${coachingData.callId}`,
        style: 'primary',
      },
    ],
  })

  return blocks
}

function buildPipelineChangeBlocks(
  data: {
    leadId: string
    leadName: string
    company: string | null
    dealValue: number | null
    newStage: string
    newStageColor: string
    previousStage: string | null
    changedByUserId: string | null
  },
  slackUserId: string | null,
): SlackBlocks {
  const isWon = data.newStage === 'Closed Won'
  const emoji = isWon ? ':tada:' : ':disappointed:'
  const userMention = slackUserId ? `<@${slackUserId}>` : 'Someone'

  const valueStr =
    data.dealValue && data.dealValue > 0
      ? ` - $${formatCurrency(data.dealValue)}`
      : ''

  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: isWon ? 'Deal Won!' : 'Deal Lost',
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} ${userMention} just ${isWon ? 'closed' : 'lost'} *${data.leadName}*${data.company ? ` at ${data.company}` : ''}${valueStr}`,
      },
    },
  ]

  if (isWon && data.dealValue && data.dealValue > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `:moneybag: *Deal Value:* $${formatCurrency(data.dealValue)}`,
      },
    })
  }

  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'View Lead', emoji: true },
        url: `${config.frontendUrl}/dashboard/leads/${data.leadId}`,
      },
    ],
  })

  return blocks
}

function buildCoachingDetailBlocks(
  coaching: coachingRepo.CoachingWithTranscript,
): SlackBlocks {
  const scoreEmoji = getScoreEmoji(coaching.overallScore)
  const strengthsList = coaching.strengths.slice(0, 3).join('\n')
  const improvementsList = coaching.improvements.slice(0, 3).join('\n')

  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${scoreEmoji} Coaching Report - Score: ${coaching.overallScore}/10`,
        emoji: true,
      },
    },
  ]

  if (coaching.unhingedQuote) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `> _"${coaching.unhingedQuote}"_`,
      },
    })
  }

  blocks.push(
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Strengths*\n${strengthsList || 'None identified'}`,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Areas for Improvement*\n${improvementsList || 'None identified'}`,
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Full Report', emoji: true },
          url: `${config.frontendUrl}/dashboard/coaching/${coaching.callId}`,
          style: 'primary',
        },
      ],
    },
  )

  return blocks
}

function buildCoachingListBlocks(
  coachingSessions: coachingRepo.CoachingWithTranscript[],
  userId?: string,
): SlackBlocks {
  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: userId ? 'Your Recent Coaching' : 'Recent Team Coaching',
        emoji: true,
      },
    },
  ]

  for (const session of coachingSessions) {
    const scoreEmoji = getScoreEmoji(session.overallScore)
    const date = new Date(session.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
    const quote = session.unhingedQuote
      ? `_"${session.unhingedQuote.substring(0, 60)}..."_`
      : ''

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${scoreEmoji} *${session.overallScore}/10* - ${date}\n${quote}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'View', emoji: true },
        url: `${config.frontendUrl}/dashboard/coaching/${session.callId}`,
        action_id: 'view_coaching',
      },
    })
  }

  return blocks
}

function buildPipelineOverviewBlocks(
  stages: { id: string; label: string; color: string; sortOrder: number }[],
  countMap: Map<string | null, { count: number; value: number }>,
  totalLeads: number,
  totalValue: number,
): SlackBlocks {
  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Pipeline Overview', emoji: true },
    },
  ]

  let stageText = ''
  for (const stage of stages) {
    const data = countMap.get(stage.id) || { count: 0, value: 0 }
    const percentage =
      totalLeads > 0 ? Math.round((data.count / totalLeads) * 100) : 0
    const valueStr = data.value > 0 ? ` ($${formatCurrency(data.value)})` : ''
    const bar = getProgressBar(percentage)

    stageText += `${getColorDot(stage.color)} *${stage.label}*: ${data.count} leads${valueStr}\n${bar} ${percentage}%\n\n`
  }

  // Add unassigned leads count
  const unassigned = countMap.get(null)
  if (unassigned && unassigned.count > 0) {
    stageText += `*Unassigned*: ${unassigned.count} leads\n`
  }

  blocks.push({
    type: 'section',
    text: { type: 'mrkdwn', text: stageText },
  })

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Total: ${totalLeads} leads | Pipeline Value: $${formatCurrency(totalValue)}`,
      },
    ],
  })

  return blocks
}

function buildPipelineStageDetailBlocks(
  stage: { label: string; color: string },
  leads: Array<{
    id: string
    firstName: string | null
    lastName: string | null
    company: string | null
    phone: string | null
    dealValue: string | null
  }>,
): SlackBlocks {
  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${getColorDot(stage.color)} ${stage.label} (${leads.length} leads)`,
        emoji: true,
      },
    },
  ]

  if (leads.length === 0) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: 'No leads in this stage.' },
    })
    return blocks
  }

  for (const lead of leads) {
    const name =
      [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'
    const dealValue = lead.dealValue ? parseFloat(lead.dealValue) : null
    const valueStr = dealValue ? ` - $${formatCurrency(dealValue)}` : ''

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${name}*${lead.company ? ` at ${lead.company}` : ''}${valueStr}`,
      },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'View', emoji: true },
        url: `${config.frontendUrl}/dashboard/leads/${lead.id}`,
        action_id: 'view_lead',
      },
    })
  }

  return blocks
}

function getScoreEmoji(score: number): string {
  if (score >= 8) return ':star:'
  if (score >= 6) return ':chart_with_upwards_trend:'
  if (score >= 4) return ':thought_balloon:'
  return ':memo:'
}

function getColorDot(color: string): string {
  // Map common colors to emoji dots
  const colorMap: Record<string, string> = {
    '#10B981': ':large_green_circle:',
    '#EF4444': ':red_circle:',
    '#3B82F6': ':large_blue_circle:',
    '#F59E0B': ':large_orange_circle:',
    '#8B5CF6': ':purple_circle:',
    '#6B7280': ':white_circle:',
    '#F97316': ':large_orange_circle:',
  }
  return colorMap[color] || ':black_circle:'
}

function getProgressBar(percentage: number): string {
  const filled = Math.round(percentage / 10)
  const empty = 10 - filled
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty)
}

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`
  }
  return value.toFixed(0)
}

// ============================================
// UTILITIES
// ============================================

function getPeriodDates(period: string): { startDate: Date; endDate: Date } {
  const now = new Date()
  const endDate = new Date(now)

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
    case 'today':
    default:
      startDate = new Date(now)
      startDate.setHours(0, 0, 0, 0)
      break
  }

  return { startDate, endDate }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

// ============================================
// AGENT MESSAGE APPROVAL FLOW
// ============================================

export interface AgentApprovalRequest {
  agentId: string
  leadId: string
  messageType: 'sms' | 'email'
  draftContent: string
  toPhone?: string
  toEmail?: string
  subject?: string
  inboundMessage?: string
}

/**
 * Send an approval request for an agent's draft message to Slack
 */
export async function sendAgentApprovalRequest(
  organizationId: string,
  request: AgentApprovalRequest,
): Promise<void> {
  const workspaces = await workspaceRepo.findByOrganizationId(organizationId)
  if (workspaces.length === 0) {
    logger.info({ organizationId }, 'No Slack workspaces configured for org')
    return
  }

  // Get agent and lead info
  const agent = await db
    .selectFrom('agent')
    .select(['id', 'name'])
    .where('id', '=', request.agentId)
    .executeTakeFirst()

  const lead = await db
    .selectFrom('lead')
    .select(['id', 'firstName', 'lastName', 'company'])
    .where('id', '=', request.leadId)
    .executeTakeFirst()

  const agentName = agent?.name || 'AI Agent'
  const leadName = lead
    ? [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'
    : 'Unknown Lead'
  const leadCompany = lead?.company ? ` at ${lead.company}` : ''

  for (const workspace of workspaces) {
    if (!workspace.organizationId || workspace.isPending) continue

    // Find notification rules for agent approvals, or fall back to general channel
    const rules = await notificationRuleRepo.findEnabledByWorkspaceAndEventType(
      workspace.id,
      'agent_approval',
    )

    // If no specific rules, use the workspace's default channel if set
    const channels =
      rules.length > 0
        ? rules.map((r) => r.channelId)
        : workspace.settings &&
            typeof workspace.settings === 'object' &&
            'defaultChannelId' in workspace.settings
          ? [workspace.settings.defaultChannelId as string]
          : []

    if (channels.length === 0) {
      logger.info(
        { workspaceId: workspace.id },
        'No channels configured for agent approvals',
      )
      continue
    }

    const client = new SlackClient(workspace.botToken)
    const blocks = buildAgentApprovalBlocks(
      request,
      agentName,
      leadName,
      leadCompany,
    )

    for (const channelId of channels) {
      try {
        await client.postMessage({
          channel: channelId,
          blocks,
          text: `${request.messageType.toUpperCase()} approval needed for ${leadName}`,
        })
        logger.info(
          { workspaceId: workspace.id, channelId, agentId: request.agentId },
          'Sent agent approval request to Slack',
        )
      } catch (error) {
        logger.error(
          { error, workspaceId: workspace.id, channelId },
          'Failed to send agent approval request',
        )
      }
    }
  }
}

/**
 * Handle approval button click from Slack
 */
export async function handleAgentApprovalResponse(
  workspaceId: string,
  payload: {
    action: 'approve' | 'reject'
    agentId: string
    leadId: string
    messageType: 'sms' | 'email'
    slackUserId: string
  },
): Promise<{ success: boolean; message: string }> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace || !workspace.organizationId) {
    return { success: false, message: 'Workspace not found' }
  }

  if (payload.action === 'reject') {
    logger.info({ ...payload, workspaceId }, 'Agent message rejected via Slack')
    return { success: true, message: 'Message rejected' }
  }

  // Approve - send the message
  try {
    if (payload.messageType === 'sms') {
      const agentSmsService = await import('@/services/agentSms.service')

      // Get the most recent draft for this agent/lead
      const agentMessageRepo = await import(
        '@/repositories/agentMessage.repository'
      )
      const messages = await agentMessageRepo.findByLeadId(payload.leadId)
      const latestDraft = messages.find(
        (m) => m.agentId === payload.agentId && m.status === 'received',
      )

      if (!latestDraft || !latestDraft.smsBody) {
        return { success: false, message: 'No draft message found' }
      }

      // Send via SMS service
      await agentSmsService.sendSms(payload.agentId, workspace.organizationId, {
        leadId: payload.leadId,
        body: latestDraft.smsBody,
      })

      return { success: true, message: 'SMS sent successfully' }
    } else if (payload.messageType === 'email') {
      // TODO: Implement email approval
      return { success: false, message: 'Email approval not yet implemented' }
    }

    return { success: false, message: 'Unknown message type' }
  } catch (error) {
    logger.error({ error, ...payload }, 'Failed to send approved message')
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send',
    }
  }
}

/**
 * Build Slack blocks for agent approval request
 */
function buildAgentApprovalBlocks(
  request: AgentApprovalRequest,
  agentName: string,
  leadName: string,
  leadCompany: string,
): SlackBlocks {
  const messageTypeEmoji =
    request.messageType === 'sms' ? ':speech_balloon:' : ':email:'
  const destination = request.toPhone || request.toEmail || 'Unknown'

  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${messageTypeEmoji} ${request.messageType.toUpperCase()} Approval Required`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Agent:*\n${agentName}` },
        { type: 'mrkdwn', text: `*Lead:*\n${leadName}${leadCompany}` },
        { type: 'mrkdwn', text: `*To:*\n${destination}` },
      ],
    },
  ]

  // Show inbound message if this is a reply
  if (request.inboundMessage) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Inbound Message:*\n> ${request.inboundMessage}`,
      },
    })
  }

  // Show draft content
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*Draft Response:*\n\`\`\`${request.draftContent}\`\`\``,
    },
  })

  // Add approve/reject buttons
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Approve & Send', emoji: true },
        style: 'primary',
        action_id: 'agent_message_approve',
        value: JSON.stringify({
          agentId: request.agentId,
          leadId: request.leadId,
          messageType: request.messageType,
        }),
      },
      {
        type: 'button',
        text: { type: 'plain_text', text: 'Reject', emoji: true },
        style: 'danger',
        action_id: 'agent_message_reject',
        value: JSON.stringify({
          agentId: request.agentId,
          leadId: request.leadId,
          messageType: request.messageType,
        }),
      },
    ],
  })

  return blocks
}

// ============================================
// ASK COMMAND (AI-POWERED QUERIES)
// ============================================

/**
 * Handle /omnidial ask command - processes natural language queries about sales data
 */
export async function handleAskQuery(
  query: string,
  organizationId: string,
  slackUserId: string,
): Promise<{ response: string; blocks: SlackBlocks }> {
  const { processAskQuery } = await import('@/services/slackAsk.service')

  const result = await processAskQuery(query, organizationId)

  logger.info(
    {
      organizationId,
      slackUserId,
      query,
      tokensUsed: result.tokensUsed,
    },
    'Processed Slack ask query',
  )

  return {
    response: result.response,
    blocks: result.blocks,
  }
}

// ============================================
// AGENT COMMAND (AGENT MANAGEMENT)
// ============================================

import * as agentRepo from '@/repositories/agent.repository'
import * as agentApprovalRepo from '@/repositories/agentApproval.repository'

/**
 * Handle /omnidial agent command - routes to subcommands
 */
export async function handleAgentCommand(
  workspaceId: string,
  organizationId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const subcommand = args[0]?.toLowerCase() || 'help'
  const subArgs = args.slice(1)

  switch (subcommand) {
    case 'status':
      return handleAgentStatusCommand(organizationId)

    case 'queue':
      return handleAgentQueueCommand(organizationId)

    case 'approve':
      return handleAgentApproveCommand(organizationId, slackUserId, subArgs)

    case 'reject':
      return handleAgentRejectCommand(organizationId, slackUserId, subArgs)

    case 'pause':
      return handleAgentPauseCommand(organizationId, subArgs)

    case 'resume':
      return handleAgentResumeCommand(organizationId, subArgs)

    case 'help':
    default:
      return buildAgentHelpBlocks()
  }
}

/**
 * /omnidial agent status - List all agents with current status
 */
async function handleAgentStatusCommand(
  organizationId: string,
): Promise<SlackBlocks> {
  const agents = await agentRepo.findByOrganizationId(organizationId)

  if (agents.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'No agents configured for this organization. Visit OmniDial to create an agent.',
        },
      },
    ]
  }

  return buildAgentStatusBlocks(agents)
}

/**
 * /omnidial agent queue - Show pending approval requests
 */
async function handleAgentQueueCommand(
  organizationId: string,
): Promise<SlackBlocks> {
  const pendingApprovals =
    await agentApprovalRepo.findPendingByOrganization(organizationId)

  if (pendingApprovals.length === 0) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':white_check_mark: No pending approvals in the queue.',
        },
      },
    ]
  }

  return buildApprovalQueueBlocks(pendingApprovals)
}

/**
 * /omnidial agent approve <id> - Approve a pending action
 */
async function handleAgentApproveCommand(
  organizationId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const approvalId = args[0]

  if (!approvalId) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please provide an approval ID. Use `/omnidial agent queue` to see pending approvals.',
        },
      },
    ]
  }

  try {
    const approval = await agentApprovalRepo.findById(approvalId)

    if (!approval) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: Approval \`${approvalId}\` not found.`,
          },
        },
      ]
    }

    if (approval.organizationId !== organizationId) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':x: You do not have permission to approve this request.',
          },
        },
      ]
    }

    if (approval.status !== 'pending') {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: This approval has already been ${approval.status}.`,
          },
        },
      ]
    }

    // Get user ID from Slack user link
    const userLink = await userLinkRepo.findByWorkspaceAndSlackUser(
      (await workspaceRepo.findByOrganizationId(organizationId))[0]?.id || '',
      slackUserId,
    )

    await agentApprovalRepo.respond(approvalId, {
      respondedById: userLink?.userId || slackUserId,
      response: 'approved',
      responseNote: 'Approved via Slack',
    })

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:white_check_mark: Approved! Action \`${approvalId}\` has been executed.`,
        },
      },
    ]
  } catch (error) {
    logger.error({ error, approvalId }, 'Failed to approve action via Slack')
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':x: Failed to approve. Please try again or use the OmniDial dashboard.',
        },
      },
    ]
  }
}

/**
 * /omnidial agent reject <id> [reason] - Reject a pending action
 */
async function handleAgentRejectCommand(
  organizationId: string,
  slackUserId: string,
  args: string[],
): Promise<SlackBlocks> {
  const approvalId = args[0]
  const reason = args.slice(1).join(' ') || undefined

  if (!approvalId) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please provide an approval ID. Use `/omnidial agent queue` to see pending approvals.',
        },
      },
    ]
  }

  try {
    const approval = await agentApprovalRepo.findById(approvalId)

    if (!approval) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: Approval \`${approvalId}\` not found.`,
          },
        },
      ]
    }

    if (approval.organizationId !== organizationId) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: ':x: You do not have permission to reject this request.',
          },
        },
      ]
    }

    if (approval.status !== 'pending') {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: This approval has already been ${approval.status}.`,
          },
        },
      ]
    }

    const userLink = await userLinkRepo.findByWorkspaceAndSlackUser(
      (await workspaceRepo.findByOrganizationId(organizationId))[0]?.id || '',
      slackUserId,
    )

    await agentApprovalRepo.respond(approvalId, {
      respondedById: userLink?.userId || slackUserId,
      response: 'rejected',
      responseNote: reason || 'Rejected via Slack',
    })

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:no_entry: Rejected! Action \`${approvalId}\` has been cancelled.${reason ? `\n_Reason: ${reason}_` : ''}`,
        },
      },
    ]
  } catch (error) {
    logger.error({ error, approvalId }, 'Failed to reject action via Slack')
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':x: Failed to reject. Please try again or use the OmniDial dashboard.',
        },
      },
    ]
  }
}

/**
 * /omnidial agent pause <name> - Pause/deactivate an agent
 */
async function handleAgentPauseCommand(
  organizationId: string,
  args: string[],
): Promise<SlackBlocks> {
  const agentName = args.join(' ')

  if (!agentName) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please provide an agent name. Use `/omnidial agent status` to see available agents.',
        },
      },
    ]
  }

  try {
    const agents = await agentRepo.findByOrganizationId(organizationId)
    const agent = agents.find(
      (a) => a.name.toLowerCase() === agentName.toLowerCase(),
    )

    if (!agent) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: Agent "${agentName}" not found. Use \`/omnidial agent status\` to see available agents.`,
          },
        },
      ]
    }

    if (agent.status === 'paused' || agent.status === 'inactive') {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:warning: Agent "${agent.name}" is already ${agent.status}.`,
          },
        },
      ]
    }

    await agentRepo.pause(agent.id)

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:pause_button: Paused agent "${agent.name}". Use \`/omnidial agent resume ${agentName}\` to reactivate.`,
        },
      },
    ]
  } catch (error) {
    logger.error({ error, agentName }, 'Failed to pause agent via Slack')
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':x: Failed to pause agent. Please try again or use the OmniDial dashboard.',
        },
      },
    ]
  }
}

/**
 * /omnidial agent resume <name> - Resume/activate an agent
 */
async function handleAgentResumeCommand(
  organizationId: string,
  args: string[],
): Promise<SlackBlocks> {
  const agentName = args.join(' ')

  if (!agentName) {
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Please provide an agent name. Use `/omnidial agent status` to see available agents.',
        },
      },
    ]
  }

  try {
    const agents = await agentRepo.findByOrganizationId(organizationId)
    const agent = agents.find(
      (a) => a.name.toLowerCase() === agentName.toLowerCase(),
    )

    if (!agent) {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:x: Agent "${agentName}" not found. Use \`/omnidial agent status\` to see available agents.`,
          },
        },
      ]
    }

    if (agent.status === 'active') {
      return [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `:white_check_mark: Agent "${agent.name}" is already active.`,
          },
        },
      ]
    }

    await agentRepo.activate(agent.id)

    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `:arrow_forward: Resumed agent "${agent.name}". It is now active and processing.`,
        },
      },
    ]
  } catch (error) {
    logger.error({ error, agentName }, 'Failed to resume agent via Slack')
    return [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':x: Failed to resume agent. Please try again or use the OmniDial dashboard.',
        },
      },
    ]
  }
}

// ============================================
// AGENT COMMAND BLOCK BUILDERS
// ============================================

function buildAgentHelpBlocks(): SlackBlocks {
  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: 'Agent Commands', emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          '*Available Commands:*\n\n' +
          '`/omnidial agent status` - List all agents and their status\n' +
          '`/omnidial agent queue` - Show pending approval requests\n' +
          '`/omnidial agent approve <id>` - Approve a pending action\n' +
          '`/omnidial agent reject <id> [reason]` - Reject a pending action\n' +
          '`/omnidial agent pause <name>` - Pause an agent\n' +
          '`/omnidial agent resume <name>` - Resume a paused agent',
      },
    },
  ]
}

function buildAgentStatusBlocks(
  agents: Awaited<ReturnType<typeof agentRepo.findByOrganizationId>>,
): SlackBlocks {
  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Agents (${agents.length})`,
        emoji: true,
      },
    },
  ]

  for (const agent of agents) {
    const statusEmoji = getAgentStatusEmoji(agent.status)
    const capabilities = [
      agent.smsEnabled ? 'SMS' : null,
      agent.emailEnabled ? 'Email' : null,
    ]
      .filter(Boolean)
      .join(', ')

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${statusEmoji} *${agent.name}*\nStatus: \`${agent.status}\`${capabilities ? ` | Capabilities: ${capabilities}` : ''}`,
      },
    })
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Use \`/omnidial agent pause <name>\` or \`/omnidial agent resume <name>\` to control agents`,
      },
    ],
  })

  return blocks
}

function buildApprovalQueueBlocks(
  approvals: Awaited<
    ReturnType<typeof agentApprovalRepo.findPendingByOrganization>
  >,
): SlackBlocks {
  const blocks: SlackBlocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `Pending Approvals (${approvals.length})`,
        emoji: true,
      },
    },
  ]

  for (const approval of approvals.slice(0, 10)) {
    const leadName = approval.leadFirstName
      ? `${approval.leadFirstName} ${approval.leadLastName || ''}`.trim()
      : 'Unknown Lead'

    const typeEmoji = getApprovalTypeEmoji(approval.approvalType)
    const createdAt = new Date(approval.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })

    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${typeEmoji} *${approval.actionSummary}*\nID: \`${approval.id.slice(0, 8)}\` | Lead: ${leadName}${approval.agentName ? ` | Agent: ${approval.agentName}` : ''}\n_Created: ${createdAt}_`,
      },
    })

    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Approve', emoji: true },
          style: 'primary',
          action_id: 'agent_approval_approve_queue',
          value: approval.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Reject', emoji: true },
          style: 'danger',
          action_id: 'agent_approval_reject_queue',
          value: approval.id,
        },
      ],
    })

    blocks.push({ type: 'divider' })
  }

  if (approvals.length > 10) {
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Showing 10 of ${approvals.length} pending approvals. Visit OmniDial to see all.`,
        },
      ],
    })
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `Use \`/omnidial agent approve <id>\` or \`/omnidial agent reject <id> [reason]\` to respond`,
      },
    ],
  })

  return blocks
}

function getAgentStatusEmoji(status: string | null): string {
  switch (status) {
    case 'active':
      return ':large_green_circle:'
    case 'paused':
      return ':large_yellow_circle:'
    case 'inactive':
      return ':white_circle:'
    default:
      return ':black_circle:'
  }
}

function getApprovalTypeEmoji(type: string): string {
  switch (type) {
    case 'send_email':
      return ':email:'
    case 'send_sms':
      return ':speech_balloon:'
    case 'create_campaign':
      return ':mega:'
    case 'bulk_action':
      return ':package:'
    case 'modify_lead':
      return ':pencil2:'
    default:
      return ':question:'
  }
}

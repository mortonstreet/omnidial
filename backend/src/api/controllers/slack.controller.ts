import { Request, Response } from 'express'
import * as slackService from '@/services/slack.service'
import * as slackReviewService from '@/services/slackReview.service'
import * as workspaceRepo from '@/repositories/slackWorkspace.repository'
import * as notificationRuleRepo from '@/repositories/slackNotificationRule.repository'
import { SlackClient } from '@/clients/slack.client'
import logger from '@/lib/logger'
import { config } from '@/config'
import { db } from '@/lib/db'
import type { SlackEventType } from '@/repositories/slackNotificationRule.repository'

// ============================================
// OAUTH
// ============================================

export const handleOAuthCallback = async (req: Request, res: Response) => {
  try {
    const { code, state, error } = req.query

    if (error) {
      logger.warn({ error }, 'Slack OAuth denied')
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings/integrations?slack=denied`,
      )
    }

    if (!code) {
      return res.redirect(
        `${config.frontendUrl}/dashboard/settings/integrations?slack=error&reason=missing_code`,
      )
    }

    const result = await slackService.handleOAuthCallback(
      code as string,
      (state as string) || null,
    )

    switch (result.type) {
      case 'linked':
        // OmniDial-first flow or re-linking - auto-link users by email
        try {
          await slackService.autoLinkUsersByEmail(result.workspaceId)
        } catch (linkError) {
          logger.error(
            { error: linkError },
            'Failed to auto-link users after OAuth',
          )
        }
        return res.redirect(
          `${config.frontendUrl}/dashboard/settings/integrations?slack=connected`,
        )

      case 'already_linked':
        // Workspace was already connected - just updated token
        return res.redirect(
          `${config.frontendUrl}/dashboard/settings/integrations?slack=reconnected`,
        )

      case 'pending':
        // App Directory flow - redirect to Slack App Home
        // Use Slack deep link to open the app home in Slack
        const slackAppHomeUrl = `slack://app?team=${result.teamId}&id=${result.appId}&tab=home`
        // Fallback to web URL if deep link doesn't work
        const webFallbackUrl = `https://app.slack.com/client/${result.teamId}`

        // Redirect to a landing page that attempts the deep link
        return res.redirect(
          `${config.frontendUrl}/slack-installed?teamId=${result.teamId}&appId=${result.appId}`,
        )

      default:
        return res.redirect(
          `${config.frontendUrl}/dashboard/settings/integrations?slack=connected`,
        )
    }
  } catch (error) {
    logger.error({ error }, 'Slack OAuth callback failed')
    return res.redirect(
      `${config.frontendUrl}/dashboard/settings/integrations?slack=error`,
    )
  }
}

// ============================================
// EVENTS API
// ============================================

export const handleEvent = async (req: Request, res: Response) => {
  const { type, challenge, event, team_id } = req.body

  // URL verification challenge
  if (type === 'url_verification') {
    return res.json({ challenge })
  }

  // Acknowledge immediately to avoid retries
  res.status(200).send()

  try {
    const workspace = await slackService.getWorkspaceByTeamId(team_id)
    if (!workspace) {
      logger.warn({ teamId: team_id }, 'Received event for unknown workspace')
      return
    }

    switch (event?.type) {
      case 'app_home_opened':
        await handleAppHomeOpened(workspace.id, event.user)
        break

      case 'app_mention':
        await handleAppMention(workspace.id, event)
        break

      case 'message':
        // Handle direct messages to the bot
        if (event.channel_type === 'im' && !event.bot_id) {
          await handleDirectMessage(workspace.id, event)
        }
        break

      default:
        logger.debug({ eventType: event?.type }, 'Unhandled Slack event type')
    }
  } catch (error) {
    logger.error({ error, event }, 'Failed to handle Slack event')
  }
}

async function handleAppHomeOpened(
  workspaceId: string,
  slackUserId: string,
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) return

  const client = new SlackClient(workspace.botToken)

  // Check if workspace is pending (not linked to an organization)
  if (workspace.isPending || !workspace.organizationId) {
    // Create a link token for this user
    let connectUrl: string
    try {
      const linkToken = await slackService.getOrCreateLinkToken(
        workspaceId,
        slackUserId,
      )
      connectUrl = `${config.frontendUrl}/slack-link?token=${linkToken.token}`
    } catch (error) {
      logger.error({ error, workspaceId }, 'Failed to create link token')
      connectUrl = `${config.frontendUrl}/slack-link?error=rate_limited`
    }

    const pendingView = buildPendingAppHomeView(connectUrl)
    await client.updateAppHome({ userId: slackUserId, view: pendingView })
    return
  }

  // Check if this Slack user is linked to a OmniDial user
  const userLink = await slackService.getUserLinkBySlackId(
    workspaceId,
    slackUserId,
  )

  if (!userLink) {
    // Workspace is linked but this user isn't
    const unlinkedView = buildUnlinkedUserView()
    await client.updateAppHome({ userId: slackUserId, view: unlinkedView })
    return
  }

  // Full linked view
  const linkedView = buildLinkedAppHomeView()
  await client.updateAppHome({ userId: slackUserId, view: linkedView })
}

/**
 * Build App Home view for pending workspaces (not linked to org)
 */
function buildPendingAppHomeView(connectUrl: string) {
  return {
    type: 'home' as const,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'OmniDial', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':wave: *Welcome to OmniDial!*\n\nTo get started, connect this Slack workspace to your OmniDial organization.',
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "*What you'll get:*\n:phone: Real-time call notifications\n:mag: Search leads directly from Slack\n:chart_with_upwards_trend: Team leaderboards and analytics\n:robot_face: AI coaching summaries\n:bell: Pipeline and deal alerts",
        },
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'Connect to OmniDial',
              emoji: true,
            },
            url: connectUrl,
            style: 'primary',
            action_id: 'connect_omnidial',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: "You'll be asked to log in to OmniDial and select your organization.",
          },
        ],
      },
    ],
  }
}

/**
 * Build App Home view for users not linked to OmniDial
 */
function buildUnlinkedUserView() {
  return {
    type: 'home' as const,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'OmniDial', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ":wave: *Almost there!*\n\nYour Slack workspace is connected to OmniDial, but your personal account isn't linked yet.",
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Link your account to:\n:bell: Receive personal notifications\n:phone: Use click-to-call from Slack\n:chart_with_upwards_trend: View your personal stats',
        },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Link Account', emoji: true },
            url: `${config.frontendUrl}/dashboard/settings/integrations`,
            style: 'primary',
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'You can still use `/omnidial` commands - just link your account for the full experience.',
          },
        ],
      },
    ],
  }
}

/**
 * Build App Home view for fully linked users
 */
function buildLinkedAppHomeView() {
  return {
    type: 'home' as const,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'OmniDial', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Welcome to OmniDial! Get real-time call notifications, search leads, and view team analytics right from Slack.',
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Quick Commands*' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/omnidial stats` - View call statistics\n' +
            '`/omnidial lead [query]` - Search for leads\n' +
            '`/omnidial leaderboard` - View team rankings\n' +
            '`/omnidial coaching` - View recent coaching\n' +
            '`/omnidial pipeline` - View pipeline overview\n' +
            '`/omnidial help` - Show all commands',
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*AI-Powered Queries*' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/omnidial ask <question>` - Ask natural language questions\n' +
            '_"How many leads did we qualify this week?"_',
        },
      },
      { type: 'divider' },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: '*Agent Management*' },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            '`/omnidial agent status` - View agent status\n' +
            '`/omnidial agent queue` - Pending approvals',
        },
      },
      { type: 'divider' },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Open OmniDial', emoji: true },
            url: config.frontendUrl,
            style: 'primary',
          },
        ],
      },
    ],
  }
}

async function handleAppMention(
  workspaceId: string,
  event: { user: string; text: string; channel: string },
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) return

  const client = new SlackClient(workspace.botToken)

  // Simple response to mentions
  await client.postMessage({
    channel: event.channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `Hi <@${event.user}>! Use \`/omnidial help\` to see available commands.`,
        },
      },
    ],
  })
}

async function handleDirectMessage(
  workspaceId: string,
  event: { user: string; text: string; channel: string },
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) return

  const client = new SlackClient(workspace.botToken)

  await client.postMessage({
    channel: event.channel,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'Hi! I work best with slash commands. Try `/omnidial help` to see what I can do!',
        },
      },
    ],
  })
}

// ============================================
// SLASH COMMANDS
// ============================================

export const handleCommand = async (req: Request, res: Response) => {
  const {
    command,
    text,
    team_id,
    user_id,
    trigger_id,
    response_url,
    channel_id,
  } = req.body

  try {
    const workspace = await slackService.getWorkspaceByTeamId(team_id)
    if (!workspace) {
      return res.json({
        response_type: 'ephemeral',
        text: 'This workspace is not connected to OmniDial. Please connect via the integrations settings.',
      })
    }

    // Check if workspace is pending (not linked to an organization)
    if (workspace.isPending || !workspace.organizationId) {
      return res.json({
        response_type: 'ephemeral',
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: ":construction: *Setup Required*\n\nThis Slack workspace hasn't been connected to a OmniDial organization yet.",
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Open the *App Home* tab to complete setup.',
            },
          },
        ],
      })
    }

    // Parse subcommand and args
    const parts = (text || '').trim().split(/\s+/)
    const subcommand = parts[0]?.toLowerCase() || 'help'
    const args = parts.slice(1)

    let blocks
    switch (subcommand) {
      case 'stats':
        blocks = await slackService.handleStatsCommand(
          workspace.id,
          user_id,
          args,
        )
        break

      case 'lead':
        blocks = await slackService.handleLeadCommand(
          workspace.id,
          user_id,
          args.join(' '),
        )
        break

      case 'leaderboard':
        blocks = await slackService.handleLeaderboardCommand(
          workspace.id,
          user_id,
          args,
        )
        break

      case 'calls':
        blocks = await slackService.handleCallsCommand(
          workspace.id,
          user_id,
          args,
        )
        break

      case 'coaching':
        blocks = await slackService.handleCoachingCommand(
          workspace.id,
          user_id,
          args,
        )
        break

      case 'transcript':
        blocks = await slackService.handleTranscriptCommand(
          workspace.id,
          user_id,
          args.join(' '),
        )
        break

      case 'pipeline':
        blocks = await slackService.handlePipelineCommand(
          workspace.id,
          user_id,
          args,
        )
        break

      case 'ask':
        // AI-powered natural language queries
        return await handleAskCommand(
          workspace.id,
          workspace.organizationId,
          user_id,
          args.join(' '),
          response_url,
          res,
        )

      case 'agent':
        // Agent management commands
        blocks = await slackService.handleAgentCommand(
          workspace.id,
          workspace.organizationId,
          user_id,
          args,
        )
        break

      case 'settings':
        // Open settings modal
        return await openSettingsModal(workspace.id, trigger_id, res)

      case 'help':
      default:
        blocks = await slackService.handleHelpCommand()
        break
    }

    return res.json({
      response_type: 'ephemeral',
      blocks,
    })
  } catch (error) {
    logger.error({ error, command, text }, 'Failed to handle slash command')
    return res.json({
      response_type: 'ephemeral',
      text: 'Something went wrong. Please try again later.',
    })
  }
}

/**
 * Handle /omnidial ask command - AI-powered queries
 * Sends immediate acknowledgment then processes asynchronously
 */
async function handleAskCommand(
  workspaceId: string,
  organizationId: string,
  slackUserId: string,
  query: string,
  responseUrl: string,
  res: Response,
): Promise<Response> {
  if (!query.trim()) {
    return res.json({
      response_type: 'ephemeral',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: "Please provide a question. Example:\n`/omnidial ask how many leads did we qualify this week?`\n`/omnidial ask what's our call connect rate?`\n`/omnidial ask show me leads from Acme Corp`",
          },
        },
      ],
    })
  }

  // Send immediate acknowledgment
  res.json({
    response_type: 'ephemeral',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: ':thinking_face: Thinking...',
        },
      },
    ],
  })

  // Process asynchronously and post to response URL
  setImmediate(async () => {
    try {
      const result = await slackService.handleAskQuery(
        query,
        organizationId,
        slackUserId,
      )

      // Post result to response_url
      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          replace_original: true,
          blocks: result.blocks,
        }),
      })
    } catch (error) {
      logger.error(
        { error, query, workspaceId },
        'Failed to process ask command',
      )

      await fetch(responseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response_type: 'ephemeral',
          replace_original: true,
          text: 'Sorry, something went wrong processing your question. Please try again.',
        }),
      })
    }
  })

  return res
}

async function openSettingsModal(
  workspaceId: string,
  triggerId: string,
  res: Response,
): Promise<Response> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) {
    return res.json({ response_type: 'ephemeral', text: 'Workspace not found' })
  }

  const rules = await notificationRuleRepo.findByWorkspaceId(workspaceId)

  const eventTypes: SlackEventType[] = [
    'inbound_call',
    'call_completed',
    'milestone_reached',
    'daily_summary',
    'weekly_summary',
  ]

  const checkboxOptions = eventTypes.map((eventType) => ({
    text: { type: 'plain_text' as const, text: formatEventType(eventType) },
    value: eventType,
  }))

  const enabledEvents = rules.filter((r) => r.enabled).map((r) => r.eventType)
  const initialOptions = checkboxOptions.filter((opt) =>
    enabledEvents.includes(opt.value as SlackEventType),
  )

  const client = new SlackClient(workspace.botToken)

  try {
    await client.openModal({
      triggerId,
      view: {
        type: 'modal',
        callback_id: 'settings_modal',
        title: { type: 'plain_text', text: 'Notification Settings' },
        submit: { type: 'plain_text', text: 'Save' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Choose which notifications to receive in this channel.',
            },
          },
          {
            type: 'input',
            block_id: 'notifications',
            label: { type: 'plain_text', text: 'Enabled Notifications' },
            element: {
              type: 'checkboxes',
              action_id: 'notification_types',
              options: checkboxOptions,
              ...(initialOptions.length > 0
                ? { initial_options: initialOptions }
                : {}),
            },
            optional: true,
          },
        ],
        private_metadata: JSON.stringify({ workspaceId }),
      },
    })
    return res.status(200).send()
  } catch (error) {
    logger.error({ error }, 'Failed to open settings modal')
    return res.json({
      response_type: 'ephemeral',
      text: 'Failed to open settings',
    })
  }
}

function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    inbound_call: 'Inbound Call Alerts',
    call_completed: 'Call Completed',
    milestone_reached: 'Team Milestones',
    daily_summary: 'Daily Summary',
    weekly_summary: 'Weekly Summary',
    lead_created: 'New Leads',
    deal_won: 'Deals Won',
    deal_lost: 'Deals Lost',
    coaching_available: 'Coaching Ready',
    rep_activity: 'Rep Activity',
  }
  return labels[eventType] || eventType
}

// ============================================
// INTERACTIONS
// ============================================

export const handleInteraction = async (req: Request, res: Response) => {
  // Slack sends payload as form-encoded JSON string
  const payload = JSON.parse(req.body.payload)
  const { type, team, user, actions, view, trigger_id } = payload

  // Acknowledge immediately
  res.status(200).send()

  try {
    const workspace = await slackService.getWorkspaceByTeamId(team?.id)
    if (!workspace) {
      logger.warn({ teamId: team?.id }, 'Interaction from unknown workspace')
      return
    }

    switch (type) {
      case 'block_actions':
        await handleBlockAction(workspace.id, user.id, actions, trigger_id)
        break

      case 'view_submission':
        await handleViewSubmission(workspace.id, user.id, view)
        break

      case 'shortcut':
        // Global shortcuts
        break

      default:
        logger.debug({ type }, 'Unhandled interaction type')
    }
  } catch (error) {
    logger.error({ error, payload }, 'Failed to handle interaction')
  }
}

async function handleBlockAction(
  workspaceId: string,
  slackUserId: string,
  actions: Array<{ action_id: string; value?: string }>,
  triggerId: string,
): Promise<void> {
  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace) return

  // Skip actions for pending workspaces
  if (!workspace.organizationId) return

  for (const action of actions) {
    switch (action.action_id) {
      case 'view_lead':
      case 'view_coaching':
        // Button clicks with URLs are handled client-side
        break

      case 'call_lead':
        await handleCallLeadAction(
          { ...workspace, organizationId: workspace.organizationId! },
          slackUserId,
          action.value,
          triggerId,
        )
        break

      case 'add_note':
        // Open note modal
        // Implementation would open a modal for adding notes to a lead
        break

      case 'refresh_stats':
        // Could trigger a stats refresh
        break

      case 'qualification_approve':
      case 'qualification_reject':
      case 'qualification_edit':
        await handleQualificationReviewAction(
          { ...workspace, organizationId: workspace.organizationId! },
          slackUserId,
          action.action_id,
          action.value,
          triggerId,
        )
        break

      case 'agent_message_approve':
      case 'agent_message_reject':
        await handleAgentMessageApprovalAction(
          { ...workspace, organizationId: workspace.organizationId! },
          slackUserId,
          action.action_id,
          action.value,
        )
        break

      case 'agent_approval_approve_queue':
      case 'agent_approval_reject_queue':
        await handleAgentApprovalQueueAction(
          { ...workspace, organizationId: workspace.organizationId! },
          slackUserId,
          action.action_id,
          action.value,
        )
        break

      default:
        logger.debug({ actionId: action.action_id }, 'Unhandled block action')
    }
  }
}

async function handleAgentMessageApprovalAction(
  workspace: { id: string; organizationId: string; botToken: string },
  slackUserId: string,
  actionId: string,
  value: string | undefined,
): Promise<void> {
  if (!value) {
    logger.warn('Agent message approval action missing value')
    return
  }

  let payload: {
    agentId: string
    leadId: string
    messageType: 'sms' | 'email'
  }
  try {
    payload = JSON.parse(value)
  } catch {
    logger.warn({ value }, 'Failed to parse agent message approval value')
    return
  }

  const action = actionId === 'agent_message_approve' ? 'approve' : 'reject'

  const result = await slackService.handleAgentApprovalResponse(workspace.id, {
    action,
    agentId: payload.agentId,
    leadId: payload.leadId,
    messageType: payload.messageType,
    slackUserId,
  })

  // Send feedback to user
  const client = new SlackClient(workspace.botToken)
  const dmChannel = await client.openDmChannel(slackUserId)

  if (dmChannel) {
    const emoji = result.success ? ':white_check_mark:' : ':x:'
    const message =
      action === 'approve'
        ? result.success
          ? `${emoji} Message approved and sent!`
          : `${emoji} Failed to send: ${result.message}`
        : `${emoji} Message rejected`

    await client.postMessage({
      channel: dmChannel,
      blocks: [
        {
          type: 'section',
          text: { type: 'mrkdwn', text: message },
        },
      ],
    })
  }
}

async function handleQualificationReviewAction(
  workspace: { id: string; organizationId: string; botToken: string },
  slackUserId: string,
  actionId: string,
  value: string | undefined,
  triggerId: string,
): Promise<void> {
  if (!value) {
    logger.warn('Qualification review action missing value')
    return
  }

  let payload: {
    qualificationId: string
    action: 'approve' | 'reject' | 'edit'
  }
  try {
    payload = JSON.parse(value)
  } catch {
    logger.warn({ value }, 'Failed to parse qualification review action value')
    return
  }

  await slackReviewService.handleReviewAction(
    workspace.id,
    slackUserId,
    payload,
    triggerId,
  )
}

async function handleAgentApprovalQueueAction(
  workspace: { id: string; organizationId: string; botToken: string },
  slackUserId: string,
  actionId: string,
  approvalId: string | undefined,
): Promise<void> {
  if (!approvalId) {
    logger.warn('Agent approval queue action missing approval ID')
    return
  }

  const action =
    actionId === 'agent_approval_approve_queue' ? 'approve' : 'reject'

  // Import repositories dynamically to avoid circular dependencies
  const agentApprovalRepo = await import(
    '@/repositories/agentApproval.repository'
  )
  const userLinkRepo = await import('@/repositories/slackUserLink.repository')

  try {
    const approval = await agentApprovalRepo.findById(approvalId)

    if (!approval) {
      logger.warn({ approvalId }, 'Approval not found for queue action')
      return
    }

    if (approval.organizationId !== workspace.organizationId) {
      logger.warn(
        { approvalId, organizationId: workspace.organizationId },
        'Approval org mismatch',
      )
      return
    }

    if (approval.status !== 'pending') {
      // Already processed - send feedback
      const client = new SlackClient(workspace.botToken)
      const dmChannel = await client.openDmChannel(slackUserId)
      if (dmChannel) {
        await client.postMessage({
          channel: dmChannel,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `:warning: This approval has already been ${approval.status}.`,
              },
            },
          ],
        })
      }
      return
    }

    // Get user ID from Slack user link
    const userLink = await userLinkRepo.findByWorkspaceAndSlackUser(
      workspace.id,
      slackUserId,
    )

    await agentApprovalRepo.respond(approvalId, {
      respondedById: userLink?.userId || slackUserId,
      response: action === 'approve' ? 'approved' : 'rejected',
      responseNote: `${action === 'approve' ? 'Approved' : 'Rejected'} via Slack queue`,
    })

    // Send confirmation
    const client = new SlackClient(workspace.botToken)
    const dmChannel = await client.openDmChannel(slackUserId)
    if (dmChannel) {
      const emoji = action === 'approve' ? ':white_check_mark:' : ':no_entry:'
      const verb = action === 'approve' ? 'Approved' : 'Rejected'
      await client.postMessage({
        channel: dmChannel,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} ${verb} action \`${approvalId.slice(0, 8)}\``,
            },
          },
        ],
      })
    }

    logger.info(
      { approvalId, action, slackUserId },
      'Processed agent approval from queue',
    )
  } catch (error) {
    logger.error(
      { error, approvalId, action },
      'Failed to process queue approval',
    )
  }
}

async function handleCallLeadAction(
  workspace: { id: string; organizationId: string; botToken: string },
  slackUserId: string,
  value: string | undefined,
  triggerId: string,
): Promise<void> {
  if (!value) {
    logger.warn('Call lead action missing value')
    return
  }

  let leadData: { leadId: string; phone: string }
  try {
    leadData = JSON.parse(value)
  } catch {
    logger.warn({ value }, 'Failed to parse call lead action value')
    return
  }

  // Get the linked OmniDial user
  const userLink = await slackService.getUserLinkBySlackId(
    workspace.id,
    slackUserId,
  )

  if (!userLink) {
    // Not linked - show message to link their account
    const client = new SlackClient(workspace.botToken)
    await client.openModal({
      triggerId,
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Account Not Linked' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Your Slack account is not linked to OmniDial. Please link your account in OmniDial settings to use click-to-call.',
            },
          },
          {
            type: 'actions',
            elements: [
              {
                type: 'button',
                text: {
                  type: 'plain_text',
                  text: 'Open Settings',
                  emoji: true,
                },
                url: `${config.frontendUrl}/dashboard/settings/integrations`,
                style: 'primary',
              },
            ],
          },
        ],
      },
    })
    return
  }

  // Get lead details
  const lead = await db
    .selectFrom('lead')
    .select(['id', 'firstName', 'lastName', 'company', 'phone'])
    .where('id', '=', leadData.leadId)
    .where('organizationId', '=', workspace.organizationId)
    .executeTakeFirst()

  if (!lead) {
    logger.warn({ leadId: leadData.leadId }, 'Lead not found for call action')
    return
  }

  // Get user's available phone numbers (caller IDs)
  const twilioConfig = await db
    .selectFrom('twilio_config')
    .select(['id', 'phoneNumbers'])
    .where('organizationId', '=', workspace.organizationId)
    .executeTakeFirst()

  const phoneNumbers = twilioConfig?.phoneNumbers
    ? twilioConfig.phoneNumbers.map((p) => ({ label: p, value: p }))
    : []

  // For click-to-call, we need a phone number for the rep
  // This would typically come from the user's profile or be entered in the modal
  // For now, we require at least one Twilio number configured
  if (phoneNumbers.length === 0) {
    const client = new SlackClient(workspace.botToken)
    await client.openModal({
      triggerId,
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Click-to-Call Unavailable' },
        close: { type: 'plain_text', text: 'Close' },
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: 'Click-to-call is not available. No phone numbers are configured in your Twilio settings.',
            },
          },
        ],
      },
    })
    return
  }

  const leadName =
    [lead.firstName, lead.lastName].filter(Boolean).join(' ') || 'Unknown'

  const client = new SlackClient(workspace.botToken)
  await client.openModal({
    triggerId,
    view: {
      type: 'modal',
      callback_id: 'call_confirmation_modal',
      title: { type: 'plain_text', text: 'Call Lead' },
      submit: { type: 'plain_text', text: 'Call Now' },
      close: { type: 'plain_text', text: 'Cancel' },
      private_metadata: JSON.stringify({
        workspaceId: workspace.id,
        leadId: lead.id,
        leadPhone: lead.phone,
        userId: userLink.userId,
      }),
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Calling:* ${leadName}${lead.company ? ` at ${lead.company}` : ''}\n*Number:* ${lead.phone}`,
          },
        },
        {
          type: 'divider',
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `When you click "Call Now", we'll call your phone first, then connect you to ${leadName}.`,
          },
        },
        {
          type: 'input',
          block_id: 'rep_phone',
          label: { type: 'plain_text', text: 'Your Phone Number' },
          hint: {
            type: 'plain_text',
            text: 'We will call this number first to connect you',
          },
          element: {
            type: 'plain_text_input',
            action_id: 'rep_phone_input',
            placeholder: { type: 'plain_text', text: '+1234567890' },
          },
        },
        {
          type: 'input',
          block_id: 'caller_id',
          label: { type: 'plain_text', text: 'Caller ID (shown to lead)' },
          element: {
            type: 'static_select',
            action_id: 'caller_id_select',
            placeholder: { type: 'plain_text', text: 'Select caller ID' },
            options: phoneNumbers.map((p) => ({
              text: { type: 'plain_text', text: p.label },
              value: p.value,
            })),
            initial_option: {
              text: { type: 'plain_text', text: phoneNumbers[0].label },
              value: phoneNumbers[0].value,
            },
          },
        },
      ],
    },
  })
}

async function handleViewSubmission(
  workspaceId: string,
  slackUserId: string,
  view: {
    callback_id: string
    private_metadata?: string
    state?: {
      values: Record<
        string,
        Record<
          string,
          {
            selected_options?: Array<{ value: string }>
            selected_option?: { value: string }
          }
        >
      >
    }
  },
): Promise<void> {
  switch (view.callback_id) {
    case 'settings_modal':
      await handleSettingsSave(workspaceId, slackUserId, view)
      break

    case 'call_confirmation_modal':
      await handleCallConfirmation(workspaceId, slackUserId, view)
      break

    case 'qualification_edit_modal':
      await handleQualificationEditSubmission(workspaceId, slackUserId, view)
      break

    default:
      logger.debug(
        { callbackId: view.callback_id },
        'Unhandled view submission',
      )
  }
}

async function handleQualificationEditSubmission(
  workspaceId: string,
  slackUserId: string,
  view: {
    private_metadata?: string
    state?: {
      values: Record<
        string,
        Record<
          string,
          {
            value?: string
            selected_options?: Array<{ value: string }>
            selected_option?: { value: string }
          }
        >
      >
    }
  },
): Promise<void> {
  if (!view.private_metadata) {
    logger.warn('Qualification edit missing private_metadata')
    return
  }

  let metadata: { qualificationId: string }
  try {
    metadata = JSON.parse(view.private_metadata)
  } catch {
    logger.warn('Failed to parse qualification edit metadata')
    return
  }

  const emailSubject =
    view.state?.values?.email_subject?.email_subject_input?.value
  const emailBody = view.state?.values?.email_body?.email_body_input?.value
  const smsBody = view.state?.values?.sms_body?.sms_body_input?.value
  const reviewNotes =
    view.state?.values?.review_notes?.review_notes_input?.value

  const editedEmail =
    emailSubject && emailBody
      ? { subject: emailSubject, body: emailBody }
      : undefined

  await slackReviewService.handleEditSubmission(
    workspaceId,
    slackUserId,
    metadata.qualificationId,
    editedEmail,
    smsBody || undefined,
    reviewNotes || undefined,
  )
}

async function handleCallConfirmation(
  workspaceId: string,
  slackUserId: string,
  view: {
    private_metadata?: string
    state?: {
      values: Record<
        string,
        Record<string, { selected_option?: { value: string }; value?: string }>
      >
    }
  },
): Promise<void> {
  if (!view.private_metadata) {
    logger.warn('Call confirmation missing private_metadata')
    return
  }

  let metadata: {
    workspaceId: string
    leadId: string
    leadPhone: string
    userId: string
  }
  try {
    metadata = JSON.parse(view.private_metadata)
  } catch {
    logger.warn('Failed to parse call confirmation metadata')
    return
  }

  const repPhone = view.state?.values?.rep_phone?.rep_phone_input?.value
  const callerId =
    view.state?.values?.caller_id?.caller_id_select?.selected_option?.value

  if (!repPhone) {
    logger.warn('No rep phone number provided for click-to-call')
    return
  }

  if (!callerId) {
    logger.warn('No caller ID selected for click-to-call')
    return
  }

  // Import and call the click-to-call service
  const { initiateCallFromSlack } = await import(
    '@/services/slackClickToCall.service'
  )

  try {
    await initiateCallFromSlack({
      organizationId:
        (await workspaceRepo.findById(workspaceId))?.organizationId || '',
      userId: metadata.userId,
      leadId: metadata.leadId,
      leadPhone: metadata.leadPhone,
      repPhone,
      fromNumber: callerId,
      slackWorkspaceId: workspaceId,
      slackUserId,
    })

    logger.info(
      { leadId: metadata.leadId, userId: metadata.userId },
      'Initiated click-to-call from Slack',
    )
  } catch (error) {
    logger.error({ error }, 'Failed to initiate click-to-call from Slack')
  }
}

async function handleSettingsSave(
  workspaceId: string,
  slackUserId: string,
  view: {
    private_metadata?: string
    state?: {
      values: Record<
        string,
        Record<string, { selected_options?: Array<{ value: string }> }>
      >
    }
  },
): Promise<void> {
  const selectedOptions =
    view.state?.values?.notifications?.notification_types?.selected_options ||
    []
  const enabledTypes = selectedOptions.map((opt) => opt.value)

  const workspace = await workspaceRepo.findById(workspaceId)
  if (!workspace?.defaultChannelId) return

  const eventTypes: SlackEventType[] = [
    'inbound_call',
    'call_completed',
    'milestone_reached',
    'daily_summary',
    'weekly_summary',
  ]

  for (const eventType of eventTypes) {
    const enabled = enabledTypes.includes(eventType)
    await notificationRuleRepo.upsert({
      workspaceId,
      channelId: workspace.defaultChannelId,
      eventType,
      enabled,
    })
  }

  logger.info(
    { workspaceId, enabledTypes },
    'Updated notification settings from Slack',
  )
}

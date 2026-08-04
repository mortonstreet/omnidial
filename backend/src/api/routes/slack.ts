import { Router, Request, Response } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import { authenticatedRoute } from './utils'
import * as workspaceRepo from '@/repositories/slackWorkspace.repository'
import * as notificationRuleRepo from '@/repositories/slackNotificationRule.repository'
import * as userLinkRepo from '@/repositories/slackUserLink.repository'
// TODO: Re-enable when App Directory flow is complete
// import * as slackLinkTokenRepo from '@/repositories/slackLinkToken.repository'
import * as slackService from '@/services/slack.service'
import { SlackClient } from '@/clients/slack.client'
import { config } from '@/config'
import { db } from '@/lib/db'
import logger from '@/lib/logger'
import type { AuthRequestHandler, AuthRequest } from '@/types/handlers'

const router = Router()

// Helper to get organizationId from session (better-auth nests session inside session)
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as { session?: { activeOrganizationId?: string } })?.session
    ?.activeOrganizationId ?? null

/**
 * Get Slack integration status for the organization
 * GET /slack/status
 */
const getStatus: AuthRequestHandler<Record<string, never>> = async (
  req,
  res,
) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)

  if (!workspace) {
    return res.json({
      connected: false,
      installUrl: getSlackInstallUrl(organizationId),
    })
  }

  const rules = await notificationRuleRepo.findByWorkspaceId(workspace.id)
  const userLinks = await userLinkRepo.findByWorkspaceId(workspace.id)

  return res.json({
    connected: true,
    workspace: {
      id: workspace.id,
      teamId: workspace.teamId,
      teamName: workspace.teamName,
      teamDomain: workspace.teamDomain,
      defaultChannelId: workspace.defaultChannelId,
      isActive: workspace.isActive,
      lastActivityAt: workspace.lastActivityAt,
      connectedAt: workspace.createdAt,
    },
    notificationRules: rules.map((r) => ({
      id: r.id,
      channelId: r.channelId,
      channelName: r.channelName,
      eventType: r.eventType,
      enabled: r.enabled,
    })),
    linkedUsers: userLinks.length,
  })
}

/**
 * Get install URL for OAuth
 * GET /slack/install-url
 */
const getInstallUrlRoute: AuthRequestHandler<Record<string, never>> = async (
  req,
  res,
) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  return res.json({
    url: getSlackInstallUrl(organizationId),
  })
}

/**
 * Disconnect Slack workspace
 * POST /slack/disconnect
 */
const disconnect: AuthRequestHandler<Record<string, never>> = async (
  req,
  res,
) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    return res.status(404).json({ error: 'No Slack workspace connected' })
  }

  await slackService.disconnectWorkspace(workspace.id)

  return res.json({ success: true })
}

/**
 * Get available channels for notifications
 * GET /slack/channels
 */
const getChannels: AuthRequestHandler<Record<string, never>> = async (
  req,
  res,
) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    return res.status(404).json({ error: 'No Slack workspace connected' })
  }

  const client = new SlackClient(workspace.botToken)
  const channels = await client.listConversations()

  return res.json({
    channels: channels.map((c) => ({
      id: c.id,
      name: c.name,
      isPrivate: c.is_private,
    })),
  })
}

/**
 * Update notification rules
 * PUT /slack/notification-rules
 */
const updateNotificationRules: AuthRequestHandler<{
  channelId: string
  rules: Array<{ eventType: string; enabled: boolean }>
}> = async (req, res) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    return res.status(404).json({ error: 'No Slack workspace connected' })
  }

  const { channelId, rules } = req.body

  if (!channelId || !Array.isArray(rules)) {
    return res.status(400).json({ error: 'channelId and rules are required' })
  }

  // Get channel name from Slack
  let channelName: string | null = null
  try {
    const client = new SlackClient(workspace.botToken)
    const channels = await client.listConversations()
    const channel = channels.find((c) => c.id === channelId)
    channelName = channel?.name || null
  } catch {
    // Continue without channel name
  }

  // Update or create rules
  for (const rule of rules) {
    await notificationRuleRepo.upsert({
      workspaceId: workspace.id,
      channelId,
      channelName,
      eventType: rule.eventType as notificationRuleRepo.SlackEventType,
      enabled: rule.enabled,
      createdById: req.user.id,
    })
  }

  // Also update default channel
  await workspaceRepo.update(workspace.id, {
    defaultChannelId: channelId,
  })

  const updatedRules = await notificationRuleRepo.findByWorkspaceId(
    workspace.id,
  )

  return res.json({
    success: true,
    rules: updatedRules.map((r) => ({
      id: r.id,
      channelId: r.channelId,
      channelName: r.channelName,
      eventType: r.eventType,
      enabled: r.enabled,
    })),
  })
}

/**
 * Link current user to Slack
 * POST /slack/link-user
 */
const linkUser: AuthRequestHandler<{ slackUserId: string }> = async (
  req,
  res,
) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    return res.status(404).json({ error: 'No Slack workspace connected' })
  }

  const { slackUserId } = req.body
  if (!slackUserId) {
    return res.status(400).json({ error: 'slackUserId is required' })
  }

  // Get Slack user profile
  const client = new SlackClient(workspace.botToken)
  const slackUser = await client.getUserInfo(slackUserId)

  await slackService.linkSlackUser(workspace.id, req.user.id, slackUserId, {
    email: slackUser?.profile?.email,
    display_name: slackUser?.profile?.display_name,
    real_name: slackUser?.profile?.real_name,
    tz: slackUser?.tz,
  })

  return res.json({ success: true })
}

/**
 * Auto-link users by email
 * POST /slack/auto-link
 */
const autoLinkUsers: AuthRequestHandler<Record<string, never>> = async (
  req,
  res,
) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    return res.status(404).json({ error: 'No Slack workspace connected' })
  }

  const linkedCount = await slackService.autoLinkUsersByEmail(workspace.id)

  return res.json({
    success: true,
    linkedCount,
  })
}

/**
 * Send a test notification
 * POST /slack/test-notification
 */
const testNotification: AuthRequestHandler<{
  channelId: string
  eventType: string
}> = async (req, res) => {
  const organizationId = getOrgId(req)
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID required' })
  }

  const workspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (!workspace) {
    return res.status(404).json({ error: 'No Slack workspace connected' })
  }

  const { channelId, eventType } = req.body
  if (!channelId) {
    return res.status(400).json({ error: 'channelId is required' })
  }

  const client = new SlackClient(workspace.botToken)

  await client.postMessage({
    channel: channelId,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Test Notification*\nThis is a test message from OmniDial. Event type: ${eventType || 'general'}`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `Sent at ${new Date().toISOString()}`,
          },
        ],
      },
    ],
    text: 'Test notification from OmniDial',
  })

  return res.json({ success: true })
}

// Helper function to build install URL
function getSlackInstallUrl(organizationId: string): string {
  const scopes = [
    'app_mentions:read',
    'channels:history',
    'channels:read',
    'chat:write',
    'chat:write.public',
    'commands',
    'files:write',
    'groups:history',
    'groups:read',
    'im:history',
    'im:read',
    'im:write',
    'mpim:history',
    'mpim:read',
    'reactions:read',
    'reactions:write',
    'team:read',
    'users:read',
    'users:read.email',
  ].join(',')

  const redirectUri = `${config.backendUrl}/api/webhooks/slack/oauth/callback`

  return `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${organizationId}`
}

// ============================================
// APP DIRECTORY FLOW - LINK ENDPOINTS
// TODO: Re-enable when App Directory flow is complete
// ============================================

/*
const validateLinkToken = async (req: Request, res: Response) => {
  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required' })
  }

  const linkToken = await slackLinkTokenRepo.findByToken(token)
  if (!linkToken) {
    return res.status(404).json({ error: 'Invalid or expired token' })
  }

  const workspace = await workspaceRepo.findById(linkToken.workspaceId)
  if (!workspace) {
    return res.status(404).json({ error: 'Workspace not found' })
  }

  return res.json({
    valid: true,
    workspace: {
      id: workspace.id,
      teamName: workspace.teamName,
      teamDomain: workspace.teamDomain,
    },
    expiresAt: linkToken.expiresAt,
  })
}
*/

/*
const getLinkOrganizations: AuthRequestHandler<Record<string, never>> = async (
  req,
  res,
) => {
  const { token } = req.query

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Token is required' })
  }

  const linkToken = await slackLinkTokenRepo.findByToken(token)
  if (!linkToken) {
    return res.status(404).json({ error: 'Invalid or expired token' })
  }

  const organizations = await db
    .selectFrom('organization')
    .innerJoin('member', 'organization.id', 'member.organizationId')
    .where('member.userId', '=', req.user.id)
    .select([
      'organization.id',
      'organization.name',
      'organization.slug',
      'organization.logo',
    ])
    .orderBy('organization.name', 'asc')
    .execute()

  const orgIds = organizations.map((o) => o.id)
  const connectedWorkspaces =
    orgIds.length > 0
      ? await db
          .selectFrom('slack_workspace')
          .select(['organizationId'])
          .where('organizationId', 'in', orgIds)
          .where('isActive', '=', true)
          .where('isPending', '=', false)
          .execute()
      : []

  const connectedOrgIds = new Set(
    connectedWorkspaces.map((w) => w.organizationId).filter(Boolean),
  )

  const workspace = await workspaceRepo.findById(linkToken.workspaceId)

  return res.json({
    organizations: organizations.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      logo: org.logo,
      hasSlackConnected: connectedOrgIds.has(org.id),
    })),
    workspace: workspace
      ? {
          id: workspace.id,
          teamName: workspace.teamName,
        }
      : null,
  })
}
*/

/*
const completeLinking: AuthRequestHandler<{
  token: string
  organizationId: string
}> = async (req, res) => {
  const { token, organizationId } = req.body

  if (!token || !organizationId) {
    return res.status(400).json({ error: 'Token and organizationId required' })
  }

  const tokenData = await slackService.validateAndConsumeLinkToken(token)
  if (!tokenData) {
    return res.status(404).json({ error: 'Invalid or expired token' })
  }

  const membership = await db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', req.user.id)
    .select('id')
    .executeTakeFirst()

  if (!membership) {
    return res
      .status(403)
      .json({ error: 'You are not a member of this organization' })
  }

  const existingWorkspace =
    await workspaceRepo.findActiveByOrganizationId(organizationId)
  if (existingWorkspace) {
    return res.status(409).json({
      error: 'This organization already has a Slack workspace connected',
      existingWorkspace: {
        teamName: existingWorkspace.teamName,
      },
    })
  }

  try {
    await slackService.linkWorkspaceToOrganization(
      tokenData.workspaceId,
      organizationId,
      req.user.id,
    )

    const workspace = await workspaceRepo.findById(tokenData.workspaceId)

    logger.info(
      {
        workspaceId: tokenData.workspaceId,
        organizationId,
        userId: req.user.id,
      },
      'Slack workspace linked to organization via App Directory flow',
    )

    return res.json({
      success: true,
      workspace: workspace
        ? {
            id: workspace.id,
            teamId: workspace.teamId,
            teamName: workspace.teamName,
          }
        : null,
    })
  } catch (error) {
    logger.error({ error, token, organizationId }, 'Failed to link workspace')
    return res.status(500).json({ error: 'Failed to link workspace' })
  }
}
*/

// Routes
router.get('/status', withBetterAuth, authenticatedRoute(getStatus))
router.get(
  '/install-url',
  withBetterAuth,
  authenticatedRoute(getInstallUrlRoute),
)
router.post('/disconnect', withBetterAuth, authenticatedRoute(disconnect))
router.get('/channels', withBetterAuth, authenticatedRoute(getChannels))
router.put(
  '/notification-rules',
  withBetterAuth,
  authenticatedRoute(updateNotificationRules),
)
router.post('/link-user', withBetterAuth, authenticatedRoute(linkUser))
router.post('/auto-link', withBetterAuth, authenticatedRoute(autoLinkUsers))
router.post(
  '/test-notification',
  withBetterAuth,
  authenticatedRoute(testNotification),
)

// App Directory flow link endpoints - TODO: Re-enable when complete
// router.get('/link/validate', validateLinkToken)
// router.get(
//   '/link/organizations',
//   withBetterAuth,
//   authenticatedRoute(getLinkOrganizations),
// )
// router.post(
//   '/link/complete',
//   withBetterAuth,
//   authenticatedRoute(completeLinking),
// )

export default router

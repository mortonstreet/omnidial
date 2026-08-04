import { Router, Request, Response, NextFunction } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import * as slackController from '@/api/controllers/slack.controller'
import logger from '@/lib/logger'

const router = Router()

// Startup validation - check required env vars
const REQUIRED_SLACK_VARS = [
  'SLACK_CLIENT_ID',
  'SLACK_CLIENT_SECRET',
  'SLACK_SIGNING_SECRET',
]
const missingSlackVars = REQUIRED_SLACK_VARS.filter((v) => !process.env[v])
if (missingSlackVars.length > 0) {
  logger.warn(
    { missing: missingSlackVars },
    'Slack integration disabled - missing required environment variables',
  )
}

/**
 * Verify Slack request signature
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
const verifySlackSignature = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const signingSecret = process.env.SLACK_SIGNING_SECRET

  if (!signingSecret) {
    logger.error('SLACK_SIGNING_SECRET not configured')
    return res.status(500).json({ error: 'Slack not configured' })
  }

  const signature = req.headers['x-slack-signature'] as string
  const timestamp = req.headers['x-slack-request-timestamp'] as string

  if (!signature || !timestamp) {
    return res.status(400).json({ error: 'Missing Slack headers' })
  }

  // Check timestamp to prevent replay attacks (5 minute window)
  const time = Math.floor(Date.now() / 1000)
  if (Math.abs(time - parseInt(timestamp, 10)) > 300) {
    return res.status(400).json({ error: 'Request too old' })
  }

  // Get raw body - Express should have stored this
  const rawBody =
    (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body)

  const sigBasestring = `v0:${timestamp}:${rawBody}`
  const mySignature =
    'v0=' +
    createHmac('sha256', signingSecret).update(sigBasestring).digest('hex')

  try {
    if (!timingSafeEqual(Buffer.from(mySignature), Buffer.from(signature))) {
      logger.warn('Invalid Slack signature')
      return res.status(400).json({ error: 'Invalid signature' })
    }
  } catch (error) {
    logger.error({ error }, 'Signature verification failed')
    return res.status(400).json({ error: 'Invalid signature' })
  }

  next()
}

/**
 * OAuth callback - no signature verification needed
 * GET /webhooks/slack/oauth/callback
 */
router.get('/oauth/callback', slackController.handleOAuthCallback)

/**
 * Events API endpoint
 * POST /webhooks/slack/events
 */
router.post('/events', verifySlackSignature, slackController.handleEvent)

/**
 * Slash commands endpoint
 * POST /webhooks/slack/commands
 */
router.post('/commands', verifySlackSignature, slackController.handleCommand)

/**
 * Interactive components (buttons, modals, shortcuts)
 * POST /webhooks/slack/interactions
 */
router.post(
  '/interactions',
  verifySlackSignature,
  slackController.handleInteraction,
)

export default router

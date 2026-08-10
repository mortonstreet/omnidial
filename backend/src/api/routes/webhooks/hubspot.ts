import { Router, Request } from 'express'
import { createHash } from 'crypto'
import * as crmService from '@/services/crm.service'
import * as webhookEventReceiptRepository from '@/repositories/webhookEventReceipt.repository'
import logger from '@/lib/logger'

const router = Router()
const WEBHOOK_PROVIDER = 'hubspot'

type HubSpotWebhookClaim = {
  eventKey: string
  duplicate: boolean
}

const getRawBodyString = (req: Request): string | null => {
  const rawBody = (req as Request & { rawBody?: string | Buffer }).rawBody
  if (typeof rawBody === 'string') return rawBody
  if (Buffer.isBuffer(rawBody)) return rawBody.toString('utf8')
  return null
}

const buildHubSpotEventKey = (
  event: crmService.HubSpotWebhookEvent,
): string | null => {
  if (event.eventId !== undefined && event.eventId !== null) {
    return String(event.eventId)
  }

  const parts = [
    event.subscriptionType,
    event.objectId,
    event.propertyName,
    event.propertyValue,
  ]
    .filter((part) => part !== undefined && part !== null && part !== '')
    .map((part) => encodeURIComponent(String(part)))

  return parts.length > 0 ? parts.join(':') : null
}

const claimHubSpotWebhookEvent = async (
  req: Request,
  event: crmService.HubSpotWebhookEvent,
): Promise<HubSpotWebhookClaim | null> => {
  const eventKey = buildHubSpotEventKey(event)
  if (!eventKey) return null

  const rawBody = getRawBodyString(req)
  const payloadHash = rawBody
    ? createHash('sha256').update(rawBody).digest('hex')
    : undefined

  try {
    const claim = await webhookEventReceiptRepository.claimForProcessing({
      provider: WEBHOOK_PROVIDER,
      eventId: eventKey,
      eventType: event.subscriptionType,
      hash: payloadHash,
    })

    if (
      claim.status === 'duplicate_processed' ||
      claim.status === 'duplicate_processing'
    ) {
      return { eventKey, duplicate: true }
    }

    return { eventKey, duplicate: false }
  } catch (error) {
    logger.error({ error, eventKey }, 'Failed to claim HubSpot webhook event')
    return null
  }
}

router.post('/', async (req, res) => {
  const payload = Array.isArray(req.body) ? req.body : [req.body]
  const events = payload as crmService.HubSpotWebhookEvent[]
  const claims: HubSpotWebhookClaim[] = []
  const processableEvents: crmService.HubSpotWebhookEvent[] = []

  for (const event of events) {
    const claim = await claimHubSpotWebhookEvent(req, event)
    if (claim) claims.push(claim)
    if (!claim?.duplicate) {
      processableEvents.push(event)
    }
  }

  try {
    const result =
      await crmService.handleHubSpotWebhookEvents(processableEvents)

    await Promise.all(
      claims
        .filter((claim) => !claim.duplicate)
        .map((claim) =>
          webhookEventReceiptRepository.markProcessed(
            WEBHOOK_PROVIDER,
            claim.eventKey,
          ),
        ),
    )

    res.json({
      data: {
        ...result,
        duplicates: events.length - processableEvents.length,
      },
    })
  } catch (error) {
    await Promise.all(
      claims
        .filter((claim) => !claim.duplicate)
        .map((claim) =>
          webhookEventReceiptRepository.markFailed(
            WEBHOOK_PROVIDER,
            claim.eventKey,
          ),
        ),
    )

    logger.error({ error }, 'HubSpot webhook handling failed')
    res.status(500).json({ error: 'HubSpot webhook handling failed' })
  }
})

export default router

import { Router, Request, Response } from 'express'
import { stripeClient } from '@/lib/stripe'
import { config } from '@/config'
import logger from '@/lib/logger'
import { db } from '@/lib/db'
import { createHash } from 'crypto'
import * as webhookEventReceiptRepository from '@/repositories/webhookEventReceipt.repository'
import type Stripe from 'stripe'

const router = Router()
const WEBHOOK_PROVIDER = 'stripe'

/**
 * Stripe webhook handler.
 * Verifies signature using the raw body, then dispatches to event-specific handlers.
 */
router.post('/', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody

  if (!sig || !rawBody) {
    logger.warn('Missing stripe-signature header or raw body')
    return res.status(400).send('Missing signature')
  }

  let event: Stripe.Event

  try {
    event = stripeClient.webhooks.constructEvent(
      rawBody,
      sig,
      config.stripe.webhookSecret,
    )
  } catch (err) {
    logger.error({ err }, 'Stripe webhook signature verification failed')
    return res.status(400).send('Invalid signature')
  }

  logger.info({ type: event.type, id: event.id }, 'Stripe webhook received')
  const payloadHash = createHash('sha256').update(rawBody).digest('hex')

  try {
    const claim = await webhookEventReceiptRepository.claimForProcessing({
      provider: WEBHOOK_PROVIDER,
      eventId: event.id,
      eventType: event.type,
      hash: payloadHash,
    })

    if (
      claim.status === 'duplicate_processed' ||
      claim.status === 'duplicate_processing'
    ) {
      if (claim.hashMismatch) {
        logger.warn(
          { id: event.id, type: event.type },
          'Stripe webhook replay had mismatched payload hash',
        )
      }

      logger.info(
        { id: event.id, type: event.type, replayStatus: claim.status },
        'Stripe webhook replay skipped (idempotent no-op)',
      )
      return res.status(200).json({ received: true, duplicate: true })
    }

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription,
        )
        break

      case 'customer.subscription.paused':
        await handleSubscriptionPaused(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.resumed':
        await handleSubscriptionResumed(
          event.data.object as Stripe.Subscription,
        )
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event type')
    }

    await webhookEventReceiptRepository.markProcessed(
      WEBHOOK_PROVIDER,
      event.id,
    )
    return res.status(200).json({ received: true, replay: claim.isReplay })
  } catch (err) {
    await webhookEventReceiptRepository
      .markFailed(WEBHOOK_PROVIDER, event.id)
      .catch((markErr) => {
        logger.error(
          { err: markErr, id: event.id, type: event.type },
          'Failed to mark Stripe webhook receipt as failed',
        )
      })

    logger.error({ err, type: event.type }, 'Error processing Stripe webhook')
    return res.status(500).send('Webhook handler error')
  }
})

// ─── Event Handlers ──────────────────────────────────────────

async function handleSubscriptionUpdate(sub: Stripe.Subscription) {
  const stripeSubId = sub.id
  const stripeCustomerId =
    typeof sub.customer === 'string' ? sub.customer : sub.customer.id

  const existing = await db
    .selectFrom('subscription')
    .where('stripeSubscriptionId', '=', stripeSubId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) {
    logger.warn({ stripeSubId }, 'No local subscription found for Stripe sub')
    return
  }

  await db
    .updateTable('subscription')
    .set({
      status: sub.status,
      stripeCustomerId,
      periodStart: sub.billing_cycle_anchor
        ? new Date(sub.billing_cycle_anchor * 1000)
        : undefined,
      trialStart: sub.trial_start
        ? new Date(sub.trial_start * 1000)
        : undefined,
      trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      accountStatus:
        sub.status === 'active' || sub.status === 'trialing'
          ? 'active'
          : existing.accountStatus,
    })
    .where('id', '=', existing.id)
    .execute()

  logger.info(
    { subId: existing.id, status: sub.status },
    'Subscription updated from Stripe webhook',
  )
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription) {
  const existing = await db
    .selectFrom('subscription')
    .where('stripeSubscriptionId', '=', sub.id)
    .selectAll()
    .executeTakeFirst()

  if (!existing) return

  await db
    .updateTable('subscription')
    .set({
      status: 'canceled',
      accountStatus: 'canceled',
    })
    .where('id', '=', existing.id)
    .execute()

  logger.info({ subId: existing.id }, 'Subscription canceled from Stripe')
}

async function handleSubscriptionPaused(sub: Stripe.Subscription) {
  const existing = await db
    .selectFrom('subscription')
    .where('stripeSubscriptionId', '=', sub.id)
    .selectAll()
    .executeTakeFirst()

  if (!existing) return

  await db
    .updateTable('subscription')
    .set({
      status: 'paused',
      accountStatus: 'suspended',
    })
    .where('id', '=', existing.id)
    .execute()

  logger.info({ subId: existing.id }, 'Subscription paused from Stripe')
}

async function handleSubscriptionResumed(sub: Stripe.Subscription) {
  const existing = await db
    .selectFrom('subscription')
    .where('stripeSubscriptionId', '=', sub.id)
    .selectAll()
    .executeTakeFirst()

  if (!existing) return

  await db
    .updateTable('subscription')
    .set({
      status: sub.status,
      accountStatus: 'active',
    })
    .where('id', '=', existing.id)
    .execute()

  logger.info({ subId: existing.id }, 'Subscription resumed from Stripe')
}

async function handleTrialWillEnd(sub: Stripe.Subscription) {
  logger.info(
    { stripeSubId: sub.id, trialEnd: sub.trial_end },
    'Trial ending in 3 days',
  )
  // TODO: Send email notification to org about trial ending
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subId = typeof subRef === 'string' ? subRef : subRef?.id

  if (!subId) return

  const existing = await db
    .selectFrom('subscription')
    .where('stripeSubscriptionId', '=', subId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) return

  // Reset overage cap hit on successful payment
  await db
    .updateTable('subscription')
    .set({
      accountStatus: 'active',
      overageCapHit: false,
    })
    .where('id', '=', existing.id)
    .execute()

  logger.info(
    { subId: existing.id, invoiceId: invoice.id },
    'Invoice paid — account active',
  )
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subRef = invoice.parent?.subscription_details?.subscription
  const subId = typeof subRef === 'string' ? subRef : subRef?.id

  if (!subId) return

  const existing = await db
    .selectFrom('subscription')
    .where('stripeSubscriptionId', '=', subId)
    .selectAll()
    .executeTakeFirst()

  if (!existing) return

  await db
    .updateTable('subscription')
    .set({
      accountStatus: 'grace_period',
    })
    .where('id', '=', existing.id)
    .execute()

  logger.info(
    { subId: existing.id, invoiceId: invoice.id },
    'Invoice payment failed — account in grace period',
  )
}

export default router

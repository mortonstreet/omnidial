import { extractSubscriptionIdFromInvoice } from '@/utils/better-auth'
import { getSubscriptionFromStripeSubscriptionId } from '@/repositories/subscription.repository'
import { stripeClient } from '@/lib/stripe'
import { getOveragePriceId } from '@shared/types/src/stripe'
import logger from '@/lib/logger'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Retry fetching the subscription from the DB with exponential backoff.
 * Better Auth may not have persisted the subscription record yet when
 * the Stripe webhook `onEvent` callback fires, so we retry a few times.
 */
async function waitForSubscription(
  stripeSubscriptionId: string,
  maxRetries = 5,
) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const subscription =
      await getSubscriptionFromStripeSubscriptionId(stripeSubscriptionId)
    if (subscription) return subscription

    const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
    logger.info('Subscription not yet persisted, retrying...', {
      stripeSubscriptionId,
      attempt: attempt + 1,
      maxRetries,
      nextDelayMs: delay,
    })
    await sleep(delay)
  }
  return null
}

export const handleInvoicePaid = async (invoice: any) => {
  const subscriptionId = extractSubscriptionIdFromInvoice(invoice)
  if (!subscriptionId) {
    throw new Error('Subscription ID not found in invoice')
  }
  const subscription =
    await getSubscriptionFromStripeSubscriptionId(subscriptionId)
  if (!subscription) {
    throw new Error('Subscription not found')
  }

  logger.info('Invoice paid for subscription', {
    subscriptionId: subscription.id,
    referenceId: subscription.referenceId,
    plan: subscription.plan,
    invoiceId: invoice.id,
  })
}

export const handleSubscriptionCreated = async (event: any) => {
  const stripeSubscriptionId = event.data?.object?.id
  if (!stripeSubscriptionId) {
    logger.warn('No subscription ID in subscription.created event')
    return
  }

  // Better Auth may not have persisted the subscription yet, retry with backoff
  const subscription = await waitForSubscription(stripeSubscriptionId)
  if (!subscription) {
    logger.error('Subscription not found after retries for auto-provisioning', {
      stripeSubscriptionId,
    })
    return
  }

  const orgId = subscription.referenceId
  if (!orgId) {
    logger.warn('No referenceId (orgId) on subscription', {
      subscriptionId: subscription.id,
    })
    return
  }

  // Add metered overage price as a second line item on the Stripe subscription
  const overagePriceId = getOveragePriceId(subscription.plan)
  if (overagePriceId) {
    try {
      await stripeClient.subscriptionItems.create({
        subscription: stripeSubscriptionId,
        price: overagePriceId,
      })
      logger.info('Added metered overage line item to subscription', {
        orgId,
        stripeSubscriptionId,
        overagePriceId,
        plan: subscription.plan,
      })
    } catch (err) {
      logger.error('Failed to add metered overage line item', {
        orgId,
        stripeSubscriptionId,
        overagePriceId,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  } else {
    logger.warn('No overage price ID found for plan', {
      plan: subscription.plan,
    })
  }
}

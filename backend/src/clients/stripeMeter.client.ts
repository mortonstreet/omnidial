import { stripeClient } from '@/lib/stripe'
import logger from '@/lib/logger'

/**
 * Report overage minutes to Stripe Meters for usage-based billing.
 */
export const reportOverageToStripe = async (
  stripeCustomerId: string,
  meterEventName: string,
  overageMinutes: number,
): Promise<boolean> => {
  try {
    await stripeClient.billing.meterEvents.create({
      event_name: meterEventName,
      payload: {
        stripe_customer_id: stripeCustomerId,
        value: overageMinutes.toString(),
      },
    })

    logger.info(
      { stripeCustomerId, meterEventName, overageMinutes },
      'Reported overage to Stripe Meter',
    )

    return true
  } catch (err) {
    logger.error(
      { err, stripeCustomerId, meterEventName, overageMinutes },
      'Failed to report overage to Stripe Meter',
    )
    return false
  }
}

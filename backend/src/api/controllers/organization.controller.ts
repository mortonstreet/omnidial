import { AuthRequestHandler } from '@/types/handlers'
import {
  GetCreditBalanceRequest,
  UpdateOrganizationRequest,
} from '@shared/types/src'
import {
  getOrganizationCreditBalance as getOrganizationCreditBalanceRepository,
  getSubscriptionByReferenceId,
} from '@/repositories/subscription.repository'
import { getTierFromPlanName } from '@shared/types/src/stripe'
import { updateOrganizationName } from '@/services/organization.service'

export const getOrganizationCreditBalanceController: AuthRequestHandler<
  GetCreditBalanceRequest
> = async (req, res) => {
  const balance = await getOrganizationCreditBalanceRepository(
    req.validated.organizationId,
  )
  return res.json({ balance })
}

// Get subscription info for an organization
export const getOrganizationSubscriptionController: AuthRequestHandler<
  GetCreditBalanceRequest
> = async (req, res) => {
  const { organizationId } = req.validated
  const subscription = await getSubscriptionByReferenceId(organizationId)

  if (!subscription) {
    return res.json({ subscription: null, tier: null, isTrialing: false })
  }

  const tier = getTierFromPlanName(subscription.plan)
  const isTrialing = subscription.status === 'trialing'

  return res.json({
    subscription,
    tier,
    isTrialing,
  })
}

export const updateOrganizationController: AuthRequestHandler<
  UpdateOrganizationRequest
> = async (req, res) => {
  const { organizationId, name } = req.validated

  try {
    const organization = await updateOrganizationName(organizationId, name)
    return res.json(organization)
  } catch (error) {
    return res.status(404).json({ error: 'Organization not found' })
  }
}

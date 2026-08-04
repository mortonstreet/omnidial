import { Request, Response, NextFunction } from 'express'
import { getSubscriptionByReferenceId } from '@/repositories/subscription.repository'
import {
  AppFeature,
  planHasFeature,
  getTierFromPlanName,
} from '@shared/types/src/stripe'
import { DBUser } from '@shared/types/src'
import * as organizationRepo from '@/repositories/organization.repository'
import logger from '@/lib/logger'

export const requireActiveSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const organizationId = req.organizationId
  if (!organizationId) {
    return res
      .status(400)
      .json({ error: 'No active organization', code: 'NO_ACTIVE_ORGANIZATION' })
  }

  // Superadmins bypass subscription checks
  if ((req.user as DBUser)?.role === 'superadmin') {
    return next()
  }

  // Superadmin-managed orgs bypass subscription checks for all users
  try {
    const org = await organizationRepo.findById(organizationId)
    if (org.managedBySuperadmin) {
      return next()
    }
  } catch {
    // org not found — fall through to normal subscription check
  }

  const subscription = await getSubscriptionByReferenceId(organizationId)
  if (
    !subscription ||
    (subscription.status !== 'active' && subscription.status !== 'trialing')
  ) {
    return res.status(403).json({
      error: 'An active subscription is required',
      code: 'NO_ACTIVE_SUBSCRIPTION',
    })
  }

  next()
}

export const requireFeature =
  (feature: AppFeature) =>
  async (req: Request, res: Response, next: NextFunction) => {
    const organizationId = req.organizationId
    if (!organizationId) {
      return res.status(400).json({
        error: 'No active organization',
        code: 'NO_ACTIVE_ORGANIZATION',
      })
    }

    try {
      // Superadmins bypass all feature gates
      if ((req.user as DBUser)?.role === 'superadmin') {
        return next()
      }

      const subscription = await getSubscriptionByReferenceId(organizationId)
      if (
        !subscription ||
        (subscription.status !== 'active' && subscription.status !== 'trialing')
      ) {
        return res.status(403).json({
          error: 'An active subscription is required',
          code: 'NO_ACTIVE_SUBSCRIPTION',
        })
      }

      // During trial, grant Pro-level access
      if (subscription.status === 'trialing') {
        return next()
      }

      const tier = getTierFromPlanName(subscription.plan)
      if (!planHasFeature(tier, feature)) {
        return res.status(403).json({
          error: `This feature requires a plan upgrade`,
          code: 'PLAN_UPGRADE_REQUIRED',
          requiredFeature: feature,
          currentTier: tier,
        })
      }

      next()
    } catch (error) {
      logger.error('Feature gate check failed:', error)
      return res.status(500).json({ error: 'Failed to verify feature access' })
    }
  }

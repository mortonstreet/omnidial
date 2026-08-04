import { Express, Request, Response, NextFunction } from 'express'
import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import { config } from '@/config'
import logger from '@/lib/logger'
import { findById } from '@/repositories/user.repository'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '@/lib/better-auth'
import { AuthRequest } from '@/types/handlers'
import {
  doesMemberHaveRole,
  isMemberOfOrganization,
} from '@/services/organization.service'
import { OrganizationRole } from '@shared/types/src/organization'
import { DBUser } from '@shared/types/src'

export const withAuth = passport.authenticate('jwt', { session: false })

export function initializeAuth(app: Express) {
  app.use(passport.initialize())

  passport.use(
    new JwtStrategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: config.jwt.secret,
      },
      async (payload, done) => {
        try {
          const user = await findById(payload.id)
          if (!user) {
            return done(null, false)
          }
          return done(null, user)
        } catch (error) {
          return done(error, false)
        }
      },
    ),
  )

  return passport
}

export const withApiKeyAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const apiKey = req.headers.authorization
  if (!apiKey || apiKey !== config.webhookApiKey) {
    logger.error('Unauthorized request')
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

export const withBetterAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // attach to req so handlers can use it
    ;(req as any).user = session.user
    ;(req as any).session = session

    next()
  } catch (error) {
    logger.error('Failed to get session:', error)
    return res.status(401).json({ error: 'Unauthorized' })
  }
}

export const validateMemberOfOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as DBUser | undefined
    if (!user?.id) {
      logger.error(
        'validateMemberOfOrganization: req.user is missing or has no id',
      )
      return res.status(401).json({ error: 'Unauthorized' })
    }
    const organizationId = req.validated?.organizationId as string | undefined
    if (!organizationId) {
      logger.error(
        'validateMemberOfOrganization: organizationId missing from validated request',
      )
      return res.status(400).json({ error: 'Organization ID is required' })
    }
    const isMember = await isMemberOfOrganization(user.id, organizationId)
    if (!isMember) {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    next()
  } catch (error) {
    logger.error('Failed to validate organization membership:', error)
    return res
      .status(500)
      .json({ error: 'Failed to validate organization membership' })
  }
}

/**
 * Authoritative organization guard for session-backed extension routes.
 * Uses activeOrganizationId from session and injects it into req.validated.
 */
export const validateActiveOrganization = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const user = req.user as DBUser | undefined
    if (!user?.id) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const organizationId =
      (req as any).session?.session?.activeOrganizationId ?? null
    if (!organizationId) {
      return res.status(400).json({ error: 'No active organization selected' })
    }

    const isMember = await isMemberOfOrganization(user.id, organizationId)
    if (!isMember) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    ;(req as any).validated = {
      ...((req as any).validated ?? {}),
      organizationId,
    }
    next()
  } catch (error) {
    logger.error('Failed to validate active organization membership:', error)
    return res
      .status(500)
      .json({ error: 'Failed to validate organization membership' })
  }
}

export const requireSuperAdmin = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const user = req.user as DBUser | undefined
  if (!user || user.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' })
  }
  next()
}

export const validateMemberOfOrganizationIs =
  (roles: OrganizationRole[]) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as DBUser | undefined
      if (!user?.id) {
        logger.error(
          'validateMemberOfOrganizationIs: req.user is missing or has no id',
        )
        return res.status(401).json({ error: 'Unauthorized' })
      }
      const organizationId = req.validated?.organizationId as string | undefined
      if (!organizationId) {
        logger.error(
          'validateMemberOfOrganizationIs: organizationId missing from validated request',
        )
        return res.status(400).json({ error: 'Organization ID is required' })
      }
      const hasRole = await doesMemberHaveRole(user.id, organizationId, roles)
      if (!hasRole) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      next()
    } catch (error) {
      logger.error('Failed to validate organization role:', error)
      return res
        .status(500)
        .json({ error: 'Failed to validate organization role' })
    }
  }

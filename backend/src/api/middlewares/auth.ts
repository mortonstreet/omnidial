import { Express, Request, Response, NextFunction } from 'express'
import passport from 'passport'
import { Strategy as JwtStrategy, ExtractJwt } from 'passport-jwt'
import { createClerkClient, verifyToken } from '@clerk/backend'
import { randomUUID } from 'crypto'
import { config } from '@/config'
import { db } from '@/lib/db'
import logger from '@/lib/logger'
import { findById } from '@/repositories/user.repository'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '@/lib/better-auth'
import { AuthRequest } from '@/types/handlers'
import {
  resolveActiveOrganizationForUser,
  updateUserLastActiveOrganizationId,
} from '@/repositories/auth.repository'
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

const getBearerToken = (req: Request) => {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) {
    return null
  }
  const token = authorization.slice('Bearer '.length).trim()
  return token.length > 0 ? token : null
}

const clerkClient = config.clerk.secretKey
  ? createClerkClient({ secretKey: config.clerk.secretKey })
  : null

const getPrimaryClerkEmail = (clerkUser: any) => {
  const primaryEmailId = clerkUser.primaryEmailAddressId
  const primaryEmail = clerkUser.emailAddresses?.find(
    (email: any) => email.id === primaryEmailId,
  )
  return (
    primaryEmail?.emailAddress ??
    clerkUser.emailAddresses?.[0]?.emailAddress ??
    null
  )
}

const getClerkDisplayName = (clerkUser: any) => {
  const firstName = clerkUser.firstName ?? clerkUser.first_name
  const lastName = clerkUser.lastName ?? clerkUser.last_name
  return [firstName, lastName].filter(Boolean).join(' ') || null
}

const ensureLocalUserForClerkUser = async (clerkUserId: string) => {
  let user = await db
    .selectFrom('user')
    .where('clerkUserId', '=', clerkUserId)
    .selectAll()
    .executeTakeFirst()

  if (user || !clerkClient) {
    return user ?? null
  }

  const clerkUser = await clerkClient.users.getUser(clerkUserId)
  const email = getPrimaryClerkEmail(clerkUser)?.toLowerCase()
  if (!email) {
    logger.warn({ clerkUserId }, 'Clerk user has no primary email')
    return null
  }

  user = await db
    .selectFrom('user')
    .where('email', '=', email)
    .selectAll()
    .executeTakeFirst()

  if (user) {
    await db
      .updateTable('user')
      .set({
        clerkUserId,
        emailVerified:
          clerkUser.emailAddresses?.some(
            (address: any) =>
              address.emailAddress?.toLowerCase() === email &&
              address.verification?.status === 'verified',
          ) ?? user.emailVerified,
        name: getClerkDisplayName(clerkUser) ?? user.name,
        image: clerkUser.imageUrl ?? user.image,
        updatedAt: new Date(),
      })
      .where('id', '=', user.id)
      .executeTakeFirst()

    return await db
      .selectFrom('user')
      .where('id', '=', user.id)
      .selectAll()
      .executeTakeFirst()
  }

  const created = await db
    .insertInto('user')
    .values({
      id: randomUUID(),
      clerkUserId,
      email,
      emailVerified:
        clerkUser.emailAddresses?.some(
          (address: any) =>
            address.emailAddress?.toLowerCase() === email &&
            address.verification?.status === 'verified',
        ) ?? false,
      name: getClerkDisplayName(clerkUser),
      image: clerkUser.imageUrl ?? null,
      role: 'user',
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returningAll()
    .executeTakeFirst()

  return created ?? null
}

const attachClerkSession = async (req: Request, token: string) => {
  if (!config.clerk.secretKey) {
    return false
  }

  const payload = await verifyToken(token, {
    secretKey: config.clerk.secretKey,
  })
  const clerkUserId = payload.sub
  if (!clerkUserId) {
    return false
  }

  const user = await ensureLocalUserForClerkUser(clerkUserId)
  if (!user) {
    logger.warn({ clerkUserId }, 'Clerk user is not mapped to a local user')
    return false
  }

  const resolved = await resolveActiveOrganizationForUser(user.id)
  if (
    resolved.recovered ||
    resolved.hadInvalidLastActiveOrganization ||
    (!user.lastActiveOrganizationId && resolved.activeOrganizationId)
  ) {
    await updateUserLastActiveOrganizationId(
      user.id,
      resolved.activeOrganizationId,
    )
  }

  const sessionId =
    ((payload as any).sid as string | undefined) ??
    ((payload as any).session_id as string | undefined) ??
    `clerk:${clerkUserId}`

  ;(req as any).user = user
  ;(req as any).session = {
    id: sessionId,
    userId: user.id,
    activeOrganizationId: resolved.activeOrganizationId,
    clerkUserId,
    claims: payload,
    session: {
      id: sessionId,
      activeOrganizationId: resolved.activeOrganizationId,
      clerkUserId,
      claims: payload,
    },
  }
  ;(req as any).authProvider = 'clerk'
  return true
}

export const withBetterAuth = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bearerToken = getBearerToken(req)
    if (bearerToken) {
      const isAuthenticatedWithClerk = await attachClerkSession(
        req,
        bearerToken,
      )
      if (isAuthenticatedWithClerk) {
        return next()
      }
    }

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

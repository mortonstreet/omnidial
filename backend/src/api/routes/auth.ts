import { fromNodeHeaders, toNodeHandler } from 'better-auth/node'
import { auth } from '@/lib/better-auth'
import { Router } from 'express'
import logger from '@/lib/logger'
import { randomUUID } from 'crypto'
import { createClerkClient } from '@clerk/backend'
import { config } from '@/config'
import { db } from '@/lib/db'
import { withBetterAuth } from '@/api/middlewares/auth'
import { updateUserLastActiveOrganizationId } from '@/repositories/auth.repository'
import {
  authCallbackGuard,
  magicLinkAbuseProtection,
  magicLinkVerifyHardening,
} from '@/api/middlewares/authHardening'

const router = Router()
const authHandler = toNodeHandler(auth)
const clerkClient = config.clerk.secretKey
  ? createClerkClient({ secretKey: config.clerk.secretKey })
  : null

const mapToClerkRole = (role?: string | null) =>
  role === 'member' ? 'org:member' : 'org:admin'

const isSuperadmin = (req: any) => req.user?.role === 'superadmin'

const ensureCanManageOrganization = async (
  req: any,
  organizationId: string,
) => {
  if (isSuperadmin(req)) return true

  const member = await db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', req.user.id)
    .select(['role'])
    .executeTakeFirst()

  return member?.role === 'owner' || member?.role === 'admin'
}

const ensureCanAccessOrganization = async (
  req: any,
  organizationId: string,
) => {
  if (isSuperadmin(req)) return true

  const member = await db
    .selectFrom('member')
    .where('organizationId', '=', organizationId)
    .where('userId', '=', req.user.id)
    .select(['id'])
    .executeTakeFirst()

  return Boolean(member)
}

const getOrganizationsForUser = async (req: any) => {
  const query = isSuperadmin(req)
    ? db
        .selectFrom('organization')
        .select([
          'organization.id',
          'organization.clerkOrganizationId',
          'organization.name',
          'organization.slug',
          'organization.logo',
          'organization.createdAt',
        ])
        .orderBy('organization.name', 'asc')
    : db
        .selectFrom('member')
        .innerJoin('organization', 'organization.id', 'member.organizationId')
        .where('member.userId', '=', req.user.id)
        .select([
          'organization.id',
          'organization.clerkOrganizationId',
          'organization.name',
          'organization.slug',
          'organization.logo',
          'organization.createdAt',
          'member.role',
        ])
        .orderBy('organization.name', 'asc')

  return await query.execute()
}

const getActiveOrganization = async (req: any) => {
  const activeOrganizationId =
    req.session?.session?.activeOrganizationId ??
    req.session?.activeOrganizationId ??
    null

  if (!activeOrganizationId) return null

  return await db
    .selectFrom('organization')
    .where('id', '=', activeOrganizationId)
    .select(['id', 'clerkOrganizationId', 'name', 'slug', 'logo', 'createdAt'])
    .executeTakeFirst()
}

const getSessionPayload = async (req: any) => {
  const [organizations, activeOrganization] = await Promise.all([
    getOrganizationsForUser(req),
    getActiveOrganization(req),
  ])

  return {
    data: {
      user: req.user,
      session: req.session?.session ?? req.session,
      activeOrganization,
      organizations,
    },
  }
}

const serializeOrganization = (organization: any) => ({
  ...organization,
  createdAt:
    organization?.createdAt instanceof Date
      ? organization.createdAt.toISOString()
      : organization?.createdAt,
})

// Ensure every auth request has a correlation ID from the start
router.use((req, res, next) => {
  if (!res.getHeader('x-request-id')) {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' &&
      req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id']
        : randomUUID()
    res.setHeader('x-request-id', requestId)
  }
  next()
})

router.use(authCallbackGuard)
router.use(magicLinkAbuseProtection)
router.use(magicLinkVerifyHardening)

router.get('/clerk/session', withBetterAuth, async (req: any, res) => {
  return res.json(await getSessionPayload(req))
})

router.get('/organization/list', withBetterAuth, async (req: any, res) => {
  const organizations = await getOrganizationsForUser(req)
  return res.json({
    data: organizations.map(serializeOrganization),
  })
})

router.get(
  '/organization/check-slug',
  withBetterAuth,
  async (req: any, res) => {
    const slug = String(req.query.slug ?? '')
      .trim()
      .toLowerCase()
    if (!slug) {
      return res.status(400).json({ error: 'Slug is required' })
    }

    const existingLocal = await db
      .selectFrom('organization')
      .where('slug', '=', slug)
      .select('id')
      .executeTakeFirst()

    let existingClerk = false
    if (clerkClient) {
      try {
        await clerkClient.organizations.getOrganization({ slug })
        existingClerk = true
      } catch {
        existingClerk = false
      }
    }

    return res.json({ data: { status: !existingLocal && !existingClerk } })
  },
)

router.post('/organization/create', withBetterAuth, async (req: any, res) => {
  const name = String(req.body?.name ?? '').trim()
  const slug = String(req.body?.slug ?? '')
    .trim()
    .toLowerCase()

  if (!name || !slug) {
    return res.status(400).json({ error: 'Name and slug are required' })
  }

  const existing = await db
    .selectFrom('organization')
    .where('slug', '=', slug)
    .select('id')
    .executeTakeFirst()
  if (existing) {
    return res.json({
      error: { message: 'Organization slug is already taken' },
    })
  }

  const now = new Date()
  const organizationId = randomUUID()
  let clerkOrganizationId: string | null = null

  if (clerkClient && req.user.clerkUserId) {
    const clerkOrganization =
      await clerkClient.organizations.createOrganization({
        name,
        slug,
        createdBy: req.user.clerkUserId,
        privateMetadata: {
          omnidialOrganizationId: organizationId,
        },
      })
    clerkOrganizationId = clerkOrganization.id
  }

  const organization = await db
    .insertInto('organization')
    .values({
      id: organizationId,
      clerkOrganizationId,
      name,
      slug,
      createdAt: now,
    })
    .returning([
      'id',
      'clerkOrganizationId',
      'name',
      'slug',
      'logo',
      'createdAt',
    ])
    .executeTakeFirstOrThrow()

  await db
    .insertInto('member')
    .values({
      id: randomUUID(),
      organizationId,
      userId: req.user.id,
      role: 'owner',
      createdAt: now,
    })
    .executeTakeFirst()

  await updateUserLastActiveOrganizationId(req.user.id, organizationId)

  return res.json({ data: serializeOrganization(organization) })
})

router.post(
  '/organization/set-active',
  withBetterAuth,
  async (req: any, res) => {
    const organizationId =
      typeof req.body?.organizationId === 'string'
        ? req.body.organizationId
        : undefined
    const organizationSlug =
      typeof req.body?.organizationSlug === 'string'
        ? req.body.organizationSlug
        : undefined

    const organization = await db
      .selectFrom('organization')
      .where((eb) =>
        organizationId
          ? eb('id', '=', organizationId)
          : eb('slug', '=', organizationSlug ?? ''),
      )
      .select([
        'id',
        'clerkOrganizationId',
        'name',
        'slug',
        'logo',
        'createdAt',
      ])
      .executeTakeFirst()

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    if (!(await ensureCanAccessOrganization(req, organization.id))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    await updateUserLastActiveOrganizationId(req.user.id, organization.id)
    return res.json({ data: serializeOrganization(organization) })
  },
)

router.get('/organization/members', withBetterAuth, async (req: any, res) => {
  const organizationId =
    String(req.query.organizationId ?? '') ||
    req.session?.session?.activeOrganizationId
  if (!organizationId) {
    return res.status(400).json({ error: 'Organization ID is required' })
  }

  if (!(await ensureCanAccessOrganization(req, organizationId))) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const members = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .where('member.organizationId', '=', organizationId)
    .select([
      'member.id',
      'member.userId',
      'member.role',
      'member.createdAt',
      'user.name',
      'user.email',
      'user.image',
    ])
    .orderBy('member.createdAt', 'asc')
    .execute()

  return res.json({
    data: {
      members: members.map((member) => ({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt:
          member.createdAt instanceof Date
            ? member.createdAt.toISOString()
            : member.createdAt,
        user: {
          id: member.userId,
          name: member.name,
          email: member.email ?? '',
          image: member.image ?? null,
        },
      })),
    },
  })
})

router.get(
  '/organization/invitations',
  withBetterAuth,
  async (req: any, res) => {
    const organizationId =
      String(req.query.organizationId ?? '') ||
      req.session?.session?.activeOrganizationId
    if (!organizationId) {
      return res.status(400).json({ error: 'Organization ID is required' })
    }

    if (!(await ensureCanAccessOrganization(req, organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const invitations = await db
      .selectFrom('invitation')
      .where('organizationId', '=', organizationId)
      .select([
        'id',
        'clerkInvitationId',
        'email',
        'role',
        'status',
        'expiresAt',
        'createdAt',
      ])
      .orderBy('createdAt', 'desc')
      .execute()

    return res.json({
      data: invitations.map((invitation) => ({
        ...invitation,
        expiresAt:
          invitation.expiresAt instanceof Date
            ? invitation.expiresAt.toISOString()
            : invitation.expiresAt,
        createdAt:
          invitation.createdAt instanceof Date
            ? invitation.createdAt.toISOString()
            : invitation.createdAt,
      })),
    })
  },
)

router.post(
  '/organization/invite-member',
  withBetterAuth,
  async (req: any, res) => {
    const email = String(req.body?.email ?? '')
      .trim()
      .toLowerCase()
    const role = String(req.body?.role ?? 'member')
    const organizationId =
      String(req.body?.organizationId ?? '') ||
      req.session?.session?.activeOrganizationId
    const resend = Boolean(req.body?.resend)

    if (!email || !organizationId) {
      return res
        .status(400)
        .json({ error: 'Email and organization are required' })
    }
    if (!(await ensureCanManageOrganization(req, organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const organization = await db
      .selectFrom('organization')
      .where('id', '=', organizationId)
      .select(['id', 'clerkOrganizationId', 'name'])
      .executeTakeFirst()
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' })
    }

    const existingInvitation = await db
      .selectFrom('invitation')
      .where('organizationId', '=', organizationId)
      .where('email', '=', email)
      .where('status', '=', 'pending')
      .selectAll()
      .executeTakeFirst()

    if (existingInvitation && !resend) {
      return res.json({
        error: { message: 'This email already has a pending invitation' },
      })
    }

    let clerkInvitationId = existingInvitation?.clerkInvitationId ?? null
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    if (clerkClient && organization.clerkOrganizationId) {
      const invitation =
        await clerkClient.organizations.createOrganizationInvitation({
          organizationId: organization.clerkOrganizationId,
          emailAddress: email,
          role: mapToClerkRole(role),
          inviterUserId: req.user.clerkUserId ?? undefined,
          expiresInDays: 7,
          redirectUrl: `${config.frontendUrl}/dashboard`,
        })
      clerkInvitationId = invitation.id
    }

    const invitation = existingInvitation
      ? await db
          .updateTable('invitation')
          .set({
            clerkInvitationId,
            role,
            status: 'pending',
            expiresAt,
          })
          .where('id', '=', existingInvitation.id)
          .returningAll()
          .executeTakeFirst()
      : await db
          .insertInto('invitation')
          .values({
            id: randomUUID(),
            clerkInvitationId,
            organizationId,
            inviterId: req.user.id,
            email,
            role,
            status: 'pending',
            expiresAt,
            createdAt: new Date(),
          })
          .returningAll()
          .executeTakeFirst()

    return res.json({ data: invitation })
  },
)

router.post(
  '/organization/cancel-invitation',
  withBetterAuth,
  async (req: any, res) => {
    const invitationId = String(req.body?.invitationId ?? '')
    if (!invitationId) {
      return res.status(400).json({ error: 'Invitation ID is required' })
    }

    const invitation = await db
      .selectFrom('invitation')
      .innerJoin('organization', 'organization.id', 'invitation.organizationId')
      .where('invitation.id', '=', invitationId)
      .select([
        'invitation.id',
        'invitation.clerkInvitationId',
        'invitation.organizationId',
        'organization.clerkOrganizationId',
      ])
      .executeTakeFirst()
    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' })
    }
    if (!(await ensureCanManageOrganization(req, invitation.organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    if (
      clerkClient &&
      invitation.clerkOrganizationId &&
      invitation.clerkInvitationId
    ) {
      await clerkClient.organizations.revokeOrganizationInvitation({
        organizationId: invitation.clerkOrganizationId,
        invitationId: invitation.clerkInvitationId,
        requestingUserId: req.user.clerkUserId ?? undefined,
      })
    }

    await db
      .updateTable('invitation')
      .set({ status: 'canceled' })
      .where('id', '=', invitation.id)
      .executeTakeFirst()

    return res.json({ data: { success: true } })
  },
)

router.post(
  '/organization/remove-member',
  withBetterAuth,
  async (req: any, res) => {
    const memberIdOrEmail = String(req.body?.memberIdOrEmail ?? '')
    const organizationId =
      String(req.body?.organizationId ?? '') ||
      req.session?.session?.activeOrganizationId
    if (!memberIdOrEmail || !organizationId) {
      return res
        .status(400)
        .json({ error: 'Member and organization are required' })
    }
    if (!(await ensureCanManageOrganization(req, organizationId))) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    const member = await db
      .selectFrom('member')
      .innerJoin('user', 'user.id', 'member.userId')
      .innerJoin('organization', 'organization.id', 'member.organizationId')
      .where('member.organizationId', '=', organizationId)
      .where((eb) =>
        eb.or([
          eb('member.id', '=', memberIdOrEmail),
          eb('user.email', '=', memberIdOrEmail.toLowerCase()),
        ]),
      )
      .select([
        'member.id',
        'member.userId',
        'user.clerkUserId',
        'organization.clerkOrganizationId',
      ])
      .executeTakeFirst()
    if (!member) {
      return res.status(404).json({ error: 'Member not found' })
    }

    if (member.userId === req.user.id) {
      return res.status(400).json({ error: 'You cannot remove yourself' })
    }

    if (clerkClient && member.clerkOrganizationId && member.clerkUserId) {
      await clerkClient.organizations.deleteOrganizationMembership({
        organizationId: member.clerkOrganizationId,
        userId: member.clerkUserId,
      })
    }

    await db.deleteFrom('member').where('id', '=', member.id).executeTakeFirst()
    return res.json({ data: { success: true } })
  },
)

router.post('/sign-in/magic-link', async (req, res) => {
  const getCorrelationId = () => {
    const responseHeader = res.getHeader('x-request-id')
    if (typeof responseHeader === 'string' && responseHeader.length > 0) {
      return responseHeader
    }
    const requestHeader = req.headers['x-request-id']
    if (typeof requestHeader === 'string' && requestHeader.length > 0) {
      return requestHeader
    }
    return randomUUID()
  }

  const correlationId = getCorrelationId()
  logger.info(
    {
      event: 'auth.magic.direct_handler_entry',
      correlationId,
      method: req.method,
      path: req.path,
    },
    'Magic link request reached direct auth handler',
  )

  try {
    const result = await auth.api.signInMagicLink({
      body: req.body,
      headers: fromNodeHeaders(req.headers),
    })
    return res.json(result)
  } catch (error) {
    logger.error(
      {
        event: 'auth.magic.direct_handler_failed',
        correlationId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      'Failed to send magic link from direct auth handler',
    )

    return res.status(503).json({
      error: 'AUTH_FAILURE_TRANSIENT',
      code: 'AUTH_FAILURE_TRANSIENT',
      retryable: true,
      userMessage:
        'Unable to send sign-in email right now. Please try again shortly.',
      message:
        'Unable to send sign-in email right now. Please try again shortly.',
      correlationId,
    })
  }
})

router.all('/*splat', async (req, res, next) => {
  const getCorrelationId = () => {
    const responseHeader = res.getHeader('x-request-id')
    if (typeof responseHeader === 'string' && responseHeader.length > 0) {
      return responseHeader
    }
    const requestHeader = req.headers['x-request-id']
    if (typeof requestHeader === 'string' && requestHeader.length > 0) {
      return requestHeader
    }
    return randomUUID()
  }

  const isMagicLinkIssuance =
    req.method === 'POST' && req.path.startsWith('/sign-in/magic-link')

  if (isMagicLinkIssuance) {
    logger.info(
      {
        event: 'auth.magic.handler_entry',
        correlationId: getCorrelationId(),
        method: req.method,
        path: req.path,
      },
      'Magic link request reached auth handler',
    )
  }

  // Intercept response to log errors from better-auth (which handles them internally)
  const originalEnd = res.end.bind(res)
  let magicLinkRewriteApplied = false
  res.end = function (...args: Parameters<typeof res.end>) {
    if (res.writableEnded) {
      return res
    }

    if (
      isMagicLinkIssuance &&
      res.statusCode >= 500 &&
      !magicLinkRewriteApplied &&
      !res.headersSent
    ) {
      magicLinkRewriteApplied = true
      const originalStatusCode = res.statusCode
      const correlationId = getCorrelationId()
      const payload = JSON.stringify({
        error: 'AUTH_FAILURE_TRANSIENT',
        code: 'AUTH_FAILURE_TRANSIENT',
        retryable: true,
        userMessage:
          'Unable to send sign-in email right now. Please try again shortly.',
        message:
          'Unable to send sign-in email right now. Please try again shortly.',
        correlationId,
      })

      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')

      logger.error(
        {
          event: 'auth.magic.response_rewritten',
          correlationId,
          originalStatusCode,
          method: req.method,
          path: req.path,
        },
        'Rewrote magic-link issuance 5xx response to deterministic transient auth error',
      )

      return originalEnd(payload)
    }

    if (
      isMagicLinkIssuance &&
      res.statusCode >= 500 &&
      !magicLinkRewriteApplied &&
      res.headersSent
    ) {
      logger.error(
        {
          event: 'auth.magic.response_rewrite_skipped',
          correlationId: getCorrelationId(),
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
        },
        'Skipped magic-link 5xx response rewrite because headers were already sent',
      )
    }

    if (res.statusCode >= 400) {
      logger.error(
        {
          event: 'auth.handler.response_error',
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
          body: req.body,
        },
        `Auth handler returned ${res.statusCode} for ${req.method} ${req.path}`,
      )
    }
    return originalEnd(...args)
  } as typeof res.end

  try {
    await authHandler(req, res)
  } catch (error) {
    logger.error(
      {
        event: 'auth.handler.uncaught',
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        method: req.method,
        path: req.path,
      },
      'Uncaught error from auth handler',
    )
    next(error)
  }
})

export default router

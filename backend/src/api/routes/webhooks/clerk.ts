import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { Webhook } from 'svix'
import type { WebhookEvent } from '@clerk/backend'
import { db } from '@/lib/db'
import { config } from '@/config'
import logger from '@/lib/logger'

const router = Router()

type ClerkUserPayload = WebhookEvent['data'] & {
  id: string
  external_id?: string | null
  first_name?: string | null
  last_name?: string | null
  image_url?: string | null
  created_at?: number | null
  updated_at?: number | null
  primary_email_address_id?: string | null
  email_addresses?: Array<{
    id?: string
    email_address?: string
    verification?: { status?: string | null } | null
  }>
  public_metadata?: Record<string, unknown> | null
  private_metadata?: Record<string, unknown> | null
}

type ClerkOrganizationPayload = WebhookEvent['data'] & {
  id: string
  name?: string | null
  slug?: string | null
  image_url?: string | null
  created_at?: number | null
  updated_at?: number | null
  public_metadata?: Record<string, unknown> | null
  private_metadata?: Record<string, unknown> | null
}

type ClerkMembershipPayload = WebhookEvent['data'] & {
  id: string
  role?: string | null
  created_at?: number | null
  public_user_data?: {
    user_id?: string
    identifier?: string | null
    first_name?: string | null
    last_name?: string | null
    image_url?: string | null
  } | null
  organization?: {
    id?: string
    name?: string | null
    slug?: string | null
    image_url?: string | null
  } | null
}

type ClerkOrganizationInvitationPayload = WebhookEvent['data'] & {
  id: string
  email_address?: string | null
  role?: string | null
  status?: string | null
  created_at?: number | null
  updated_at?: number | null
  expires_at?: number | null
  organization_id?: string | null
  organization?: {
    id?: string
    name?: string | null
    slug?: string | null
  } | null
}

const asString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null

const fromClerkTimestamp = (timestamp?: number | null) =>
  typeof timestamp === 'number' && Number.isFinite(timestamp)
    ? new Date(timestamp)
    : new Date()

const getMetadataString = (
  metadata: Record<string, unknown> | null | undefined,
  key: string,
) => asString(metadata?.[key])

const getPrimaryEmail = (user: ClerkUserPayload) => {
  const primary =
    user.email_addresses?.find(
      (email) => email.id === user.primary_email_address_id,
    ) ?? user.email_addresses?.[0]

  return {
    email: primary?.email_address?.toLowerCase() ?? null,
    verified: primary?.verification?.status === 'verified',
  }
}

const getDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null,
) => {
  const name = [firstName, lastName].filter(Boolean).join(' ').trim()
  return name || fallback || null
}

const normalizeClerkRole = (role?: string | null) => {
  if (role === 'org:member') return 'member'
  return 'admin'
}

const verifyClerkWebhook = (req: Request) => {
  if (!config.clerk.webhookSecret) {
    throw new Error('CLERK_WEBHOOK_SECRET is not configured')
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody
  if (!rawBody) {
    throw new Error('Missing raw request body')
  }

  const svixId = req.header('svix-id')
  const svixTimestamp = req.header('svix-timestamp')
  const svixSignature = req.header('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) {
    throw new Error('Missing Svix headers')
  }

  return new Webhook(config.clerk.webhookSecret).verify(rawBody, {
    'svix-id': svixId,
    'svix-timestamp': svixTimestamp,
    'svix-signature': svixSignature,
  }) as WebhookEvent
}

const upsertUser = async (user: ClerkUserPayload) => {
  const { email, verified } = getPrimaryEmail(user)
  if (!email) {
    logger.warn({ clerkUserId: user.id }, 'Clerk user missing email')
    return null
  }

  const localUserId =
    getMetadataString(user.private_metadata, 'omnidialUserId') ??
    getMetadataString(user.public_metadata, 'omnidialUserId') ??
    user.external_id ??
    randomUUID()

  const existing = await db
    .selectFrom('user')
    .where((eb) =>
      eb.or([eb('clerkUserId', '=', user.id), eb('email', '=', email)]),
    )
    .select(['id', 'role'])
    .executeTakeFirst()

  const name = getDisplayName(user.first_name, user.last_name)
  const role =
    getMetadataString(user.public_metadata, 'omnidialRole') ?? existing?.role

  if (existing) {
    await db
      .updateTable('user')
      .set({
        clerkUserId: user.id,
        email,
        emailVerified: verified,
        name,
        image: user.image_url ?? null,
        role,
        updatedAt: new Date(),
      })
      .where('id', '=', existing.id)
      .executeTakeFirst()
    return existing.id
  }

  await db
    .insertInto('user')
    .values({
      id: localUserId,
      clerkUserId: user.id,
      email,
      emailVerified: verified,
      name,
      image: user.image_url ?? null,
      role: role ?? 'user',
      createdAt: fromClerkTimestamp(user.created_at),
      updatedAt: new Date(),
    })
    .executeTakeFirst()

  return localUserId
}

const upsertOrganization = async (organization: ClerkOrganizationPayload) => {
  const slug = organization.slug || `clerk-${organization.id}`
  const localOrganizationId =
    getMetadataString(organization.private_metadata, 'omnidialOrganizationId') ??
    getMetadataString(organization.public_metadata, 'omnidialOrganizationId') ??
    randomUUID()

  const existing = await db
    .selectFrom('organization')
    .where((eb) =>
      eb.or([
        eb('clerkOrganizationId', '=', organization.id),
        eb('slug', '=', slug),
      ]),
    )
    .select('id')
    .executeTakeFirst()

  if (existing) {
    await db
      .updateTable('organization')
      .set({
        clerkOrganizationId: organization.id,
        name: organization.name || slug,
        slug,
        logo: organization.image_url ?? null,
      })
      .where('id', '=', existing.id)
      .executeTakeFirst()
    return existing.id
  }

  await db
    .insertInto('organization')
    .values({
      id: localOrganizationId,
      clerkOrganizationId: organization.id,
      name: organization.name || slug,
      slug,
      logo: organization.image_url ?? null,
      createdAt: fromClerkTimestamp(organization.created_at),
    })
    .executeTakeFirst()

  return localOrganizationId
}

const syncMembership = async (membership: ClerkMembershipPayload) => {
  const clerkUserId = membership.public_user_data?.user_id
  const clerkOrganizationId = membership.organization?.id
  if (!clerkUserId || !clerkOrganizationId) {
    logger.warn(
      { clerkMembershipId: membership.id },
      'Clerk membership missing user or organization',
    )
    return
  }

  if (membership.organization) {
    await upsertOrganization({
      id: clerkOrganizationId,
      name: membership.organization.name,
      slug: membership.organization.slug,
      image_url: membership.organization.image_url,
    } as ClerkOrganizationPayload)
  }

  const user = await db
    .selectFrom('user')
    .where('clerkUserId', '=', clerkUserId)
    .select(['id'])
    .executeTakeFirst()
  const organization = await db
    .selectFrom('organization')
    .where('clerkOrganizationId', '=', clerkOrganizationId)
    .select(['id'])
    .executeTakeFirst()

  if (!user || !organization) {
    logger.warn(
      { clerkMembershipId: membership.id, clerkUserId, clerkOrganizationId },
      'Skipping Clerk membership sync because local user or organization is missing',
    )
    return
  }

  const existing = await db
    .selectFrom('member')
    .where((eb) =>
      eb.or([
        eb('clerkMembershipId', '=', membership.id),
        eb.and([
          eb('userId', '=', user.id),
          eb('organizationId', '=', organization.id),
        ]),
      ]),
    )
    .select(['id', 'role'])
    .executeTakeFirst()

  const role =
    existing?.role === 'owner'
      ? 'owner'
      : normalizeClerkRole(membership.role)

  if (existing) {
    await db
      .updateTable('member')
      .set({
        clerkMembershipId: membership.id,
        role,
      })
      .where('id', '=', existing.id)
      .executeTakeFirst()
    return
  }

  await db
    .insertInto('member')
    .values({
      id: membership.id,
      clerkMembershipId: membership.id,
      organizationId: organization.id,
      userId: user.id,
      role,
      createdAt: fromClerkTimestamp(membership.created_at),
    })
    .executeTakeFirst()
}

const deleteMembership = async (membership: ClerkMembershipPayload) => {
  await db
    .deleteFrom('member')
    .where('clerkMembershipId', '=', membership.id)
    .executeTakeFirst()
}

const updateInvitation = async (
  invitation: ClerkOrganizationInvitationPayload,
  status: 'pending' | 'accepted' | 'canceled',
) => {
  const clerkOrganizationId =
    invitation.organization_id ?? invitation.organization?.id
  const email = invitation.email_address?.toLowerCase()
  const organization = clerkOrganizationId
    ? await db
        .selectFrom('organization')
        .where('clerkOrganizationId', '=', clerkOrganizationId)
        .select('id')
        .executeTakeFirst()
    : null

  let existing = await db
    .selectFrom('invitation')
    .where('clerkInvitationId', '=', invitation.id)
    .select('id')
    .executeTakeFirst()

  if (!existing && organization && email) {
    existing = await db
      .selectFrom('invitation')
      .where('organizationId', '=', organization.id)
      .where('email', '=', email)
      .where('status', '=', 'pending')
      .select('id')
      .executeTakeFirst()
  }

  if (!existing) {
    logger.info(
      { clerkInvitationId: invitation.id },
      'Skipping Clerk invitation sync because no matching local invitation exists',
    )
    return
  }

  await db
    .updateTable('invitation')
    .set({
      clerkInvitationId: invitation.id,
      status,
      expiresAt: invitation.expires_at
        ? fromClerkTimestamp(invitation.expires_at)
        : undefined,
    })
    .where('id', '=', existing.id)
    .executeTakeFirst()
}

const markUserDeleted = async (user: ClerkUserPayload) => {
  await db
    .updateTable('user')
    .set({
      banned: true,
      banReason: 'deleted_in_clerk',
      updatedAt: new Date(),
    })
    .where('clerkUserId', '=', user.id)
    .executeTakeFirst()
}

router.post('/', async (req: Request, res: Response) => {
  let event: WebhookEvent

  try {
    event = verifyClerkWebhook(req)
  } catch (error) {
    logger.warn({ error }, 'Clerk webhook verification failed')
    return res.status(400).json({ error: 'Invalid Clerk webhook signature' })
  }

  try {
    switch (event.type) {
      case 'user.created':
      case 'user.updated':
        await upsertUser(event.data as ClerkUserPayload)
        break

      case 'user.deleted':
        await markUserDeleted(event.data as ClerkUserPayload)
        break

      case 'organization.created':
      case 'organization.updated':
        await upsertOrganization(event.data as ClerkOrganizationPayload)
        break

      case 'organization.deleted':
        logger.warn(
          { clerkOrganizationId: (event.data as { id?: string }).id },
          'Clerk organization deleted; local organization retained to avoid cascading CRM data deletion',
        )
        break

      case 'organizationMembership.created':
      case 'organizationMembership.updated':
        await syncMembership(event.data as ClerkMembershipPayload)
        break

      case 'organizationMembership.deleted':
        await deleteMembership(event.data as ClerkMembershipPayload)
        break

      case 'organizationInvitation.created':
        await updateInvitation(
          event.data as ClerkOrganizationInvitationPayload,
          'pending',
        )
        break

      case 'organizationInvitation.accepted':
        await updateInvitation(
          event.data as ClerkOrganizationInvitationPayload,
          'accepted',
        )
        break

      case 'organizationInvitation.revoked':
        await updateInvitation(
          event.data as ClerkOrganizationInvitationPayload,
          'canceled',
        )
        break

      default:
        logger.debug({ type: event.type }, 'Unhandled Clerk webhook event')
    }

    return res.status(200).json({ received: true })
  } catch (error) {
    logger.error({ error, type: event.type }, 'Failed to process Clerk webhook')
    return res.status(500).json({ error: 'Clerk webhook handler error' })
  }
})

export default router

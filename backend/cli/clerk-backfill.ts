import { createClerkClient, type ClerkClient } from '@clerk/backend'
import type { OrganizationMembershipRole } from '@clerk/backend'
import { sql } from 'kysely'
import { db } from '@/lib/db'
import { config } from '@/config'

const apply = process.argv.includes('--apply')
const includeInvitations = process.argv.includes('--include-invitations')

type BackfillStats = {
  usersCreated: number
  usersLinked: number
  organizationsCreated: number
  organizationsLinked: number
  membershipsCreated: number
  membershipsLinked: number
  membershipsUpdated: number
  invitationsCreated: number
  invitationsSkipped: number
}

const stats: BackfillStats = {
  usersCreated: 0,
  usersLinked: 0,
  organizationsCreated: 0,
  organizationsLinked: 0,
  membershipsCreated: 0,
  membershipsLinked: 0,
  membershipsUpdated: 0,
  invitationsCreated: 0,
  invitationsSkipped: 0,
}

const requiredMappingColumns = [
  { tableName: 'user', columnName: 'clerkUserId' },
  { tableName: 'organization', columnName: 'clerkOrganizationId' },
  { tableName: 'member', columnName: 'clerkMembershipId' },
  { tableName: 'invitation', columnName: 'clerkInvitationId' },
]

const getMissingMappingColumns = async () => {
  const result = await sql<{
    table_name: string
    column_name: string
  }>`
    select table_name, column_name
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'user' and column_name = 'clerkUserId')
        or (table_name = 'organization' and column_name = 'clerkOrganizationId')
        or (table_name = 'member' and column_name = 'clerkMembershipId')
        or (table_name = 'invitation' and column_name = 'clerkInvitationId')
      )
  `.execute(db)

  const existingColumns = new Set(
    result.rows.map((row) => `${row.table_name}.${row.column_name}`),
  )

  return requiredMappingColumns.filter(
    (column) => !existingColumns.has(`${column.tableName}.${column.columnName}`),
  )
}

const splitName = (name: string | null) => {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts[0] || undefined,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : undefined,
  }
}

const toClerkRole = (role: string | null): OrganizationMembershipRole => {
  return role === 'member' ? 'org:member' : 'org:admin'
}

const ensureClerkClient = () => {
  if (!config.clerk.secretKey) {
    throw new Error('CLERK_SECRET_KEY is required when running with --apply')
  }

  return createClerkClient({ secretKey: config.clerk.secretKey })
}

const findOrCreateClerkUser = async (
  clerk: ClerkClient,
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
    role: string | null
    createdAt: Date
    clerkUserId: string | null
  },
) => {
  if (user.clerkUserId) {
    return user.clerkUserId
  }

  const byExternalId = await clerk.users.getUserList({
    externalId: [user.id],
    limit: 1,
  })
  const byEmail =
    byExternalId.data[0] ??
    (
      await clerk.users.getUserList({
        emailAddress: [user.email],
        limit: 1,
      })
    ).data[0]

  if (byEmail) {
    await clerk.users.updateUser(byEmail.id, {
      externalId: user.id,
      privateMetadata: {
        omnidialUserId: user.id,
        migratedFrom: 'better-auth',
      },
      publicMetadata: {
        omnidialRole: user.role,
      },
    } as any)
    await db
      .updateTable('user')
      .set({ clerkUserId: byEmail.id })
      .where('id', '=', user.id)
      .executeTakeFirst()
    stats.usersLinked += 1
    return byEmail.id
  }

  const { firstName, lastName } = splitName(user.name)
  const created = await clerk.users.createUser({
    externalId: user.id,
    emailAddress: [user.email],
    firstName,
    lastName,
    skipPasswordRequirement: true,
    skipLegalChecks: true,
    createdAt: user.createdAt,
    publicMetadata: {
      omnidialRole: user.role,
    },
    privateMetadata: {
      omnidialUserId: user.id,
      migratedFrom: 'better-auth',
    },
  } as any)

  await db
    .updateTable('user')
    .set({ clerkUserId: created.id })
    .where('id', '=', user.id)
    .executeTakeFirst()
  stats.usersCreated += 1
  return created.id
}

const findOrCreateClerkOrganization = async (
  clerk: ClerkClient,
  organization: {
    id: string
    name: string
    slug: string
    createdAt: Date
    clerkOrganizationId: string | null
    ownerClerkUserId: string | null
  },
) => {
  if (organization.clerkOrganizationId) {
    return organization.clerkOrganizationId
  }

  try {
    const existing = await clerk.organizations.getOrganization({
      slug: organization.slug,
    })
    await clerk.organizations.updateOrganizationMetadata(existing.id, {
      privateMetadata: {
        omnidialOrganizationId: organization.id,
        migratedFrom: 'better-auth',
      },
      publicMetadata: {
        omnidialSlug: organization.slug,
      },
    } as any)
    await db
      .updateTable('organization')
      .set({ clerkOrganizationId: existing.id })
      .where('id', '=', organization.id)
      .executeTakeFirst()
    stats.organizationsLinked += 1
    return existing.id
  } catch {
    // Missing organization; create below.
  }

  const created = await clerk.organizations.createOrganization({
    name: organization.name,
    slug: organization.slug,
    createdBy: organization.ownerClerkUserId ?? undefined,
    privateMetadata: {
      omnidialOrganizationId: organization.id,
      migratedFrom: 'better-auth',
    },
    publicMetadata: {
      omnidialSlug: organization.slug,
    },
  } as any)

  await db
    .updateTable('organization')
    .set({ clerkOrganizationId: created.id })
    .where('id', '=', organization.id)
    .executeTakeFirst()
  stats.organizationsCreated += 1
  return created.id
}

const syncMembership = async (
  clerk: ClerkClient,
  membership: {
    id: string
    role: string
    clerkMembershipId: string | null
    clerkUserId: string | null
    clerkOrganizationId: string | null
  },
) => {
  if (
    membership.clerkMembershipId ||
    !membership.clerkUserId ||
    !membership.clerkOrganizationId
  ) {
    return
  }

  const role = toClerkRole(membership.role)
  const existing = await clerk.organizations.getOrganizationMembershipList({
    organizationId: membership.clerkOrganizationId,
    userId: [membership.clerkUserId],
    limit: 1,
  })

  const existingMembership = existing.data[0]
  if (existingMembership) {
    if (existingMembership.role !== role) {
      await clerk.organizations.updateOrganizationMembership({
        organizationId: membership.clerkOrganizationId,
        userId: membership.clerkUserId,
        role,
      })
      stats.membershipsUpdated += 1
    }

    await db
      .updateTable('member')
      .set({ clerkMembershipId: existingMembership.id })
      .where('id', '=', membership.id)
      .executeTakeFirst()
    stats.membershipsLinked += 1
    return
  }

  const created = await clerk.organizations.createOrganizationMembership({
    organizationId: membership.clerkOrganizationId,
    userId: membership.clerkUserId,
    role,
  })

  await db
    .updateTable('member')
    .set({ clerkMembershipId: created.id })
    .where('id', '=', membership.id)
    .executeTakeFirst()
  stats.membershipsCreated += 1
}

const syncPendingInvitation = async (
  clerk: ClerkClient,
  invitation: {
    id: string
    email: string
    role: string | null
    status: string
    expiresAt: Date
    clerkInvitationId: string | null
    clerkOrganizationId: string | null
    inviterClerkUserId: string | null
  },
) => {
  if (
    invitation.status !== 'pending' ||
    invitation.clerkInvitationId ||
    !invitation.clerkOrganizationId
  ) {
    stats.invitationsSkipped += 1
    return
  }

  const expiresInDays = Math.max(
    1,
    Math.ceil((invitation.expiresAt.getTime() - Date.now()) / 86_400_000),
  )
  const existing = await clerk.organizations.getOrganizationInvitationList({
    organizationId: invitation.clerkOrganizationId,
    status: ['pending'],
    limit: 100,
  })
  const existingInvitation = existing.data.find(
    (candidate) =>
      candidate.emailAddress.toLowerCase() === invitation.email.toLowerCase(),
  )

  if (existingInvitation) {
    await db
      .updateTable('invitation')
      .set({ clerkInvitationId: existingInvitation.id })
      .where('id', '=', invitation.id)
      .executeTakeFirst()
    stats.invitationsSkipped += 1
    return
  }

  const created = await clerk.organizations.createOrganizationInvitation({
    organizationId: invitation.clerkOrganizationId,
    emailAddress: invitation.email,
    role: toClerkRole(invitation.role),
    inviterUserId: invitation.inviterClerkUserId ?? undefined,
    expiresInDays,
    redirectUrl: `${config.frontendUrl}/accept-invitation`,
    privateMetadata: {
      omnidialInvitationId: invitation.id,
      migratedFrom: 'better-auth',
    },
  } as any)

  await db
    .updateTable('invitation')
    .set({ clerkInvitationId: created.id })
    .where('id', '=', invitation.id)
    .executeTakeFirst()
  stats.invitationsCreated += 1
}

const main = async () => {
  const missingMappingColumns = await getMissingMappingColumns()
  if (missingMappingColumns.length > 0) {
    const migrationMessage =
      'Deploy shared/db/prisma/migrations/20260805000000_add_clerk_identity_mapping before running the Clerk backfill.'

    if (!apply) {
      console.log(
        JSON.stringify(
          {
            mode: 'dry-run',
            migrationRequired: true,
            missingColumns: missingMappingColumns,
            nextStep: migrationMessage,
          },
          null,
          2,
        ),
      )
      return
    }

    throw new Error(migrationMessage)
  }

  const [users, organizations, memberships, invitations] = await Promise.all([
    db
      .selectFrom('user')
      .select([
        'id',
        'email',
        'name',
        'image',
        'role',
        'createdAt',
        'clerkUserId',
      ])
      .orderBy('createdAt', 'asc')
      .execute(),
    db
      .selectFrom('organization')
      .leftJoin('member as ownerMember', (join) =>
        join
          .onRef('ownerMember.organizationId', '=', 'organization.id')
          .on('ownerMember.role', '=', 'owner'),
      )
      .leftJoin('user as ownerUser', 'ownerUser.id', 'ownerMember.userId')
      .select([
        'organization.id',
        'organization.name',
        'organization.slug',
        'organization.createdAt',
        'organization.clerkOrganizationId',
        'ownerUser.clerkUserId as ownerClerkUserId',
      ])
      .orderBy('organization.createdAt', 'asc')
      .execute(),
    db
      .selectFrom('member')
      .innerJoin('user', 'user.id', 'member.userId')
      .innerJoin('organization', 'organization.id', 'member.organizationId')
      .select([
        'member.id',
        'member.role',
        'member.clerkMembershipId',
        'user.clerkUserId',
        'organization.clerkOrganizationId',
      ])
      .orderBy('member.createdAt', 'asc')
      .execute(),
    db
      .selectFrom('invitation')
      .innerJoin('organization', 'organization.id', 'invitation.organizationId')
      .innerJoin('user as inviter', 'inviter.id', 'invitation.inviterId')
      .select([
        'invitation.id',
        'invitation.email',
        'invitation.role',
        'invitation.status',
        'invitation.expiresAt',
        'invitation.clerkInvitationId',
        'organization.clerkOrganizationId',
        'inviter.clerkUserId as inviterClerkUserId',
      ])
      .orderBy('invitation.createdAt', 'asc')
      .execute(),
  ])

  const localSummary = {
    users: users.length,
    usersMissingClerkId: users.filter((user) => !user.clerkUserId).length,
    organizations: organizations.length,
    organizationsMissingClerkId: organizations.filter(
      (organization) => !organization.clerkOrganizationId,
    ).length,
    memberships: memberships.length,
    membershipsMissingClerkId: memberships.filter(
      (membership) => !membership.clerkMembershipId,
    ).length,
    pendingInvitations: invitations.filter(
      (invitation) => invitation.status === 'pending',
    ).length,
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          localSummary,
          note: 'Run pnpm --filter backend clerk:backfill -- --apply after deploying the DB migration and setting CLERK_SECRET_KEY.',
        },
        null,
        2,
      ),
    )
    return
  }

  const clerk = ensureClerkClient()

  for (const user of users) {
    await findOrCreateClerkUser(clerk, user)
  }

  const mappedOrganizations = await db
    .selectFrom('organization')
    .leftJoin('member as ownerMember', (join) =>
      join
        .onRef('ownerMember.organizationId', '=', 'organization.id')
        .on('ownerMember.role', '=', 'owner'),
    )
    .leftJoin('user as ownerUser', 'ownerUser.id', 'ownerMember.userId')
    .select([
      'organization.id',
      'organization.name',
      'organization.slug',
      'organization.createdAt',
      'organization.clerkOrganizationId',
      'ownerUser.clerkUserId as ownerClerkUserId',
    ])
    .orderBy('organization.createdAt', 'asc')
    .execute()

  for (const organization of mappedOrganizations) {
    await findOrCreateClerkOrganization(clerk, organization)
  }

  const mappedMemberships = await db
    .selectFrom('member')
    .innerJoin('user', 'user.id', 'member.userId')
    .innerJoin('organization', 'organization.id', 'member.organizationId')
    .select([
      'member.id',
      'member.role',
      'member.clerkMembershipId',
      'user.clerkUserId',
      'organization.clerkOrganizationId',
    ])
    .orderBy('member.createdAt', 'asc')
    .execute()

  for (const membership of mappedMemberships) {
    await syncMembership(clerk, membership)
  }

  if (includeInvitations) {
    const mappedInvitations = await db
      .selectFrom('invitation')
      .innerJoin(
        'organization',
        'organization.id',
        'invitation.organizationId',
      )
      .innerJoin('user as inviter', 'inviter.id', 'invitation.inviterId')
      .select([
        'invitation.id',
        'invitation.email',
        'invitation.role',
        'invitation.status',
        'invitation.expiresAt',
        'invitation.clerkInvitationId',
        'organization.clerkOrganizationId',
        'inviter.clerkUserId as inviterClerkUserId',
      ])
      .orderBy('invitation.createdAt', 'asc')
      .execute()

    for (const invitation of mappedInvitations) {
      await syncPendingInvitation(clerk, invitation)
    }
  }

  console.log(JSON.stringify({ mode: 'apply', localSummary, stats }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await db.destroy()
  })

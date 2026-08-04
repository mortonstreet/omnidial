import { betterAuth, Session } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma_OnlyForBetterAuth } from '@/lib/db'
import { organization } from 'better-auth/plugins'
import {
  sendOrganizationInvitation,
  sendMagicLinkEmail,
} from '@/clients/email.client'
import { magicLink } from 'better-auth/plugins'
import { stripe } from '@better-auth/stripe'
import logger from '@/lib/logger'
import {
  getOrganizationMember,
  resolveActiveOrganizationForUser,
  updateUserLastActiveOrganizationId,
  getUserById,
  countUserOwnedOrganizations,
} from '@/repositories/auth.repository'
import { stripeClient } from '@/lib/stripe'
import { STRIPE_PLANS } from '@shared/types/src/stripe'
import { config } from '@/config'
import { admin } from 'better-auth/plugins'
import { adminAc } from 'better-auth/plugins/admin/access'
import { APIError } from 'better-auth/api'
import {
  handleInvoicePaid,
  handleSubscriptionCreated,
} from '@/services/subscription.service'
import { TRIAL_DURATION_DAYS } from '@shared/types/src/stripe'

const BETTER_AUTH_BASE_PATH = '/api/auth'

const resolveBetterAuthBaseUrl = (backendUrl: string): string => {
  try {
    const parsed = new URL(backendUrl)
    const normalizedPath = parsed.pathname.replace(/\/+$/, '') || '/'

    if (normalizedPath === '/api' || normalizedPath === BETTER_AUTH_BASE_PATH) {
      logger.warn(
        {
          event: 'auth.base_url.normalized',
          configuredBackendUrl: backendUrl,
          normalizedBaseUrl: parsed.origin,
        },
        'Normalized Better Auth base URL to origin to avoid malformed auth links',
      )
      return parsed.origin
    }

    return backendUrl
  } catch {
    return backendUrl
  }
}

const betterAuthBaseUrl = resolveBetterAuthBaseUrl(config.backendUrl)

export const auth = betterAuth({
  database: prismaAdapter(prisma_OnlyForBetterAuth, {
    provider: 'postgresql',
  }),
  secret: config.betterAuthSecret || undefined,
  trustedOrigins: config.trustedOrigins,
  baseURL: betterAuthBaseUrl,
  basePath: BETTER_AUTH_BASE_PATH,
  advanced: {
    useSecureCookies: config.nodeEnv === 'production',
    defaultCookieAttributes: {
      sameSite: config.nodeEnv === 'production' ? 'none' : 'lax',
      secure: config.nodeEnv === 'production',
      httpOnly: true,
      ...(config.cookieDomain && { domain: config.cookieDomain }),
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (data, _context) => {
          try {
            const resolvedOrg = await resolveActiveOrganizationForUser(
              data.userId,
            )
            if (resolvedOrg.recovered) {
              logger.warn(
                {
                  event: 'auth.session.org_recovered',
                  userId: data.userId,
                  activeOrganizationId: resolvedOrg.activeOrganizationId,
                  hadInvalidLastActiveOrganization:
                    resolvedOrg.hadInvalidLastActiveOrganization,
                },
                'Recovered active organization during session creation',
              )
            }

            return {
              data: {
                ...data,
                activeOrganizationId: resolvedOrg.activeOrganizationId,
              },
            }
          } catch (error) {
            logger.error(
              { error, userId: data.userId },
              'Failed to get last active organization during session creation',
            )
            // Don't block session creation - just create without an active org
            return { data }
          }
        },
      },
      update: {
        before: async (data) => {
          try {
            const sessionPatch = data as Partial<Session> & {
              userId?: string
              activeOrganizationId?: string | null
            }

            if (
              !sessionPatch.userId ||
              !Object.prototype.hasOwnProperty.call(
                sessionPatch,
                'activeOrganizationId',
              )
            ) {
              return { data }
            }

            const requestedOrgId = sessionPatch.activeOrganizationId
            if (!requestedOrgId) {
              return { data }
            }

            const user = await getUserById(sessionPatch.userId)
            if (!user || user.role === 'superadmin') {
              return { data }
            }

            const membership = await getOrganizationMember(
              requestedOrgId,
              sessionPatch.userId,
            )
            if (membership) {
              return { data }
            }

            const recovered = await resolveActiveOrganizationForUser(
              sessionPatch.userId,
            )

            logger.warn(
              {
                event: 'auth.active_org.invalid_rejected',
                userId: sessionPatch.userId,
                requestedOrgId,
                recoveredOrgId: recovered.activeOrganizationId,
              },
              'Rejected invalid active organization update and recovered to valid org',
            )

            return {
              data: {
                ...sessionPatch,
                activeOrganizationId: recovered.activeOrganizationId,
              },
            }
          } catch (error) {
            logger.error(
              { error, userId: (data as any)?.userId },
              'Failed to validate active organization during session update',
            )
            return { data }
          }
        },
        after: async (data) => {
          try {
            const session = data as Session & {
              activeOrganizationId?: string | null
            }
            const activeOrganizationId = session.activeOrganizationId ?? null
            const user = await getUserById(data.userId)
            if (!user) {
              return
            }

            if (!activeOrganizationId) {
              await updateUserLastActiveOrganizationId(data.userId, null)
              return
            }

            if (user.role === 'superadmin') {
              await updateUserLastActiveOrganizationId(
                data.userId,
                activeOrganizationId,
              )
              return
            }

            const membership = await getOrganizationMember(
              activeOrganizationId,
              data.userId,
            )
            if (membership) {
              await updateUserLastActiveOrganizationId(
                data.userId,
                activeOrganizationId,
              )
              return
            }

            const recovered = await resolveActiveOrganizationForUser(
              data.userId,
            )
            await updateUserLastActiveOrganizationId(
              data.userId,
              recovered.activeOrganizationId,
            )
            logger.warn(
              {
                event: 'auth.active_org.invalid',
                userId: data.userId,
                activeOrganizationId,
                recoveredOrgId: recovered.activeOrganizationId,
              },
              'Ignored invalid active organization and recovered user last active org',
            )
          } catch (error) {
            logger.error(
              { error, userId: data.userId },
              'Failed to update last active organization after session update',
            )
            // Don't throw - session update should not fail because of this
          }
        },
      },
    },
    organization: {
      create: {
        before: async (
          data: { name: string; slug: string },
          context: { session?: { userId?: string } } | undefined,
        ) => {
          const session = context?.session
          if (!session?.userId) {
            logger.warn('Organization creation rejected: no user in session')
            throw new Error('Authentication required to create an organization')
          }

          const user = await getUserById(session.userId)
          if (!user) {
            logger.warn(
              `Organization creation rejected: user ${session.userId} not found`,
            )
            throw new Error('User not found')
          }

          if (user.role !== 'superadmin') {
            const ownedOrgCount = await countUserOwnedOrganizations(
              session.userId,
            )
            if (ownedOrgCount >= 1) {
              logger.warn(
                `User ${user.email} blocked from creating additional workspace (non-enterprise)`,
              )
              throw new Error(
                'Your plan only allows one workspace. Upgrade to Enterprise for multiple workspaces.',
              )
            }
          }

          logger.info(`User ${user.email} creating organization`)
          return { data }
        },
      },
    },
  },
  emailAndPassword: {
    enabled: false,
  },
  socialProviders: {
    google: {
      clientId: config.providers.google.clientId,
      clientSecret: config.providers.google.clientSecret,
    },
    ...(config.providers.microsoft.clientId &&
    config.providers.microsoft.clientSecret
      ? {
          microsoft: {
            clientId: config.providers.microsoft.clientId,
            clientSecret: config.providers.microsoft.clientSecret,
          },
        }
      : {}),
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        logger.info(
          { event: 'auth.magic.send_start', email },
          'Magic link sendMagicLink callback invoked',
        )
        try {
          await sendMagicLinkEmail(email, url)
          logger.info(
            { event: 'auth.magic.send_success', email },
            'Magic link email sent successfully',
          )
        } catch (error) {
          logger.error(
            {
              event: 'auth.magic.email_send_failed',
              email,
              error,
              errorMessage:
                error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
            },
            'Failed to send magic link email',
          )

          throw new APIError('SERVICE_UNAVAILABLE', {
            code: 'AUTH_FAILURE_TRANSIENT',
            message:
              'Unable to send sign-in email right now. Please try again shortly.',
          })
        }
      },
    }),
    organization({
      async sendInvitationEmail(data) {
        const frontendUrl = config.frontendUrl
        const inviteLink = `${frontendUrl}/accept-invitation/${data.id}?email=${encodeURIComponent(data.email)}`
        try {
          // Use name if available, otherwise fall back to email
          const inviterName = data.inviter.user.name || data.inviter.user.email
          await sendOrganizationInvitation({
            email: data.email,
            invitedByUsername: inviterName,
            invitedByEmail: data.inviter.user.email,
            teamName: data.organization.name,
            inviteLink,
          })
          logger.info('Organization invitation email sent', {
            email: data.email,
            organizationId: data.organization.id,
          })
        } catch (err) {
          logger.error('Failed to send organization invitation email', {
            error: err,
            errorMessage: err instanceof Error ? err.message : String(err),
            email: data.email,
            organizationId: data.organization.id,
            inviterEmail: data.inviter?.user?.email,
            inviterName: data.inviter?.user?.name,
            organizationName: data.organization?.name,
          })
          throw err
        }
      },
    }),
    admin({
      adminRoles: ['superadmin'],
      roles: {
        superadmin: adminAc,
      },
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: config.stripe.webhookSecret,
      createCustomerOnSignUp: true,
      onEvent: async (event: any) => {
        // Handle any Stripe event
        switch (event.type) {
          case 'invoice.paid':
            await handleInvoicePaid(event)
            break
          case 'customer.subscription.created':
            await handleSubscriptionCreated(event)
            break
        }
      },
      subscription: {
        enabled: true,
        authorizeReference: async ({ user, referenceId, action }) => {
          const member = await getOrganizationMember(referenceId, user.id)
          return member?.role === 'owner'
        },
        getCheckoutSessionParams: async () => {
          return {
            params: {
              allow_promotion_codes: true,
              subscription_data: {
                trial_period_days: TRIAL_DURATION_DAYS,
                trial_settings: {
                  end_behavior: {
                    missing_payment_method: 'cancel' as const,
                  },
                },
              },
            },
          }
        },
        organization: {
          enabled: true,
        },
        plans: STRIPE_PLANS,
      },
    }),
  ],
})

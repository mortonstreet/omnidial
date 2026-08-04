import { transporter, resendClient, useResendApi } from '@/lib/email'
import logger from '@/lib/logger'
import { config } from '@/config'

// OmniDial Email Templates
// Dark monochromatic design - matching website theme exactly

const EMAIL_STYLES = {
  background: '#0a0a0a',
  cardBackground: '#111111',
  textPrimary: '#fafafa',
  textSecondary: '#a3a3a3',
  textMuted: '#737373',
  buttonBackground: '#fafafa',
  buttonText: '#0a0a0a',
  border: '#262626',
  footerBackground: '#0a0a0a',
}

const PRIMARY_FROM_ADDRESS =
  config.resend.fromAddress || 'OmniDial <noreply@omnidial.io>'
const FALLBACK_FROM_ADDRESS =
  config.resend.fallbackFromAddress || 'OmniDial <noreply@omnidial.io>'

const resendFromValidationError = (message: string) =>
  /(from|sender|domain|verify|verified)/i.test(message)

const sendViaResend = async (
  from: string,
  options: {
    to: string
    subject: string
    html?: string
    text: string
  },
) =>
  resendClient!.emails.send({
    from,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  })

// Helper function to send email via Resend API or fallback to nodemailer
async function sendMail(options: {
  to: string
  subject: string
  html?: string
  text: string
}) {
  if (useResendApi && resendClient) {
    const primaryResult = await sendViaResend(PRIMARY_FROM_ADDRESS, options)
    if (!primaryResult.error) {
      logger.info('Email sent via Resend API', {
        id: primaryResult.data?.id,
        to: options.to,
        from: PRIMARY_FROM_ADDRESS,
      })
      return primaryResult
    }

    const primaryErrorMessage = primaryResult.error.message || 'Unknown error'
    if (
      FALLBACK_FROM_ADDRESS !== PRIMARY_FROM_ADDRESS &&
      resendFromValidationError(primaryErrorMessage)
    ) {
      logger.warn('Resend rejected primary sender, retrying with fallback', {
        to: options.to,
        subject: options.subject,
        primaryFrom: PRIMARY_FROM_ADDRESS,
        fallbackFrom: FALLBACK_FROM_ADDRESS,
        error: primaryResult.error,
      })

      const fallbackResult = await sendViaResend(FALLBACK_FROM_ADDRESS, options)
      if (!fallbackResult.error) {
        logger.info('Email sent via Resend API (fallback sender)', {
          id: fallbackResult.data?.id,
          to: options.to,
          from: FALLBACK_FROM_ADDRESS,
        })
        return fallbackResult
      }

      logger.error('Resend API fallback sender also failed', {
        to: options.to,
        subject: options.subject,
        primaryFrom: PRIMARY_FROM_ADDRESS,
        fallbackFrom: FALLBACK_FROM_ADDRESS,
        primaryError: primaryResult.error,
        fallbackError: fallbackResult.error,
      })
      throw new Error(`Email send failed: ${fallbackResult.error.message}`)
    }

    logger.error('Resend API error', {
      error: primaryResult.error,
      to: options.to,
      subject: options.subject,
      from: PRIMARY_FROM_ADDRESS,
    })
    throw new Error(`Email send failed: ${primaryErrorMessage}`)
  }

  // Fallback to nodemailer (local dev with MailHog)
  return transporter.sendMail({
    from: PRIMARY_FROM_ADDRESS,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  })
}

export const sendEmail = async (to: string, subject: string, text: string) => {
  await sendMail({ to, subject, text })
}

export const sendMagicLinkEmail = async (to: string, url: string) => {
  await sendMail({
    to,
    subject: 'Sign in to OmniDial',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px; text-align: center;">
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      Sign in to OmniDial
                    </h1>
                    <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      Click the button below to sign in. This link will expire in 10 minutes.
                    </p>
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${url}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            Sign In
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 32px 0 0 0; font-size: 13px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted};">
                      If the button doesn't work, copy and paste this link into your browser:<br>
                      <a href="${url}" style="color: ${EMAIL_STYLES.textSecondary}; word-break: break-all;">${url}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      If you didn't request this sign-in link, you can safely ignore this email.<br>
                      This link will expire in 10 minutes.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `SIGN IN TO OMNIDIAL

Click the link below to sign in. This link will expire in 10 minutes.

Sign In: ${url}

If you didn't request this sign-in link, you can safely ignore this email.
This link will expire in 10 minutes.`,
  })
}

export const sendCallingActivityNotification = async ({
  ownerEmail,
  ownerName,
  repName,
  organizationName,
  campaignName,
  dialerType,
  dashboardUrl,
}: {
  ownerEmail: string
  ownerName: string
  repName: string
  organizationName: string
  campaignName?: string
  dialerType: 'manual' | 'power' | 'parallel'
  dashboardUrl: string
}) => {
  const dialerTypeLabel = {
    manual: 'Manual Dialer',
    power: 'Power Dialer',
    parallel: 'Parallel Dialer',
  }[dialerType]

  const campaignText = campaignName
    ? `on campaign <strong style="color: ${EMAIL_STYLES.textPrimary};">${campaignName}</strong>`
    : ''

  await sendMail({
    to: ownerEmail,
    subject: `${repName} started a calling session`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px; text-align: center;">
                    <div style="width: 64px; height: 64px; background-color: rgba(34, 197, 94, 0.1); border-radius: 50%; margin: 0 auto 24px auto; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 28px;">📞</span>
                    </div>
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      Calling Session Started
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      Hi ${ownerName}, <strong style="color: ${EMAIL_STYLES.textPrimary};">${repName}</strong> has started a calling session using <strong style="color: ${EMAIL_STYLES.textPrimary};">${dialerTypeLabel}</strong> ${campaignText}.
                    </p>
                    <div style="background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; margin: 0 0 24px 0; text-align: left;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Rep</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${repName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Dialer Type</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${dialerTypeLabel}</td>
                        </tr>
                        ${
                          campaignName
                            ? `
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Campaign</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${campaignName}</td>
                        </tr>
                        `
                            : ''
                        }
                      </table>
                    </div>
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${dashboardUrl}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            View Sales Floor
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 24px 0 0 0; font-size: 13px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted};">
                      Monitor live calls using Listen, Whisper, or Barge features.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      You're receiving this because you're an owner of ${organizationName}.<br>
                      Manage notification preferences in your account settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `CALLING SESSION STARTED

Hi ${ownerName}, ${repName} has started a calling session using ${dialerTypeLabel}${campaignName ? ` on campaign ${campaignName}` : ''}.

Rep: ${repName}
Dialer Type: ${dialerTypeLabel}
${campaignName ? `Campaign: ${campaignName}` : ''}

View Sales Floor: ${dashboardUrl}

Monitor live calls using Listen, Whisper, or Barge features.

You're receiving this because you're an owner of ${organizationName}.
Manage notification preferences in your account settings.`,
  })
}

export const sendOrganizationInvitation = async ({
  email,
  invitedByUsername,
  invitedByEmail,
  teamName,
  inviteLink,
}: {
  email: string
  invitedByUsername: string
  invitedByEmail: string
  teamName: string
  inviteLink: string
}) => {
  await sendMail({
    to: email,
    subject: `${invitedByUsername} invited you to join ${teamName} on OmniDial`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px; text-align: center;">
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      You've been invited
                    </h1>
                    <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      <strong style="color: ${EMAIL_STYLES.textPrimary};">${invitedByUsername}</strong> (${invitedByEmail}) has invited you to join <strong style="color: ${EMAIL_STYLES.textPrimary};">${teamName}</strong> on OmniDial.
                    </p>
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${inviteLink}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 32px 0 0 0; font-size: 13px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted};">
                      If the button doesn't work, copy and paste this link into your browser:<br>
                      <a href="${inviteLink}" style="color: ${EMAIL_STYLES.textSecondary}; word-break: break-all;">${inviteLink}</a>
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      If you don't want to join this organization, you can safely ignore this email.<br>
                      This invitation link will expire in 7 days.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `YOU'VE BEEN INVITED

${invitedByUsername} (${invitedByEmail}) has invited you to join ${teamName} on OmniDial.

Accept Invitation: ${inviteLink}

If the button doesn't work, copy and paste this link into your browser:
${inviteLink}

If you don't want to join this organization, you can safely ignore this email.
This invitation link will expire in 7 days.`,
  })
}

export const sendCallingSessionEndNotification = async ({
  ownerEmail,
  ownerName,
  repName,
  organizationName,
  sessionDuration,
  totalCalls,
  connectedCalls,
  dashboardUrl,
}: {
  ownerEmail: string
  ownerName: string
  repName: string
  organizationName: string
  sessionDuration: string
  totalCalls: number
  connectedCalls: number
  dashboardUrl: string
}) => {
  await sendMail({
    to: ownerEmail,
    subject: `${repName} ended their calling session`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px; text-align: center;">
                    <div style="width: 64px; height: 64px; background-color: rgba(163, 163, 163, 0.1); border-radius: 50%; margin: 0 auto 24px auto; display: flex; align-items: center; justify-content: center;">
                      <span style="font-size: 28px;">📴</span>
                    </div>
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      Calling Session Ended
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      Hi ${ownerName}, <strong style="color: ${EMAIL_STYLES.textPrimary};">${repName}</strong> has ended their calling session.
                    </p>
                    <div style="background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; margin: 0 0 24px 0; text-align: left;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Rep</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${repName}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Duration</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${sessionDuration}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Total Calls</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${totalCalls}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Connected</td>
                          <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${connectedCalls}</td>
                        </tr>
                      </table>
                    </div>
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${dashboardUrl}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            View Analytics
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      You're receiving this because you're an owner of ${organizationName}.<br>
                      Manage notification preferences in your account settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `CALLING SESSION ENDED

Hi ${ownerName}, ${repName} has ended their calling session.

Rep: ${repName}
Duration: ${sessionDuration}
Total Calls: ${totalCalls}
Connected: ${connectedCalls}

View Analytics: ${dashboardUrl}

You're receiving this because you're an owner of ${organizationName}.
Manage notification preferences in your account settings.`,
  })
}

export interface RepPerformanceData {
  repName: string
  totalCalls: number
  connectedCalls: number
  connectionRate: number
  totalTalkTimeMinutes: number
  avgCallDurationSeconds: number
  topDisposition?: string
}

export interface CoachingSummaryData {
  avgScore: number
  totalSessions: number
  topImprovementArea?: string
}

export const sendDailyPerformanceSummaryEmail = async ({
  ownerEmail,
  ownerName,
  organizationName,
  date,
  repPerformance,
  coachingSummary,
  analyticsUrl,
}: {
  ownerEmail: string
  ownerName: string
  organizationName: string
  date: string
  repPerformance: RepPerformanceData[]
  coachingSummary?: CoachingSummaryData
  analyticsUrl: string
}) => {
  const totalCalls = repPerformance.reduce(
    (sum, rep) => sum + rep.totalCalls,
    0,
  )
  const totalConnected = repPerformance.reduce(
    (sum, rep) => sum + rep.connectedCalls,
    0,
  )
  const avgConnectionRate =
    totalCalls > 0 ? Math.round((totalConnected / totalCalls) * 100) : 0

  const repRows = repPerformance
    .map(
      (rep) => `
        <tr>
          <td style="padding: 12px 8px; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; border-bottom: 1px solid ${EMAIL_STYLES.border};">${rep.repName}</td>
          <td style="padding: 12px 8px; font-size: 14px; color: ${EMAIL_STYLES.textSecondary}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">${rep.totalCalls}</td>
          <td style="padding: 12px 8px; font-size: 14px; color: ${EMAIL_STYLES.textSecondary}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">${rep.connectedCalls}</td>
          <td style="padding: 12px 8px; font-size: 14px; color: ${EMAIL_STYLES.textSecondary}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">${rep.connectionRate}%</td>
          <td style="padding: 12px 8px; font-size: 14px; color: ${EMAIL_STYLES.textSecondary}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">${rep.totalTalkTimeMinutes}m</td>
        </tr>
      `,
    )
    .join('')

  const repRowsText = repPerformance
    .map(
      (rep) =>
        `${rep.repName}: ${rep.totalCalls} calls, ${rep.connectedCalls} connected (${rep.connectionRate}%), ${rep.totalTalkTimeMinutes}m talk time`,
    )
    .join('\n')

  const coachingSection = coachingSummary
    ? `
      <div style="background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; margin: 24px 0 0 0;">
        <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">Coaching Summary</h3>
        <table style="width: 100%;">
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Average Score</td>
            <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${coachingSummary.avgScore}/100</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Sessions Analyzed</td>
            <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${coachingSummary.totalSessions}</td>
          </tr>
          ${
            coachingSummary.topImprovementArea
              ? `
          <tr>
            <td style="padding: 4px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">Top Improvement Area</td>
            <td style="padding: 4px 0; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; text-align: right;">${coachingSummary.topImprovementArea}</td>
          </tr>
          `
              : ''
          }
        </table>
      </div>
    `
    : ''

  const coachingTextSection = coachingSummary
    ? `\nCOACHING SUMMARY\nAverage Score: ${coachingSummary.avgScore}/100\nSessions Analyzed: ${coachingSummary.totalSessions}${coachingSummary.topImprovementArea ? `\nTop Improvement Area: ${coachingSummary.topImprovementArea}` : ''}`
    : ''

  await sendMail({
    to: ownerEmail,
    subject: `Daily Performance Summary - ${date}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 700px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px;">
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      Daily Performance Summary
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      Hi ${ownerName}, here's your team's performance for ${date}.
                    </p>

                    <!-- Summary Stats -->
                    <div style="display: flex; gap: 16px; margin-bottom: 24px;">
                      <div style="flex: 1; background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; text-align: center;">
                        <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">${totalCalls}</p>
                        <p style="margin: 0; font-size: 12px; color: ${EMAIL_STYLES.textMuted};">Total Calls</p>
                      </div>
                      <div style="flex: 1; background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; text-align: center;">
                        <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">${totalConnected}</p>
                        <p style="margin: 0; font-size: 12px; color: ${EMAIL_STYLES.textMuted};">Connected</p>
                      </div>
                      <div style="flex: 1; background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; text-align: center;">
                        <p style="margin: 0 0 4px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">${avgConnectionRate}%</p>
                        <p style="margin: 0; font-size: 12px; color: ${EMAIL_STYLES.textMuted};">Connection Rate</p>
                      </div>
                    </div>

                    <!-- Rep Performance Table -->
                    <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">Rep Performance</h3>
                    <table style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px;">
                      <thead>
                        <tr>
                          <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: left; border-bottom: 1px solid ${EMAIL_STYLES.border};">Rep</th>
                          <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">Calls</th>
                          <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">Connected</th>
                          <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">Rate</th>
                          <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">Talk Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${repRows}
                      </tbody>
                    </table>

                    ${coachingSection}

                    <table role="presentation" style="margin: 32px auto 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${analyticsUrl}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            View Full Analytics
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      You're receiving this because you're an owner of ${organizationName}.<br>
                      Manage notification preferences in your account settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `DAILY PERFORMANCE SUMMARY - ${date}

Hi ${ownerName}, here's your team's performance for ${date}.

SUMMARY
Total Calls: ${totalCalls}
Connected: ${totalConnected}
Connection Rate: ${avgConnectionRate}%

REP PERFORMANCE
${repRowsText}
${coachingTextSection}

View Full Analytics: ${analyticsUrl}

You're receiving this because you're an owner of ${organizationName}.
Manage notification preferences in your account settings.`,
  })
}

// Usage Alert Emails (Billing)
export const sendUsageAlertEmail = async ({
  ownerEmail,
  ownerName,
  organizationName,
  threshold,
  usedMinutes,
  includedMinutes,
  billingUrl,
}: {
  ownerEmail: string
  ownerName: string
  organizationName: string
  threshold: '80%' | '100%' | '150%'
  usedMinutes: number
  includedMinutes: number
  billingUrl: string
}) => {
  const isOverage = threshold !== '80%'
  const thresholdLabel =
    threshold === '80%'
      ? "You've used 80% of your included minutes"
      : threshold === '100%'
        ? "You've used all your included minutes"
        : "You're 50% over your included minutes"

  const ctaLabel = threshold === '150%' ? 'Upgrade Plan' : 'View Usage'
  const subjectLine =
    threshold === '80%'
      ? `Usage alert: 80% of included minutes used`
      : threshold === '100%'
        ? `You've reached your included minutes limit`
        : `Usage alert: 150% of included minutes used`

  await sendMail({
    to: ownerEmail,
    subject: subjectLine,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px; text-align: center;">
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      ${thresholdLabel}
                    </h1>
                    <p style="margin: 0 0 24px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      Hi ${ownerName}, your team at <strong style="color: ${EMAIL_STYLES.textPrimary};">${organizationName}</strong> has used <strong style="color: ${isOverage ? '#ef4444' : EMAIL_STYLES.textPrimary};">${usedMinutes}</strong> of <strong style="color: ${EMAIL_STYLES.textPrimary};">${includedMinutes}</strong> included minutes this billing cycle.
                    </p>
                    <div style="background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; margin: 0 0 24px 0;">
                      <div style="height: 8px; background-color: #262626; border-radius: 4px; overflow: hidden;">
                        <div style="height: 100%; width: ${Math.min(100, Math.round((usedMinutes / includedMinutes) * 100))}%; background-color: ${isOverage ? '#ef4444' : '#f59e0b'}; border-radius: 4px;"></div>
                      </div>
                      <p style="margin: 8px 0 0 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                        ${usedMinutes} / ${includedMinutes} minutes (${Math.round((usedMinutes / includedMinutes) * 100)}%)
                      </p>
                    </div>
                    ${isOverage ? `<p style="margin: 0 0 24px 0; font-size: 14px; color: ${EMAIL_STYLES.textSecondary};">Additional minutes are billed at your plan's overage rate. ${threshold === '150%' ? 'Consider upgrading for more included minutes at a lower rate.' : ''}</p>` : ''}
                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${billingUrl}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            ${ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      You're receiving this because you're an owner of ${organizationName}.<br>
                      Manage notification preferences in your account settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `${thresholdLabel.toUpperCase()}

Hi ${ownerName}, your team at ${organizationName} has used ${usedMinutes} of ${includedMinutes} included minutes this billing cycle (${Math.round((usedMinutes / includedMinutes) * 100)}%).

${isOverage ? `Additional minutes are billed at your plan's overage rate.${threshold === '150%' ? ' Consider upgrading for more included minutes at a lower rate.' : ''}` : ''}

${ctaLabel}: ${billingUrl}

You're receiving this because you're an owner of ${organizationName}.
Manage notification preferences in your account settings.`,
  })
}

export interface FollowUpLead {
  name: string
  company?: string
  lastContact?: string
  reason?: string
}

export interface CampaignScheduleItem {
  campaignName: string
  leadCount: number
  priority?: string
}

export const sendRepDailyRemindersEmail = async ({
  repEmail,
  repName,
  organizationName,
  followUps,
  campaignSchedule,
  dialerUrl,
}: {
  repEmail: string
  repName: string
  organizationName: string
  followUps: FollowUpLead[]
  campaignSchedule: CampaignScheduleItem[]
  dialerUrl: string
}) => {
  const followUpRows = followUps
    .slice(0, 10)
    .map(
      (lead) => `
        <tr>
          <td style="padding: 10px 8px; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; border-bottom: 1px solid ${EMAIL_STYLES.border};">${lead.name}</td>
          <td style="padding: 10px 8px; font-size: 14px; color: ${EMAIL_STYLES.textSecondary}; border-bottom: 1px solid ${EMAIL_STYLES.border};">${lead.company || '-'}</td>
          <td style="padding: 10px 8px; font-size: 14px; color: ${EMAIL_STYLES.textMuted}; border-bottom: 1px solid ${EMAIL_STYLES.border};">${lead.lastContact || '-'}</td>
        </tr>
      `,
    )
    .join('')

  const campaignRows = campaignSchedule
    .map(
      (campaign) => `
        <tr>
          <td style="padding: 10px 8px; font-size: 14px; color: ${EMAIL_STYLES.textPrimary}; border-bottom: 1px solid ${EMAIL_STYLES.border};">${campaign.campaignName}</td>
          <td style="padding: 10px 8px; font-size: 14px; color: ${EMAIL_STYLES.textSecondary}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">${campaign.leadCount} leads</td>
        </tr>
      `,
    )
    .join('')

  const followUpSection =
    followUps.length > 0
      ? `
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">Follow-ups Due Today (${followUps.length})</h3>
      <table style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; margin-bottom: 24px;">
        <thead>
          <tr>
            <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: left; border-bottom: 1px solid ${EMAIL_STYLES.border};">Name</th>
            <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: left; border-bottom: 1px solid ${EMAIL_STYLES.border};">Company</th>
            <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: left; border-bottom: 1px solid ${EMAIL_STYLES.border};">Last Contact</th>
          </tr>
        </thead>
        <tbody>
          ${followUpRows}
        </tbody>
      </table>
      ${followUps.length > 10 ? `<p style="margin: -16px 0 24px 0; font-size: 13px; color: ${EMAIL_STYLES.textMuted};">...and ${followUps.length - 10} more follow-ups</p>` : ''}
    `
      : `
      <div style="background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; padding: 16px; margin-bottom: 24px; text-align: center;">
        <p style="margin: 0; font-size: 14px; color: ${EMAIL_STYLES.textMuted};">No follow-ups due today</p>
      </div>
    `

  const campaignSection =
    campaignSchedule.length > 0
      ? `
      <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary};">Your Campaign Schedule</h3>
      <table style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background}; border: 1px solid ${EMAIL_STYLES.border}; border-radius: 6px; margin-bottom: 24px;">
        <thead>
          <tr>
            <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: left; border-bottom: 1px solid ${EMAIL_STYLES.border};">Campaign</th>
            <th style="padding: 12px 8px; font-size: 12px; font-weight: 500; color: ${EMAIL_STYLES.textMuted}; text-align: center; border-bottom: 1px solid ${EMAIL_STYLES.border};">Assigned Leads</th>
          </tr>
        </thead>
        <tbody>
          ${campaignRows}
        </tbody>
      </table>
    `
      : ''

  const followUpTextList = followUps
    .slice(0, 10)
    .map((lead) => `- ${lead.name}${lead.company ? ` (${lead.company})` : ''}`)
    .join('\n')

  const campaignTextList = campaignSchedule
    .map(
      (campaign) => `- ${campaign.campaignName}: ${campaign.leadCount} leads`,
    )
    .join('\n')

  await sendMail({
    to: repEmail,
    subject: `Your Daily Reminders - ${new Date().toLocaleDateString()}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta name="color-scheme" content="dark">
        <meta name="supported-color-schemes" content="dark">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: ${EMAIL_STYLES.background};">
        <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: ${EMAIL_STYLES.background};">
          <tr>
            <td style="padding: 40px 20px;">
              <table role="presentation" style="max-width: 600px; margin: 0 auto; background-color: ${EMAIL_STYLES.cardBackground}; border-radius: 8px; border: 1px solid ${EMAIL_STYLES.border};">
                <tr>
                  <td style="padding: 48px 40px;">
                    <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 600; color: ${EMAIL_STYLES.textPrimary}; letter-spacing: -0.5px;">
                      Good morning, ${repName}!
                    </h1>
                    <p style="margin: 0 0 32px 0; font-size: 15px; line-height: 1.6; color: ${EMAIL_STYLES.textSecondary};">
                      Here's what's on your plate for today.
                    </p>

                    ${followUpSection}
                    ${campaignSection}

                    <table role="presentation" style="margin: 0 auto;">
                      <tr>
                        <td style="background-color: ${EMAIL_STYLES.buttonBackground}; border-radius: 6px;">
                          <a href="${dialerUrl}"
                             style="display: inline-block; padding: 12px 28px; color: ${EMAIL_STYLES.buttonText}; text-decoration: none; font-size: 14px; font-weight: 500;">
                            Start Dialing
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: ${EMAIL_STYLES.footerBackground}; border-radius: 0 0 8px 8px; border-top: 1px solid ${EMAIL_STYLES.border};">
                    <p style="margin: 0; font-size: 12px; line-height: 1.5; color: ${EMAIL_STYLES.textMuted}; text-align: center;">
                      You're receiving this because you're a member of ${organizationName}.<br>
                      Your team admin can manage these notifications in settings.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
    text: `GOOD MORNING, ${repName.toUpperCase()}!

Here's what's on your plate for today.

${followUps.length > 0 ? `FOLLOW-UPS DUE TODAY (${followUps.length})\n${followUpTextList}${followUps.length > 10 ? `\n...and ${followUps.length - 10} more` : ''}` : 'No follow-ups due today'}

${campaignSchedule.length > 0 ? `YOUR CAMPAIGN SCHEDULE\n${campaignTextList}` : ''}

Start Dialing: ${dialerUrl}

You're receiving this because you're a member of ${organizationName}.
Your team admin can manage these notifications in settings.`,
  })
}

import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const isDev = process.env.NODE_ENV !== 'production'
// Soketi (the local Pusher stand-in) runs on 6001, and pusher-js may reach for
// wss:// even with forceTLS off, so both schemes have to be allowed or realtime
// silently dies behind a CSP violation.
const devConnectSources = isDev
  ? ' http://localhost:3000 http://localhost:3001 http://localhost:8000 http://localhost:8010 ws://localhost:3000 ws://localhost:3001 ws://localhost:6001 wss://localhost:6001'
  : ''

const nextConfig: NextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), geolocation=(), microphone=(self)',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://clerk.omnidial.io https://accounts.omnidial.io js.stripe.com www.googletagmanager.com static.cloudflareinsights.com https://*.posthog.com",
              "style-src 'self' 'unsafe-inline'",
              // img.logo.dev serves the company logos rendered by CompanyLogo
              "img-src 'self' data: blob: img.logo.dev lh3.googleusercontent.com www.google-analytics.com https://img.clerk.com",
              "font-src 'self' data:",
              `connect-src 'self' https://api.omnidial.io https://app.omnidial.io https://www.omnidial.io *.omnidial.io *.pusher.com wss://*.pusher.com *.telnyx.com wss://*.telnyx.com api.stripe.com www.google-analytics.com *.google-analytics.com vitals.vercel-insights.com https://*.posthog.com${devConnectSources}`,
              'frame-src js.stripe.com https://clerk.omnidial.io https://accounts.omnidial.io',
              "media-src 'self' https://api.omnidial.io *.telnyx.com blob:",
              "worker-src 'self' blob: data:",
            ].join('; '),
          },
        ],
      },
    ]
  },
}

const hasSentryBuildCredentials =
  Boolean(process.env.SENTRY_AUTH_TOKEN) &&
  Boolean(process.env.SENTRY_ORG) &&
  Boolean(process.env.SENTRY_PROJECT)

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: {
    disable: !hasSentryBuildCredentials,
    deleteSourcemapsAfterUpload: true,
  },
  tunnelRoute: '/monitoring',
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
})

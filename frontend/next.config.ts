import type { NextConfig } from "next";

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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' js.stripe.com www.googletagmanager.com static.cloudflareinsights.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: lh3.googleusercontent.com www.google-analytics.com",
              "font-src 'self' data:",
              "connect-src 'self' https://api.omnidial.io https://app.omnidial.io https://www.omnidial.io *.omnidial.io *.pusher.com wss://*.pusher.com *.telnyx.com wss://*.telnyx.com api.stripe.com www.google-analytics.com *.google-analytics.com vitals.vercel-insights.com",
              "frame-src js.stripe.com",
              "media-src 'self' https://api.omnidial.io *.telnyx.com blob:",
              "worker-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import dotenv from 'dotenv'
import { z } from 'zod'
import path from 'path'
import fs from 'fs'

// Load .env first, then .env.local to override (if it exists)
dotenv.config()
const envLocalPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath, override: true })
}

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DEPLOY_ENV: z.enum(['dev', 'stage', 'prod']).optional(),
  CORS_ORIGIN: z
    .string()
    .default('*')
    .transform((val) => {
      if (val === '*') return '*'
      return val.includes(',') ? val.split(',').map((s) => s.trim()) : val
    }),
  COOKIE_DOMAIN: z.string().optional(),
  BACKEND_URL: z.string().url().default('http://localhost:8000'),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_SSL_MODE: z.enum(['disable', 'require']).optional(),
  DB_SSL_REJECT_UNAUTHORIZED: z
    .string()
    .optional()
    .transform((val) => (val === undefined ? undefined : val === 'true')),
  // Redis - supports either REDIS_URL or individual REDIS_HOST/PORT/PASSWORD
  REDIS_URL: z.string().url().optional(),
  REDIS_HOST: z.string().optional(),
  REDIS_PORT: z.coerce.number().optional(),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z
    .string()
    .default('true')
    .transform((val) => val === 'true'),
  BETTERSTACK_TOKEN: z.string(),
  BETTERSTACK_HOST: z.string(),
  AXIOM_DATASET: z.string(),
  AXIOM_TOKEN: z.string(),
  SENTRY_DSN: z.string(),
  JWT_SECRET: z.string(),
  BETTER_AUTH_SECRET: z.string().optional(),
  BETTER_AUTH_TOKEN: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  WEBHOOK_API_KEY: z.string(),
  STRIPE_PUBLISHABLE_KEY: z.string(),
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  GOOGLE_CLIENT_ID: z.string(),
  GOOGLE_CLIENT_SECRET: z.string(),
  RESEND_API_KEY: z.string(),
  RESEND_FROM_ADDRESS: z.string().optional(),
  RESEND_FALLBACK_FROM_ADDRESS: z.string().optional(),
  MCP_API_KEY: z.string(),
  // Slack
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  // Microsoft
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  // HubSpot
  HUBSPOT_CLIENT_ID: z.string().optional(),
  HUBSPOT_CLIENT_SECRET: z.string().optional(),
  // Salesforce
  SALESFORCE_CLIENT_ID: z.string().optional(),
  SALESFORCE_CLIENT_SECRET: z.string().optional(),
  // Attio
  ATTIO_CLIENT_ID: z.string().optional(),
  ATTIO_CLIENT_SECRET: z.string().optional(),
  // Pipedrive
  PIPEDRIVE_CLIENT_ID: z.string().optional(),
  PIPEDRIVE_CLIENT_SECRET: z.string().optional(),
  // Monday
  MONDAY_CLIENT_ID: z.string().optional(),
  MONDAY_CLIENT_SECRET: z.string().optional(),
  // Pusher/Soketi
  PUSHER_ENABLED: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
  PUSHER_APP_ID: z.string().default('app-id'),
  PUSHER_KEY: z.string().default('app-key'),
  PUSHER_SECRET: z.string().default('app-secret'),
  PUSHER_HOST: z.string().default('localhost'),
  PUSHER_PORT: z.coerce.number().default(6001),
  PUSHER_USE_TLS: z
    .string()
    .default('false')
    .transform((val) => val === 'true'),
})

const env = envSchema.parse(process.env)

const secretGenerationCommand: Record<
  'BETTER_AUTH_SECRET' | 'BETTER_AUTH_TOKEN' | 'ENCRYPTION_KEY',
  string
> = {
  BETTER_AUTH_SECRET: 'openssl rand -hex 32',
  BETTER_AUTH_TOKEN: 'openssl rand -base64 32',
  ENCRYPTION_KEY: 'openssl rand -hex 32',
}

const ensureRequiredProductionSecret = (
  key: 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_TOKEN' | 'ENCRYPTION_KEY',
  value: string | undefined,
) => {
  if (!value) {
    throw new Error(
      `${key} is required in production. Generate one with: ${secretGenerationCommand[key]}`,
    )
  }

  if (value.length < 32) {
    throw new Error(
      `${key} is too short (${value.length} chars). Use at least 32 chars; recommended: ${secretGenerationCommand[key]}`,
    )
  }
}

if (env.NODE_ENV === 'production') {
  ensureRequiredProductionSecret('BETTER_AUTH_SECRET', env.BETTER_AUTH_SECRET)
  ensureRequiredProductionSecret('BETTER_AUTH_TOKEN', env.BETTER_AUTH_TOKEN)
  ensureRequiredProductionSecret('ENCRYPTION_KEY', env.ENCRYPTION_KEY)
}

const deployEnv =
  env.DEPLOY_ENV ?? (env.NODE_ENV === 'production' ? 'prod' : 'dev')
const dbSslMode =
  env.DB_SSL_MODE ?? (deployEnv === 'dev' ? 'disable' : 'require')
const dbSslRejectUnauthorized =
  env.DB_SSL_REJECT_UNAUTHORIZED ?? deployEnv !== 'dev'

// Build Redis URL from individual variables or use REDIS_URL directly
const getRedisUrl = (): string => {
  if (env.REDIS_URL) {
    return env.REDIS_URL
  }
  if (env.REDIS_HOST && env.REDIS_PORT && env.REDIS_PASSWORD) {
    const protocol = env.REDIS_TLS ? 'rediss' : 'redis'
    return `${protocol}://default:${env.REDIS_PASSWORD}@${env.REDIS_HOST}:${env.REDIS_PORT}`
  }
  return 'redis://localhost:6379'
}

const toOrigin = (input: string): string | null => {
  try {
    return new URL(input).origin
  } catch {
    return null
  }
}

const withApexWwwAliases = (origin: string): string[] => {
  const normalized = toOrigin(origin)
  if (!normalized) {
    return []
  }

  const parsed = new URL(normalized)
  const hostname = parsed.hostname.toLowerCase()
  const originSet = new Set<string>([normalized])

  // Keep localhost/IP origins unchanged.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return [...originSet]
  }

  if (hostname.startsWith('www.')) {
    const apexHost = hostname.slice(4)
    originSet.add(
      `${parsed.protocol}//${apexHost}${parsed.port ? `:${parsed.port}` : ''}`,
    )
    return [...originSet]
  }

  // If this looks like an apex domain (example.com), also trust www.example.com.
  if (hostname.split('.').length === 2) {
    originSet.add(
      `${parsed.protocol}//www.${hostname}${parsed.port ? `:${parsed.port}` : ''}`,
    )
  }

  return [...originSet]
}

const getFrontendSiblingOrigins = (frontendUrl: string): string[] => {
  const normalized = toOrigin(frontendUrl)
  if (!normalized) {
    return []
  }

  const parsed = new URL(normalized)
  const hostname = parsed.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return []
  }

  const portSuffix = parsed.port ? `:${parsed.port}` : ''
  if (hostname.startsWith('app.')) {
    const apexHost = hostname.slice(4)
    if (!apexHost.includes('.')) {
      return []
    }
    return [
      `${parsed.protocol}//${apexHost}${portSuffix}`,
      `${parsed.protocol}//www.${apexHost}${portSuffix}`,
    ]
  }

  if (hostname.startsWith('www.')) {
    const apexHost = hostname.slice(4)
    if (!apexHost.includes('.')) {
      return []
    }
    return [`${parsed.protocol}//app.${apexHost}${portSuffix}`]
  }

  if (hostname.split('.').length === 2) {
    return [`${parsed.protocol}//app.${hostname}${portSuffix}`]
  }

  return []
}

const getTrustedOrigins = (
  corsOrigin: string | string[],
  frontendUrl: string,
): string[] => {
  const trusted = new Set<string>()
  const configuredOrigins =
    corsOrigin === '*'
      ? []
      : Array.isArray(corsOrigin)
        ? corsOrigin
        : [corsOrigin]
  const baseOrigins = [
    ...configuredOrigins,
    frontendUrl,
    ...getFrontendSiblingOrigins(frontendUrl),
  ]

  for (const origin of baseOrigins) {
    for (const candidate of withApexWwwAliases(origin)) {
      trusted.add(candidate)
    }
  }

  return [...trusted]
}

export const config = {
  deployEnv,
  webhookApiKey: env.WEBHOOK_API_KEY,
  jwt: {
    secret: env.JWT_SECRET,
  },
  betterAuthSecret: env.BETTER_AUTH_SECRET,
  betterAuthToken: env.BETTER_AUTH_TOKEN,
  encryptionKey: env.ENCRYPTION_KEY,
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  frontendUrl: env.FRONTEND_URL,
  backendUrl: env.BACKEND_URL,
  corsOrigin: env.CORS_ORIGIN,
  cookieDomain: env.COOKIE_DOMAIN,
  trustedOrigins: getTrustedOrigins(env.CORS_ORIGIN, env.FRONTEND_URL),
  databaseUrl: env.DATABASE_URL,
  db: {
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    sslMode: dbSslMode,
    sslRejectUnauthorized: dbSslRejectUnauthorized,
  },
  redis: {
    url: getRedisUrl(),
    // If REDIS_URL is provided, derive TLS from URL protocol; otherwise use REDIS_TLS env var
    useTLS: env.REDIS_URL
      ? getRedisUrl().startsWith('rediss://')
      : env.REDIS_TLS,
  },
  logger: {
    betterstackToken: env.BETTERSTACK_TOKEN,
    betterstackHost: env.BETTERSTACK_HOST,
    axiomDataset: env.AXIOM_DATASET,
    axiomToken: env.AXIOM_TOKEN,
  },
  sentry: {
    dsn: env.SENTRY_DSN,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
  },
  providers: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
    },
  },
  resend: {
    apiKey: env.RESEND_API_KEY,
    fromAddress: env.RESEND_FROM_ADDRESS,
    fallbackFromAddress: env.RESEND_FALLBACK_FROM_ADDRESS,
  },
  mcp: {
    apiKey: env.MCP_API_KEY,
  },
  slack: {
    clientId: env.SLACK_CLIENT_ID,
    clientSecret: env.SLACK_CLIENT_SECRET,
    signingSecret: env.SLACK_SIGNING_SECRET,
  },
  hubspot: {
    clientId: env.HUBSPOT_CLIENT_ID,
    clientSecret: env.HUBSPOT_CLIENT_SECRET,
  },
  salesforce: {
    clientId: env.SALESFORCE_CLIENT_ID,
    clientSecret: env.SALESFORCE_CLIENT_SECRET,
  },
  attio: {
    clientId: env.ATTIO_CLIENT_ID,
    clientSecret: env.ATTIO_CLIENT_SECRET,
  },
  pipedrive: {
    clientId: env.PIPEDRIVE_CLIENT_ID,
    clientSecret: env.PIPEDRIVE_CLIENT_SECRET,
  },
  monday: {
    clientId: env.MONDAY_CLIENT_ID,
    clientSecret: env.MONDAY_CLIENT_SECRET,
  },
  pusher: {
    enabled: env.PUSHER_ENABLED,
    appId: env.PUSHER_APP_ID,
    key: env.PUSHER_KEY,
    secret: env.PUSHER_SECRET,
    host: env.PUSHER_HOST,
    port: env.PUSHER_PORT,
    useTLS: env.PUSHER_USE_TLS,
  },
} as const

export type Config = typeof config

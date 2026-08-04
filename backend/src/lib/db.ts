import { Pool } from 'pg'
import { DB } from '@shared/db/src'
import { Kysely, PostgresDialect } from 'kysely'
import { config } from '@/config'
import { PrismaClient } from '@shared/db/src'

const isSupabaseHostname = (host: string): boolean =>
  host.endsWith('.supabase.com') || host.endsWith('.supabase.co')

const shouldUseDbTls =
  config.db.sslMode === 'require' || isSupabaseHostname(config.db.host)

const pool = new Pool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  ssl: shouldUseDbTls
    ? { rejectUnauthorized: config.db.sslRejectUnauthorized }
    : undefined,
  // Supabase session-mode pooler (port 5432) has a limited pool_size (~15-20).
  // Keep Kysely (8) + PrismaClient (5) = 13 within that limit.
  max: 8,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
})

pool.on('error', (err) => {
  console.error('[Kysely Pool] Unexpected error on idle client:', err.message)
})

const dialect = new PostgresDialect({ pool })

// Query logging configuration
const SLOW_QUERY_THRESHOLD_MS = 100 // Log queries slower than this
const isDev = config.nodeEnv === 'development'

export const db = new Kysely<DB>({
  dialect,
  log: isDev
    ? (event) => {
        if (event.level === 'query') {
          const durationMs = event.queryDurationMillis
          const isSlow = durationMs > SLOW_QUERY_THRESHOLD_MS

          if (isSlow) {
            console.warn(
              `🐢 SLOW QUERY (${durationMs.toFixed(1)}ms):`,
              event.query.sql,
            )
            console.warn('   Parameters:', event.query.parameters)
          } else if (process.env.LOG_ALL_QUERIES === 'true') {
            // Set LOG_ALL_QUERIES=true to see all queries (verbose)
            console.log(
              `📊 Query (${durationMs.toFixed(1)}ms):`,
              event.query.sql,
            )
          }
        } else if (event.level === 'error') {
          console.error('❌ Query Error:', event.error)
        }
      }
    : undefined,
})

// BetterAuth/Prisma requires session-mode pooler (port 5432) — transaction mode
// breaks interactive transactions. Force session-mode pooler in the URL regardless
// of env config, and cap the pool to 5 connections.
// Handles all Supabase pooler hostnames: pooler.supabase.com, transaction.supabase.com, etc.
const buildPrismaUrl = (databaseUrl: string): string => {
  try {
    const parsed = new URL(databaseUrl)
    const hostname = parsed.hostname.toLowerCase()
    const isSupabasePooler =
      hostname.includes('.pooler.supabase.com') ||
      hostname.includes('.transaction.supabase.com')
    const isSupabaseTxPort =
      /^db\.[^.]+\.supabase\.co$/.test(hostname) && parsed.port === '6543'

    if (hostname.includes('.transaction.supabase.com')) {
      parsed.hostname = hostname.replace(
        '.transaction.supabase.com',
        '.pooler.supabase.com',
      )
      parsed.port = '5432'
    } else if (isSupabasePooler && parsed.port !== '5432') {
      parsed.port = '5432'
    } else if (isSupabaseTxPort) {
      parsed.port = '5432'
    }

    if (
      (isSupabasePooler || isSupabaseTxPort) &&
      !parsed.searchParams.has('connection_limit')
    ) {
      parsed.searchParams.set('connection_limit', '5')
    }

    if (shouldUseDbTls && !parsed.searchParams.has('sslmode')) {
      parsed.searchParams.set('sslmode', 'require')
    }

    return parsed.toString()
  } catch {
    let fallbackUrl = databaseUrl
    fallbackUrl = fallbackUrl.replace(
      /[\w-]+\.(pooler|transaction)\.supabase\.com:\d+/,
      (match) => {
        const region = match.split('.')[0]
        return `${region}.pooler.supabase.com:5432`
      },
    )
    fallbackUrl = fallbackUrl.replace(/db\.[\w]+\.supabase\.co:6543/, (match) =>
      match.replace(':6543', ':5432'),
    )
    if (!fallbackUrl.includes('connection_limit=')) {
      fallbackUrl +=
        (fallbackUrl.includes('?') ? '&' : '?') + 'connection_limit=5'
    }
    if (shouldUseDbTls && !fallbackUrl.includes('sslmode=')) {
      fallbackUrl += (fallbackUrl.includes('?') ? '&' : '?') + 'sslmode=require'
    }
    return fallbackUrl
  }
}

const prismaUrl = (() => {
  return buildPrismaUrl(config.databaseUrl)
})()

export const prisma_OnlyForBetterAuth = new PrismaClient({
  datasources: {
    db: {
      url: prismaUrl,
    },
  },
  log: [
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
})

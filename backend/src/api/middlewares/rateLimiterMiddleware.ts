import { Request, Response, NextFunction } from 'express'
import { RedisRateLimiter } from '@/services/rate-limiter.service'
import { config } from '@/config'

const isProd = config.deployEnv === 'prod'

// Sign-in/sign-up rate limit per IP
const authSignInRateLimit = RedisRateLimiter.presets.perIP(
  isProd ? 300 : 60,
  isProd ? 10 : 30,
)

// Password reset & verification rate limit per IP
const authRecoveryRateLimit = RedisRateLimiter.presets.perIP(
  isProd ? 300 : 60,
  isProd ? 10 : 30,
)

// Paths that should use the recovery rate limit instead of the strict sign-in limit
const RECOVERY_PATHS = [
  '/forget-password',
  '/reset-password',
  '/send-verification-email',
  '/verify-email',
  '/magic-link',
]

// Skip rate limit for read-only auth endpoints (session checks, CSRF, etc.)
// Apply separate rate limit pools for sign-in vs recovery flows
export const authRateLimitIfMutation = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Only rate-limit POST requests
  // GET requests like get-session and get-csrf are read-only and should not be limited
  if (req.method !== 'POST') {
    return next()
  }

  // Magic-link issuance has dedicated per-IP/per-email/per-fingerprint controls.
  if (req.path.includes('/sign-in/magic-link')) {
    return next()
  }

  // Use a separate rate limit pool for password recovery and verification
  // so users locked out of sign-in can still reset their password
  const isRecoveryPath = RECOVERY_PATHS.some((p) => req.path.includes(p))
  if (isRecoveryPath) {
    return authRecoveryRateLimit(req, res, next)
  }

  return authSignInRateLimit(req, res, next)
}

// General API: 60 per min per user
export const generalApiRateLimit = RedisRateLimiter.presets.perUser(60, 60)

// Admin routes: 30 per min per user
export const adminRateLimit = RedisRateLimiter.presets.perUser(60, 30)

// Webhook endpoints: 100 per min per endpoint
export const webhookRateLimit = RedisRateLimiter.presets.perEndpoint(60, 100)

// Expensive operations: 10 per min per user (enrichment, research)
export const expensiveOperationRateLimit = RedisRateLimiter.presets.perUser(
  60,
  10,
)

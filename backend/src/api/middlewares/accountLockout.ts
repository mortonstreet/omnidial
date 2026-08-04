import { Request, Response, NextFunction } from 'express'
import { getRedis } from '@/lib/redis'
import logger from '@/lib/logger'

const MAX_ATTEMPTS = 5
const WINDOW_SECONDS = 900 // 15 minutes
const LOCKOUT_SECONDS = 1800 // 30 minutes

/**
 * Account lockout middleware for auth routes.
 * Tracks failed login attempts per IP and locks out after MAX_ATTEMPTS failures.
 * Only applies to sign-in endpoints (POST /email/sign-in).
 */
export const accountLockout = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Only apply to sign-in attempts
  const isEmailPasswordSignIn =
    req.method === 'POST' &&
    req.path.includes('/sign-in/email') &&
    !req.path.includes('/sign-in/magic-link')

  if (!isEmailPasswordSignIn) {
    return next()
  }

  const ip = req.ip || req.socket.remoteAddress || 'unknown'
  const email = req.body?.email?.toLowerCase()
  const key = email ? `login_lockout:${email}` : `login_lockout:ip:${ip}`

  try {
    const redis = getRedis()

    // Check if account is locked
    const lockKey = `${key}:locked`
    const isLocked = await redis.get(lockKey)
    if (isLocked) {
      const ttl = await redis.ttl(lockKey)
      logger.info({ email, ip }, 'Account lockout: request blocked')
      return res.status(429).json({
        error: 'Account temporarily locked',
        message: `Too many failed login attempts. Please try again in ${Math.ceil(ttl / 60)} minutes.`,
        retryAfter: ttl,
      })
    }

    // Intercept the response to track failures
    const originalJson = res.json.bind(res)
    res.json = function (body: any) {
      // If it's a sign-in failure (4xx status), increment counter
      if (res.statusCode >= 400 && res.statusCode < 500) {
        trackFailedAttempt(key, email, ip).catch((err) => {
          logger.error({ err }, 'Failed to track login attempt')
        })
      } else if (res.statusCode >= 200 && res.statusCode < 300) {
        // Successful login - clear the counter
        clearAttempts(key).catch(() => {})
      }
      return originalJson(body)
    }

    next()
  } catch (error) {
    // Fail open if Redis is down
    logger.error({ error }, 'Account lockout check failed, allowing request')
    next()
  }
}

async function trackFailedAttempt(
  key: string,
  email: string | undefined,
  ip: string,
) {
  const redis = getRedis()
  const attemptsKey = `${key}:attempts`
  const now = Date.now()

  const pipeline = redis.pipeline()
  pipeline.zremrangebyscore(attemptsKey, '-inf', now - WINDOW_SECONDS * 1000)
  pipeline.zadd(attemptsKey, now, `${now}-${Math.random()}`)
  pipeline.zcard(attemptsKey)
  pipeline.expire(attemptsKey, WINDOW_SECONDS)

  const results = await pipeline.exec()
  const attemptCount = (results?.[2]?.[1] as number) || 0

  if (attemptCount >= MAX_ATTEMPTS) {
    // Lock the account
    const lockKey = `${key}:locked`
    await redis.set(lockKey, '1', 'EX', LOCKOUT_SECONDS)
    logger.warn(
      { email, ip, attemptCount },
      'Account locked due to too many failed login attempts',
    )
  }
}

async function clearAttempts(key: string) {
  const redis = getRedis()
  await redis.del(`${key}:attempts`, `${key}:locked`)
}

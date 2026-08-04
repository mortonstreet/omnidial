import { getRedis } from '@/lib/redis'
import logger from '@/lib/logger'
import { createHash } from 'crypto'

export interface RateLimitOptions {
  windowSeconds: number
  maxRequests: number
  keyGenerator: (req: any) => string
  message?: string
  onLimitReached?: (req: any, res: any, rateLimitInfo: any) => void
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
}

const AUTH_SESSION_COOKIE_NAMES = [
  'better-auth.session_token',
  'better-auth.session-token',
  '__Secure-better-auth.session_token',
  '__Secure-better-auth.session-token',
]

const normalizeHeaderValue = (
  value: string | string[] | undefined,
): string | undefined => {
  if (!value) {
    return undefined
  }

  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

const hashIdentity = (value: string): string =>
  createHash('sha256').update(value).digest('hex').slice(0, 24)

const getCookieValue = (
  cookieHeader: string | undefined,
  cookieNames: string[],
): string | undefined => {
  if (!cookieHeader) {
    return undefined
  }

  const cookies = cookieHeader.split(';')

  for (const cookie of cookies) {
    const trimmed = cookie.trim()
    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const name = trimmed.slice(0, separatorIndex).trim()
    if (!cookieNames.includes(name)) {
      continue
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim()
    if (!rawValue) {
      return undefined
    }

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return undefined
}

const resolvePerUserIdentity = (req: any): string => {
  const userId = req.user?.id
  if (userId) {
    return `user:${userId}`
  }

  const authorization = normalizeHeaderValue(req.headers?.authorization)
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    const token = authorization.slice(7).trim()
    if (token) {
      return `bearer:${hashIdentity(token)}`
    }
  }

  const cookieHeader = normalizeHeaderValue(req.headers?.cookie)
  const sessionCookie = getCookieValue(cookieHeader, AUTH_SESSION_COOKIE_NAMES)
  if (sessionCookie) {
    return `session:${hashIdentity(sessionCookie)}`
  }

  const forwardedFor = normalizeHeaderValue(req.headers?.['x-forwarded-for'])
  const forwardedIp = forwardedFor?.split(',')[0]?.trim()
  const ip = req.ip || forwardedIp || req.connection?.remoteAddress || 'unknown'
  return `ip:${ip}`
}

export class RedisRateLimiter {
  /**
   * Creates a flexible Redis-based rate limiter
   * @param options Configuration options
   */
  static create(options: RateLimitOptions) {
    return async (req: any, res: any, next: any) => {
      const key = `rate_limit:${options.keyGenerator(req)}`
      const now = Date.now()
      const windowStart = now - options.windowSeconds * 1000

      try {
        // Use Redis pipeline for atomic operations
        const pipeline = getRedis().pipeline()

        // Generate a unique member ID for this request (store it for later removal if needed)
        const requestMember = `${now}-${Math.random()}`

        // Remove old entries outside the window
        pipeline.zremrangebyscore(key, '-inf', windowStart)

        // Count current requests in window
        pipeline.zcard(key)

        // Add current request with the stored member ID
        pipeline.zadd(key, now, requestMember)

        // Set expiration
        pipeline.expire(key, options.windowSeconds)

        const results = await pipeline.exec()
        const currentRequests = (results?.[1]?.[1] as number) || 0

        // Check if limit exceeded
        if (currentRequests >= options.maxRequests) {
          logger.info(`Rate limit exceeded for key: ${key}`)
          // Get the oldest request to calculate retry time
          const oldestRequest = await getRedis().zrange(key, 0, 0, 'WITHSCORES')
          const retryAfter =
            oldestRequest.length > 0
              ? Math.ceil(
                  (options.windowSeconds * 1000 -
                    (now - parseFloat(oldestRequest[1]))) /
                    1000,
                )
              : options.windowSeconds

          const rateLimitInfo = {
            limit: options.maxRequests,
            current: currentRequests,
            remaining: 0,
            resetTime: new Date(now + retryAfter * 1000),
            retryAfter,
          }

          // Custom handler if provided
          if (options.onLimitReached) {
            return options.onLimitReached(req, res, rateLimitInfo)
          }

          // Default response
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message:
              options.message ||
              `Too many requests. Please try again in ${retryAfter} seconds.`,
            retryAfter,
            limit: options.maxRequests,
            windowSeconds: options.windowSeconds,
          })
        }

        // Add rate limit info to response headers
        res.set({
          'X-RateLimit-Limit': options.maxRequests.toString(),
          'X-RateLimit-Remaining': (
            options.maxRequests -
            currentRequests -
            1
          ).toString(),
          'X-RateLimit-Reset': new Date(
            now + options.windowSeconds * 1000,
          ).toISOString(),
        })

        // Store original end function to conditionally count requests
        const originalEnd = res.end
        res.end = function (...args: any[]) {
          // Remove the request from count if it should be skipped
          if (
            (options.skipSuccessfulRequests && res.statusCode < 400) ||
            (options.skipFailedRequests && res.statusCode >= 400)
          ) {
            // Use the same requestMember that was added earlier
            getRedis().zrem(key, requestMember)
          }

          originalEnd.apply(res, args)
        }

        next()
      } catch (error) {
        console.error('Rate limit check failed:', error)
        // Fail open - allow request if Redis is down
        next()
      }
    }
  }

  /**
   * Pre-built rate limiters for common use cases
   */
  static presets = {
    // Per-user rate limiting
    perUser: (windowSeconds: number = 60, maxRequests: number = 1) =>
      RedisRateLimiter.create({
        windowSeconds,
        maxRequests,
        keyGenerator: (req) => resolvePerUserIdentity(req),
        message: `You can only make ${maxRequests} request(s) per ${windowSeconds} seconds`,
      }),

    // Per-IP rate limiting
    perIP: (windowSeconds: number = 60, maxRequests: number = 10) =>
      RedisRateLimiter.create({
        windowSeconds,
        maxRequests,
        keyGenerator: (req) => `ip:${req.ip || req.connection.remoteAddress}`,
        message: `Too many requests from this IP. Limit: ${maxRequests} per ${windowSeconds} seconds`,
      }),

    // Per-endpoint rate limiting
    perEndpoint: (windowSeconds: number = 60, maxRequests: number = 100) =>
      RedisRateLimiter.create({
        windowSeconds,
        maxRequests,
        keyGenerator: (req) =>
          `endpoint:${req.method}:${req.route?.path || req.path}`,
        message: `This endpoint is temporarily overloaded. Please try again later.`,
      }),

    // Combined user + endpoint
    perUserEndpoint: (windowSeconds: number = 60, maxRequests: number = 5) =>
      RedisRateLimiter.create({
        windowSeconds,
        maxRequests,
        keyGenerator: (req) =>
          `user_endpoint:${req.user?.id}:${req.route?.path || req.path}`,
        message: `You're making too many requests to this endpoint`,
      }),
  }
}

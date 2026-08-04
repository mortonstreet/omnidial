import { db } from '@/lib/db'
import logger from '@/lib/logger'
import { getRedis } from '@/lib/redis'
import { config } from '@/config'
import { createHash, randomUUID } from 'crypto'
import { NextFunction, Request, Response } from 'express'

const MAGIC_LINK_SIGN_IN_PATH = '/sign-in/magic-link'
const MAGIC_LINK_VERIFY_PATH = '/magic-link/verify'
const SOCIAL_SIGN_IN_PATH = '/sign-in/social'

const CALLBACK_DEFAULT_PATH = '/dashboard'

const MAGIC_LINK_LIMITS =
  config.deployEnv === 'prod'
    ? {
        perIp: { windowSeconds: 300, max: 10 },
        perEmail: { windowSeconds: 600, max: 5 },
        perEmailIp: { windowSeconds: 600, max: 5 },
        cooldownSeconds: 30,
        replayTtlSeconds: 24 * 60 * 60,
      }
    : {
        perIp: { windowSeconds: 60, max: 30 },
        perEmail: { windowSeconds: 60, max: 20 },
        perEmailIp: { windowSeconds: 60, max: 20 },
        cooldownSeconds: 5,
        replayTtlSeconds: 24 * 60 * 60,
      }

type AuthErrorCode =
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_CONSUMED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_RATE_LIMITED'
  | 'AUTH_INVITE_EMAIL_MISMATCH'
  | 'AUTH_INVITE_INVALID'
  | 'AUTH_CALLBACK_REJECTED'
  | 'AUTH_ACTIVE_ORG_INVALID'
  | 'AUTH_FAILURE_TRANSIENT'

type CallbackSanitizationReason =
  | 'missing'
  | 'empty'
  | 'absolute_not_allowed'
  | 'protocol_relative_not_allowed'
  | 'invalid_relative_format'
  | 'path_not_allowlisted'
  | 'invalid_invitation_id'
  | 'invitation_not_pending'
  | 'invitation_lookup_failed'

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_TOKEN_EXPIRED:
    'This sign-in link has expired. Please request a new one.',
  AUTH_TOKEN_CONSUMED:
    'This sign-in link has already been used. Please request a new one.',
  AUTH_TOKEN_INVALID: 'This sign-in link is invalid. Please request a new one.',
  AUTH_RATE_LIMITED:
    'Too many sign-in attempts. Please wait before requesting another link.',
  AUTH_INVITE_EMAIL_MISMATCH:
    'Please sign in with the email address that received this invitation.',
  AUTH_INVITE_INVALID:
    'This invitation is invalid or expired. Please request a new invitation.',
  AUTH_CALLBACK_REJECTED:
    'Invalid redirect target was rejected for your safety.',
  AUTH_ACTIVE_ORG_INVALID:
    'Your active workspace is no longer valid. Please choose another workspace.',
  AUTH_FAILURE_TRANSIENT:
    'Authentication is temporarily unavailable. Please try again with the correlation ID.',
}

const LEGACY_TOKEN_ERROR_TO_AUTH_CODE: Record<string, AuthErrorCode> = {
  EXPIRED_TOKEN: 'AUTH_TOKEN_EXPIRED',
  INVALID_TOKEN: 'AUTH_TOKEN_INVALID',
}

const getRequestIp = (req: Request): string =>
  req.ip || req.socket.remoteAddress || 'unknown'

const getCorrelationId = (req: Request, res: Response): string => {
  const requestHeader = req.headers['x-request-id']
  if (typeof requestHeader === 'string' && requestHeader.length > 0) {
    return requestHeader
  }

  const responseHeader = res.getHeader('x-request-id')
  if (typeof responseHeader === 'string' && responseHeader.length > 0) {
    return responseHeader
  }

  return randomUUID()
}

const hashValue = (value: string) =>
  createHash('sha256').update(value).digest('hex')

const hashMagicTokenLikeBetterAuth = (token: string) => {
  const digest = createHash('sha256').update(token).digest('base64')
  return digest.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const normalizeEmail = (input: unknown): string | null => {
  if (typeof input !== 'string') return null
  const normalized = input.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const buildAuthErrorPayload = (
  code: AuthErrorCode,
  correlationId: string,
  retryAfter?: number,
) => ({
  error: code,
  code,
  retryable: code === 'AUTH_RATE_LIMITED' || code === 'AUTH_FAILURE_TRANSIENT',
  userMessage: AUTH_ERROR_MESSAGES[code],
  message: AUTH_ERROR_MESSAGES[code],
  correlationId,
  ...(typeof retryAfter === 'number' && retryAfter > 0 ? { retryAfter } : {}),
})

const sendAuthError = (
  res: Response,
  status: number,
  code: AuthErrorCode,
  correlationId: string,
  retryAfter?: number,
) => {
  if (typeof retryAfter === 'number' && retryAfter > 0) {
    res.setHeader('Retry-After', String(retryAfter))
  }
  return res
    .status(status)
    .json(buildAuthErrorPayload(code, correlationId, retryAfter))
}

const isAllowedCallbackPath = (pathname: string): boolean => {
  if (pathname === '/dashboard' || pathname === '/onboarding') {
    return true
  }
  return /^\/accept-invitation\/[a-zA-Z0-9_-]+$/.test(pathname)
}

const extractInvitationId = (pathname: string): string | null => {
  const match = pathname.match(/^\/accept-invitation\/([a-zA-Z0-9_-]+)$/)
  return match?.[1] ?? null
}

const isAbsoluteUrl = (value: string): boolean =>
  /^[a-z][a-z\d+\-.]*:/i.test(value)

const normalizeAllowedCallbackPath = (
  pathname: string,
  searchParams: URLSearchParams,
): string => {
  if (pathname === '/dashboard' || pathname === '/onboarding') {
    return pathname
  }
  const email = searchParams.get('email')
  if (email) {
    return `${pathname}?email=${encodeURIComponent(email)}`
  }
  return pathname
}

const isValidPendingInvitation = async (
  invitationId: string,
): Promise<boolean> => {
  const invitation = await db
    .selectFrom('invitation')
    .select('id')
    .where('id', '=', invitationId)
    .where('status', '=', 'pending')
    .where('expiresAt', '>', new Date())
    .executeTakeFirst()

  return Boolean(invitation)
}

type CallbackSanitizationResult = {
  relativePath: string
  rejected: boolean
  reason: CallbackSanitizationReason
}

const sanitizeRelativeCallback = async (
  input: unknown,
): Promise<CallbackSanitizationResult> => {
  if (typeof input !== 'string') {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: false,
      reason: 'missing',
    }
  }

  const candidate = input.trim()
  if (!candidate) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'empty',
    }
  }

  if (candidate.startsWith('//')) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'protocol_relative_not_allowed',
    }
  }

  if (isAbsoluteUrl(candidate)) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'absolute_not_allowed',
    }
  }

  if (!candidate.startsWith('/')) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'invalid_relative_format',
    }
  }

  let parsed: URL
  try {
    parsed = new URL(candidate, 'http://callback.local')
  } catch {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'invalid_relative_format',
    }
  }

  if (!isAllowedCallbackPath(parsed.pathname)) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'path_not_allowlisted',
    }
  }

  const invitationId = extractInvitationId(parsed.pathname)
  if (invitationId) {
    try {
      const isPending = await isValidPendingInvitation(invitationId)
      if (!isPending) {
        return {
          relativePath: CALLBACK_DEFAULT_PATH,
          rejected: true,
          reason: 'invitation_not_pending',
        }
      }
    } catch {
      return {
        relativePath: CALLBACK_DEFAULT_PATH,
        rejected: true,
        reason: 'invitation_lookup_failed',
      }
    }
  }

  return {
    relativePath: normalizeAllowedCallbackPath(
      parsed.pathname,
      parsed.searchParams,
    ),
    rejected: false,
    reason: 'missing',
  }
}

const sanitizeVerifyCallback = async (
  input: unknown,
): Promise<CallbackSanitizationResult> => {
  if (typeof input !== 'string') {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: false,
      reason: 'missing',
    }
  }

  const candidate = input.trim()
  if (!candidate) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'empty',
    }
  }

  if (candidate.startsWith('//')) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'protocol_relative_not_allowed',
    }
  }

  let parsed: URL
  try {
    if (isAbsoluteUrl(candidate)) {
      parsed = new URL(candidate)
      const frontendOrigin = new URL(config.frontendUrl).origin
      if (parsed.origin !== frontendOrigin) {
        return {
          relativePath: CALLBACK_DEFAULT_PATH,
          rejected: true,
          reason: 'absolute_not_allowed',
        }
      }
      parsed = new URL(`${parsed.pathname}${parsed.search}`, 'http://local')
    } else {
      if (!candidate.startsWith('/')) {
        return {
          relativePath: CALLBACK_DEFAULT_PATH,
          rejected: true,
          reason: 'invalid_relative_format',
        }
      }
      parsed = new URL(candidate, 'http://local')
    }
  } catch {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'invalid_relative_format',
    }
  }

  if (!isAllowedCallbackPath(parsed.pathname)) {
    return {
      relativePath: CALLBACK_DEFAULT_PATH,
      rejected: true,
      reason: 'path_not_allowlisted',
    }
  }

  const invitationId = extractInvitationId(parsed.pathname)
  if (invitationId) {
    try {
      const isPending = await isValidPendingInvitation(invitationId)
      if (!isPending) {
        return {
          relativePath: CALLBACK_DEFAULT_PATH,
          rejected: true,
          reason: 'invitation_not_pending',
        }
      }
    } catch {
      return {
        relativePath: CALLBACK_DEFAULT_PATH,
        rejected: true,
        reason: 'invitation_lookup_failed',
      }
    }
  }

  return {
    relativePath: normalizeAllowedCallbackPath(
      parsed.pathname,
      parsed.searchParams,
    ),
    rejected: false,
    reason: 'missing',
  }
}

const toFrontendAbsoluteUrl = (relativePath: string): string =>
  new URL(relativePath, config.frontendUrl).toString()

const getRetryAfterFromOldest = async (
  key: string,
  nowMs: number,
  windowSeconds: number,
) => {
  const oldestRequest = await getRedis().zrange(key, 0, 0, 'WITHSCORES')
  if (oldestRequest.length < 2) return windowSeconds
  const oldestTimestamp = Number(oldestRequest[1]) || nowMs
  const remainingMs = windowSeconds * 1000 - (nowMs - oldestTimestamp)
  return Math.max(1, Math.ceil(remainingMs / 1000))
}

const enforceWindowLimit = async (
  key: string,
  windowSeconds: number,
  max: number,
) => {
  const nowMs = Date.now()
  const windowStart = nowMs - windowSeconds * 1000
  const member = `${nowMs}-${Math.random()}`

  const pipeline = getRedis().pipeline()
  pipeline.zremrangebyscore(key, '-inf', windowStart)
  pipeline.zcard(key)
  pipeline.zadd(key, nowMs, member)
  pipeline.expire(key, windowSeconds)
  const results = await pipeline.exec()

  const currentCount = (results?.[1]?.[1] as number) || 0
  if (currentCount >= max) {
    const retryAfter = await getRetryAfterFromOldest(key, nowMs, windowSeconds)
    return { allowed: false, retryAfter }
  }

  return { allowed: true, retryAfter: 0 }
}

const getMagicLinkConsumedKey = (token: string): string =>
  `auth:magic:consumed:${hashValue(token)}`

const getRedirectTargetFromRequest = async (req: Request) => {
  const errorCallbackResult = await sanitizeVerifyCallback(
    req.query.errorCallbackURL,
  )
  if (errorCallbackResult.relativePath !== CALLBACK_DEFAULT_PATH) {
    return errorCallbackResult.relativePath
  }

  const callbackResult = await sanitizeVerifyCallback(req.query.callbackURL)
  return callbackResult.relativePath
}

const redirectToAuthError = async (
  req: Request,
  res: Response,
  code: AuthErrorCode,
  correlationId: string,
  retryAfter?: number,
) => {
  const targetPath = await getRedirectTargetFromRequest(req)
  const redirectUrl = new URL(targetPath, config.frontendUrl)
  redirectUrl.searchParams.set('authError', code)
  redirectUrl.searchParams.set('correlationId', correlationId)
  if (typeof retryAfter === 'number' && retryAfter > 0) {
    redirectUrl.searchParams.set('retryAfter', String(retryAfter))
  }
  return res.redirect(302, redirectUrl.toString())
}

export const authCallbackGuard = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (
    req.method !== 'POST' ||
    (!req.path.startsWith(MAGIC_LINK_SIGN_IN_PATH) &&
      !req.path.startsWith(SOCIAL_SIGN_IN_PATH))
  ) {
    return next()
  }

  const correlationId = getCorrelationId(req, res)
  const callbackFields = [
    'callbackURL',
    'newUserCallbackURL',
    'errorCallbackURL',
  ] as const
  const requestBody =
    req.body && typeof req.body === 'object' && !Array.isArray(req.body)
      ? (req.body as Record<string, unknown>)
      : {}
  req.body = requestBody as Request['body']

  for (const field of callbackFields) {
    const rawValue = requestBody[field]

    if (
      field !== 'callbackURL' &&
      (typeof rawValue !== 'string' || rawValue.trim().length === 0)
    ) {
      continue
    }

    const result = await sanitizeRelativeCallback(rawValue)
    requestBody[field] = toFrontendAbsoluteUrl(result.relativePath)

    if (result.rejected) {
      logger.warn(
        {
          event: 'auth.callback.rejected',
          correlationId,
          field,
          reason: result.reason,
          rawValue,
          path: req.path,
          method: req.method,
        },
        'Rejected unsafe auth callback and replaced with safe default',
      )
    }
  }

  return next()
}

// ─── Redis Timeout Helper ────────────────────────────────────────────────────

const REDIS_OP_TIMEOUT_MS = 2000

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Redis operation timeout')),
      timeoutMs,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })

// ─── In-Memory Rate Limiter Fallback ─────────────────────────────────────────

const inMemoryWindows = new Map<string, number[]>()
const inMemoryCooldowns = new Map<string, number>()
const IN_MEMORY_MAX_ENTRIES = 10_000

setInterval(() => {
  const now = Date.now()
  for (const [key, timestamps] of inMemoryWindows.entries()) {
    if (timestamps.every((ts) => now - ts > 600_000)) {
      inMemoryWindows.delete(key)
    }
  }
  for (const [key, expiresAt] of inMemoryCooldowns.entries()) {
    if (now > expiresAt) {
      inMemoryCooldowns.delete(key)
    }
  }
}, 60_000).unref()

const inMemoryCheckCooldown = (key: string): number => {
  const expiresAt = inMemoryCooldowns.get(key)
  if (!expiresAt) return 0
  const remaining = Math.ceil((expiresAt - Date.now()) / 1000)
  if (remaining <= 0) {
    inMemoryCooldowns.delete(key)
    return 0
  }
  return remaining
}

const inMemorySetCooldown = (key: string, seconds: number): void => {
  inMemoryCooldowns.set(key, Date.now() + seconds * 1000)
}

const inMemoryEnforceLimit = (
  key: string,
  windowSeconds: number,
  max: number,
): { allowed: boolean } => {
  const now = Date.now()
  const windowMs = windowSeconds * 1000
  let timestamps = inMemoryWindows.get(key)

  if (!timestamps) {
    if (inMemoryWindows.size >= IN_MEMORY_MAX_ENTRIES) {
      const oldestKey = inMemoryWindows.keys().next().value
      if (oldestKey) inMemoryWindows.delete(oldestKey)
    }
    inMemoryWindows.set(key, [now])
    return { allowed: true }
  }

  timestamps = timestamps.filter((ts) => now - ts < windowMs)
  timestamps.push(now)
  inMemoryWindows.set(key, timestamps)

  return { allowed: timestamps.length <= max }
}

// ─── Magic Link Abuse Protection Middleware ──────────────────────────────────

export const magicLinkAbuseProtection = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method !== 'POST' || !req.path.startsWith(MAGIC_LINK_SIGN_IN_PATH)) {
    return next()
  }

  const correlationId = getCorrelationId(req, res)
  res.setHeader('x-request-id', correlationId)
  const ip = getRequestIp(req)
  const email = normalizeEmail(req.body?.email)
  if (email) {
    req.body.email = email
  }

  if (!email) {
    return next()
  }

  const emailKey = hashValue(email)
  const ipHash = hashValue(ip)
  const emailIpHash = hashValue(`${email}|${ip}`)
  const emailKeyPrefix = `auth:magic:req:email:${emailKey}`
  const ipKeyPrefix = `auth:magic:req:ip:${ipHash}`
  const emailIpKeyPrefix = `auth:magic:req:email-ip:${emailIpHash}`
  const cooldownKey = `${emailKeyPrefix}:cooldown`

  // ─── Try Redis-based rate limiting with timeout ─────────────────────────
  try {
    const cooldownTtl = await withTimeout(
      getRedis().ttl(cooldownKey),
      REDIS_OP_TIMEOUT_MS,
    )
    if (cooldownTtl > 0) {
      logger.info(
        {
          event: 'auth.magic.rate_limited',
          correlationId,
          reason: 'cooldown',
          limiter: 'redis',
          ipHash,
          emailHash: emailKey,
          retryAfter: cooldownTtl,
        },
        'Blocked magic link request due to resend cooldown',
      )
      return sendAuthError(
        res,
        429,
        'AUTH_RATE_LIMITED',
        correlationId,
        cooldownTtl,
      )
    }

    const ipLimit = await withTimeout(
      enforceWindowLimit(
        ipKeyPrefix,
        MAGIC_LINK_LIMITS.perIp.windowSeconds,
        MAGIC_LINK_LIMITS.perIp.max,
      ),
      REDIS_OP_TIMEOUT_MS,
    )
    if (!ipLimit.allowed) {
      logger.warn(
        {
          event: 'auth.magic.rate_limited',
          correlationId,
          reason: 'ip',
          limiter: 'redis',
          ipHash,
          emailHash: emailKey,
          retryAfter: ipLimit.retryAfter,
        },
        'Blocked magic link request due to per-IP rate limit',
      )
      return sendAuthError(
        res,
        429,
        'AUTH_RATE_LIMITED',
        correlationId,
        ipLimit.retryAfter,
      )
    }

    const emailLimit = await withTimeout(
      enforceWindowLimit(
        emailKeyPrefix,
        MAGIC_LINK_LIMITS.perEmail.windowSeconds,
        MAGIC_LINK_LIMITS.perEmail.max,
      ),
      REDIS_OP_TIMEOUT_MS,
    )
    if (!emailLimit.allowed) {
      logger.warn(
        {
          event: 'auth.magic.rate_limited',
          correlationId,
          reason: 'email',
          limiter: 'redis',
          ipHash,
          emailHash: emailKey,
          retryAfter: emailLimit.retryAfter,
        },
        'Blocked magic link request due to per-email rate limit',
      )
      return sendAuthError(
        res,
        429,
        'AUTH_RATE_LIMITED',
        correlationId,
        emailLimit.retryAfter,
      )
    }

    const emailIpLimit = await withTimeout(
      enforceWindowLimit(
        emailIpKeyPrefix,
        MAGIC_LINK_LIMITS.perEmailIp.windowSeconds,
        MAGIC_LINK_LIMITS.perEmailIp.max,
      ),
      REDIS_OP_TIMEOUT_MS,
    )
    if (!emailIpLimit.allowed) {
      logger.warn(
        {
          event: 'auth.magic.rate_limited',
          correlationId,
          reason: 'email_ip',
          limiter: 'redis',
          ipHash,
          emailHash: emailKey,
          retryAfter: emailIpLimit.retryAfter,
        },
        'Blocked magic link request due to email+IP rate limit',
      )
      return sendAuthError(
        res,
        429,
        'AUTH_RATE_LIMITED',
        correlationId,
        emailIpLimit.retryAfter,
      )
    }

    // Redis rate limiting passed - set cooldown on response finish
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 400) {
        try {
          getRedis()
            .set(cooldownKey, '1', 'EX', MAGIC_LINK_LIMITS.cooldownSeconds)
            .catch((error) => {
              logger.error(
                {
                  event: 'auth.magic.cooldown_set_failed',
                  correlationId,
                  error,
                  emailHash: emailKey,
                  ipHash,
                },
                'Failed to set magic link cooldown key',
              )
            })
        } catch (error) {
          logger.error(
            {
              event: 'auth.magic.cooldown_set_failed',
              correlationId,
              error,
              emailHash: emailKey,
              ipHash,
            },
            'Failed to initialize Redis client for cooldown key',
          )
        }
      }
    })

    logger.info(
      {
        event: 'auth.magic.rate_check_passed',
        correlationId,
        limiter: 'redis',
        ipHash,
        emailHash: emailKey,
      },
      'Magic link rate check passed (Redis)',
    )
    return next()
  } catch (error) {
    logger.warn(
      {
        event: 'auth.magic.abuse_protection_degraded',
        correlationId,
        error: error instanceof Error ? error.message : String(error),
        path: req.path,
        method: req.method,
        ipHash,
        emailHash: emailKey,
      },
      'Redis unavailable for magic link rate limiting, using in-memory fallback',
    )
  }

  // ─── In-memory fallback rate limiting ──────────────────────────────────
  const cooldownRemaining = inMemoryCheckCooldown(cooldownKey)
  if (cooldownRemaining > 0) {
    logger.info(
      {
        event: 'auth.magic.rate_limited',
        correlationId,
        reason: 'cooldown',
        limiter: 'memory',
        ipHash,
        emailHash: emailKey,
        retryAfter: cooldownRemaining,
      },
      'Blocked magic link request due to resend cooldown (in-memory)',
    )
    return sendAuthError(
      res,
      429,
      'AUTH_RATE_LIMITED',
      correlationId,
      cooldownRemaining,
    )
  }

  const ipAllowed = inMemoryEnforceLimit(
    ipKeyPrefix,
    MAGIC_LINK_LIMITS.perIp.windowSeconds,
    MAGIC_LINK_LIMITS.perIp.max,
  )
  if (!ipAllowed.allowed) {
    logger.warn(
      {
        event: 'auth.magic.rate_limited',
        correlationId,
        reason: 'ip',
        limiter: 'memory',
        ipHash,
        emailHash: emailKey,
      },
      'Blocked magic link request due to per-IP rate limit (in-memory)',
    )
    return sendAuthError(res, 429, 'AUTH_RATE_LIMITED', correlationId, 60)
  }

  const emailAllowed = inMemoryEnforceLimit(
    emailKeyPrefix,
    MAGIC_LINK_LIMITS.perEmail.windowSeconds,
    MAGIC_LINK_LIMITS.perEmail.max,
  )
  if (!emailAllowed.allowed) {
    logger.warn(
      {
        event: 'auth.magic.rate_limited',
        correlationId,
        reason: 'email',
        limiter: 'memory',
        ipHash,
        emailHash: emailKey,
      },
      'Blocked magic link request due to per-email rate limit (in-memory)',
    )
    return sendAuthError(res, 429, 'AUTH_RATE_LIMITED', correlationId, 60)
  }

  const emailIpAllowed = inMemoryEnforceLimit(
    emailIpKeyPrefix,
    MAGIC_LINK_LIMITS.perEmailIp.windowSeconds,
    MAGIC_LINK_LIMITS.perEmailIp.max,
  )
  if (!emailIpAllowed.allowed) {
    logger.warn(
      {
        event: 'auth.magic.rate_limited',
        correlationId,
        reason: 'email_ip',
        limiter: 'memory',
        ipHash,
        emailHash: emailKey,
      },
      'Blocked magic link request due to email+IP rate limit (in-memory)',
    )
    return sendAuthError(res, 429, 'AUTH_RATE_LIMITED', correlationId, 60)
  }

  // Set in-memory cooldown on response finish
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) {
      inMemorySetCooldown(cooldownKey, MAGIC_LINK_LIMITS.cooldownSeconds)
    }
  })

  logger.info(
    {
      event: 'auth.magic.rate_check_passed',
      correlationId,
      limiter: 'memory',
      ipHash,
      emailHash: emailKey,
    },
    'Magic link rate check passed (in-memory fallback)',
  )
  return next()
}

export const magicLinkVerifyHardening = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (req.method !== 'GET' || !req.path.startsWith(MAGIC_LINK_VERIFY_PATH)) {
    return next()
  }

  const correlationId = getCorrelationId(req, res)
  const token = typeof req.query.token === 'string' ? req.query.token : null

  if (!token) {
    logger.warn(
      {
        event: 'auth.magic.invalid',
        correlationId,
        reason: 'missing_token',
      },
      'Rejected magic link verify request with missing token',
    )
    return redirectToAuthError(req, res, 'AUTH_TOKEN_INVALID', correlationId)
  }

  try {
    const replayKey = getMagicLinkConsumedKey(token)
    const replayed = await getRedis().get(replayKey)
    if (replayed) {
      logger.warn(
        {
          event: 'auth.magic.replay',
          correlationId,
          ipHash: hashValue(getRequestIp(req)),
          tokenHash: hashValue(token),
        },
        'Rejected replayed magic link token',
      )
      return redirectToAuthError(req, res, 'AUTH_TOKEN_CONSUMED', correlationId)
    }

    const candidateTokenValues = [token, hashMagicTokenLikeBetterAuth(token)]
    const verificationRecord = await db
      .selectFrom('verification')
      .select(['id', 'expiresAt'])
      .where((eb) =>
        eb.or([
          eb('value', 'in', candidateTokenValues),
          // Backward-compatibility for legacy records that may have stored token in identifier.
          eb('identifier', 'in', candidateTokenValues),
        ]),
      )
      .orderBy('expiresAt', 'desc')
      .executeTakeFirst()

    if (!verificationRecord) {
      logger.warn(
        {
          event: 'auth.magic.invalid',
          correlationId,
          ipHash: hashValue(getRequestIp(req)),
          tokenHash: hashValue(token),
        },
        'Rejected invalid magic link token',
      )
      return redirectToAuthError(req, res, 'AUTH_TOKEN_INVALID', correlationId)
    }

    if (verificationRecord.expiresAt < new Date()) {
      await db
        .deleteFrom('verification')
        .where('id', '=', verificationRecord.id)
        .executeTakeFirst()

      logger.warn(
        {
          event: 'auth.magic.expired',
          correlationId,
          ipHash: hashValue(getRequestIp(req)),
          tokenHash: hashValue(token),
        },
        'Rejected expired magic link token',
      )
      return redirectToAuthError(req, res, 'AUTH_TOKEN_EXPIRED', correlationId)
    }

    res.on('finish', () => {
      const locationHeader = res.getHeader('location')
      const location =
        typeof locationHeader === 'string' ? locationHeader : undefined
      const isRedirectWithError =
        typeof location === 'string' &&
        (location.includes('error=') || location.includes('authError='))

      if (
        res.statusCode >= 200 &&
        res.statusCode < 400 &&
        !isRedirectWithError
      ) {
        try {
          getRedis()
            .set(replayKey, '1', 'EX', MAGIC_LINK_LIMITS.replayTtlSeconds)
            .catch((error) => {
              logger.error(
                {
                  event: 'auth.magic.replay_key_failed',
                  correlationId,
                  error,
                  tokenHash: hashValue(token),
                },
                'Failed to mark magic link token as consumed',
              )
            })
        } catch (error) {
          logger.error(
            {
              event: 'auth.magic.replay_key_failed',
              correlationId,
              error,
              tokenHash: hashValue(token),
            },
            'Failed to initialize Redis client for replay key write',
          )
        }
      } else if (typeof location === 'string') {
        try {
          const parsedLocation = new URL(location, config.frontendUrl)
          const legacyErrorCode = parsedLocation.searchParams.get('error')
          if (legacyErrorCode) {
            const mappedCode =
              LEGACY_TOKEN_ERROR_TO_AUTH_CODE[legacyErrorCode] ??
              'AUTH_TOKEN_INVALID'
            logger.warn(
              {
                event:
                  mappedCode === 'AUTH_TOKEN_EXPIRED'
                    ? 'auth.magic.expired'
                    : 'auth.magic.invalid',
                correlationId,
                tokenHash: hashValue(token),
                legacyErrorCode,
              },
              'Magic link verification failed with legacy error',
            )
          }
        } catch {
          // Ignore malformed location headers from downstream responses
        }
      }
    })

    return next()
  } catch (error) {
    logger.error(
      {
        event: 'auth.failure.transient',
        correlationId,
        error,
        tokenHash: hashValue(token),
      },
      'Magic link verify hardening failed',
    )
    return redirectToAuthError(
      req,
      res,
      'AUTH_FAILURE_TRANSIENT',
      correlationId,
      30,
    )
  }
}

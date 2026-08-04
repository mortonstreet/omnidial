import { toNodeHandler } from 'better-auth/node'
import { auth } from '@/lib/better-auth'
import { Router } from 'express'
import logger from '@/lib/logger'
import { randomUUID } from 'crypto'
import {
  authCallbackGuard,
  magicLinkAbuseProtection,
  magicLinkVerifyHardening,
} from '@/api/middlewares/authHardening'

const router = Router()
const authHandler = toNodeHandler(auth)

// Ensure every auth request has a correlation ID from the start
router.use((req, res, next) => {
  if (!res.getHeader('x-request-id')) {
    const requestId =
      typeof req.headers['x-request-id'] === 'string' &&
      req.headers['x-request-id'].length > 0
        ? req.headers['x-request-id']
        : randomUUID()
    res.setHeader('x-request-id', requestId)
  }
  next()
})

router.use(authCallbackGuard)
router.use(magicLinkAbuseProtection)
router.use(magicLinkVerifyHardening)
router.all('/*splat', async (req, res, next) => {
  const getCorrelationId = () => {
    const responseHeader = res.getHeader('x-request-id')
    if (typeof responseHeader === 'string' && responseHeader.length > 0) {
      return responseHeader
    }
    const requestHeader = req.headers['x-request-id']
    if (typeof requestHeader === 'string' && requestHeader.length > 0) {
      return requestHeader
    }
    return randomUUID()
  }

  const isMagicLinkIssuance =
    req.method === 'POST' && req.path.startsWith('/sign-in/magic-link')

  if (isMagicLinkIssuance) {
    logger.info(
      {
        event: 'auth.magic.handler_entry',
        correlationId: getCorrelationId(),
        method: req.method,
        path: req.path,
      },
      'Magic link request reached auth handler',
    )
  }

  // Intercept response to log errors from better-auth (which handles them internally)
  const originalEnd = res.end.bind(res)
  let magicLinkRewriteApplied = false
  res.end = function (...args: Parameters<typeof res.end>) {
    if (res.writableEnded) {
      return res
    }

    if (
      isMagicLinkIssuance &&
      res.statusCode >= 500 &&
      !magicLinkRewriteApplied &&
      !res.headersSent
    ) {
      magicLinkRewriteApplied = true
      const originalStatusCode = res.statusCode
      const correlationId = getCorrelationId()
      const payload = JSON.stringify({
        error: 'AUTH_FAILURE_TRANSIENT',
        code: 'AUTH_FAILURE_TRANSIENT',
        retryable: true,
        userMessage:
          'Unable to send sign-in email right now. Please try again shortly.',
        message:
          'Unable to send sign-in email right now. Please try again shortly.',
        correlationId,
      })

      res.statusCode = 503
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')

      logger.error(
        {
          event: 'auth.magic.response_rewritten',
          correlationId,
          originalStatusCode,
          method: req.method,
          path: req.path,
        },
        'Rewrote magic-link issuance 5xx response to deterministic transient auth error',
      )

      return originalEnd(payload)
    }

    if (
      isMagicLinkIssuance &&
      res.statusCode >= 500 &&
      !magicLinkRewriteApplied &&
      res.headersSent
    ) {
      logger.error(
        {
          event: 'auth.magic.response_rewrite_skipped',
          correlationId: getCorrelationId(),
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
        },
        'Skipped magic-link 5xx response rewrite because headers were already sent',
      )
    }

    if (res.statusCode >= 400) {
      logger.error(
        {
          event: 'auth.handler.response_error',
          statusCode: res.statusCode,
          method: req.method,
          path: req.path,
          body: req.body,
        },
        `Auth handler returned ${res.statusCode} for ${req.method} ${req.path}`,
      )
    }
    return originalEnd(...args)
  } as typeof res.end

  try {
    await authHandler(req, res)
  } catch (error) {
    logger.error(
      {
        event: 'auth.handler.uncaught',
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        method: req.method,
        path: req.path,
      },
      'Uncaught error from auth handler',
    )
    next(error)
  }
})

export default router

import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'
import logger from '@/lib/logger'
import { asyncLocalStorage } from '@/lib/context'
import Sentry from '@/lib/sentry'

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'api_key',
  'secret',
  'authToken',
  'authTokenEncrypted',
  'authorization',
  'creditCard',
  'ssn',
  'encryptionKey',
])

function sanitizeBody(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body
  if (Array.isArray(body)) return body.map(sanitizeBody)

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeBody(value)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4()
  const startTime = Date.now()

  // Store context
  asyncLocalStorage.run(
    { requestId, jobId: '', userId: '', sessionId: '' },
    () => {
      const sanitizedBody = sanitizeBody(req.body)

      // Log request start
      Sentry.setContext('request', {
        requestId,
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query,
        body: sanitizedBody,
      })
      logger.info(
        {
          req: {
            method: req.method,
            url: req.url,
            params: req.params,
            query: req.query,
            body: sanitizedBody,
          },
        },
        'Request started',
      )

      // Log when the request completes
      res.on('finish', () => {
        const duration = Date.now() - startTime
        logger.info(
          {
            res: {
              statusCode: res.statusCode,
              duration: `${duration}ms`,
            },
          },
          'Request completed',
        )
      })

      // Add request ID to response headers
      res.setHeader('x-request-id', requestId)
      next()
    },
  )
}

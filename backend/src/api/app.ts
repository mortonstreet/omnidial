import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { errorHandler } from './middlewares/errorHandler'
import { requestLogger } from './middlewares/requestLogger'
import { initializeAuth } from './middlewares/auth'
import { apiRoutes } from './routes'
import authRoutes from './routes/auth'
import bodyParser from 'body-parser'
import { config } from '@/config'
import Sentry from '@/lib/sentry'
import {
  authRateLimitIfMutation,
  generalApiRateLimit,
} from './middlewares/rateLimiterMiddleware'
import { accountLockout } from './middlewares/accountLockout'

const app = express()

// Security headers
app.use(helmet())

// Serve static files from public directory (for audio files, etc.)
// In development: __dirname is src/api, so ../../public works
// In production (bundled): __dirname is dist/, so ./public works
const publicPath =
  process.env.NODE_ENV === 'production'
    ? path.join(__dirname, 'public')
    : path.join(__dirname, '../../public')
app.use('/static', express.static(publicPath))

// CORS handler that supports Chrome extension origins
const corsOriginHandler = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => {
  // Allow requests with no origin (same-origin, Postman, etc.)
  if (!origin) {
    return callback(null, true)
  }

  // Allow Chrome extension origins (chrome-extension://<id>)
  if (origin.startsWith('chrome-extension://')) {
    if (config.nodeEnv !== 'production') return callback(null, true)
    const allowedIds = (process.env.CHROME_EXTENSION_IDS || '')
      .split(',')
      .filter(Boolean)
    // Production requires explicit extension allowlist
    if (allowedIds.length === 0)
      return callback(new Error('Extension not allowed'))
    const extensionId = origin.replace('chrome-extension://', '')
    if (allowedIds.includes(extensionId)) return callback(null, true)
    return callback(new Error('Extension not allowed'))
  }

  // Check against configured origins
  if (config.corsOrigin === '*' && config.nodeEnv !== 'production') {
    return callback(null, true)
  }

  if (config.trustedOrigins.includes(origin)) {
    return callback(null, true)
  }

  callback(new Error('Not allowed by CORS'))
}

// Middleware
app.use(
  cors({
    origin: corsOriginHandler,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    exposedHeaders: ['Set-Cookie'],
  }),
)

// Convert CORS origin denials into explicit 403 responses instead of generic 500s.
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (
      err?.message === 'Not allowed by CORS' ||
      err?.message === 'Extension not allowed'
    ) {
      return res.status(403).json({
        status: 'error',
        message: 'CORS origin denied',
      })
    }
    return next(err)
  },
)

// Slack webhooks need raw body for signature verification
// This must be BEFORE the regular JSON parser
app.use(
  '/api/webhooks/slack',
  express.json({
    verify: (req, _res, buf) => {
      ;(req as express.Request & { rawBody?: string }).rawBody = buf.toString()
    },
  }),
)

// Slack interactions send payload as form-encoded, also needs raw body
app.use(
  '/api/webhooks/slack',
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      // Only set if not already set by JSON parser
      if (!(req as express.Request & { rawBody?: string }).rawBody) {
        ;(req as express.Request & { rawBody?: string }).rawBody =
          buf.toString()
      }
    },
  }),
)

// Stripe webhooks need raw body (Buffer) for signature verification
app.use(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, _res, next) => {
    ;(req as express.Request & { rawBody?: Buffer }).rawBody = req.body
    req.body = JSON.parse(req.body.toString())
    next()
  },
)

// Telnyx TeXML voice webhooks send form-encoded data; messaging webhooks send
// JSON. Capture the raw body on both for Ed25519 signature verification.
app.use(
  '/api/webhooks/telnyx',
  express.urlencoded({
    extended: true,
    verify: (req, _res, buf) => {
      ;(req as express.Request & { rawBody?: string }).rawBody = buf.toString()
    },
  }),
)
app.use(
  '/api/webhooks/telnyx',
  express.json({
    verify: (req, _res, buf) => {
      if (!(req as express.Request & { rawBody?: string }).rawBody) {
        ;(req as express.Request & { rawBody?: string }).rawBody =
          buf.toString()
      }
    },
  }),
)

// Regular body parsers for all other routes
app.use((req, res, next) => {
  // Skip if already parsed (Slack/Telnyx/Stripe routes)
  if (
    req.path.startsWith('/api/webhooks/slack') ||
    req.path.startsWith('/api/webhooks/telnyx') ||
    req.path.startsWith('/api/webhooks/stripe')
  ) {
    return next()
  }
  express.json()(req, res, next)
})
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/webhooks/slack') ||
    req.path.startsWith('/api/webhooks/telnyx') ||
    req.path.startsWith('/api/webhooks/stripe')
  ) {
    return next()
  }
  express.urlencoded({ extended: true })(req, res, next)
})
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/webhooks/slack') ||
    req.path.startsWith('/api/webhooks/telnyx') ||
    req.path.startsWith('/api/webhooks/stripe')
  ) {
    return next()
  }
  bodyParser.json()(req, res, next)
})
app.use(requestLogger)

// Initialize passport JWT authentication
initializeAuth(app)

app.use('/api/auth', authRateLimitIfMutation, accountLockout, authRoutes)

// Routes
app.use('/api', generalApiRateLimit, apiRoutes)

Sentry.setupExpressErrorHandler(app)

// Error handling
app.use(errorHandler)

export { app }

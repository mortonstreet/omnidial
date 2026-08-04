import { randomUUID } from 'node:crypto'
import logger from '@/lib/logger'
import type { DataVendorProvider } from '@shared/types/src/requests/enrichment'

export type VendorComplianceCode =
  | 'ENRICHMENT_VENDOR_RATE_LIMITED'
  | 'ENRICHMENT_VENDOR_UNAVAILABLE'

export type VendorRequestMode = 'interactive' | 'bulk'

interface VendorPolicy {
  rpsLimit: number
  burstLimit: number
  dailyOrgCreditCeiling: number | null
  dailyGlobalCreditCeiling: number | null
  retryDelaysMs: number[]
  maxInteractiveAttempts: number
  maxBulkAttempts: number
  circuitOpenAfterConsecutiveFailures: number
  circuitOpenAfterRateLimitFailures: number
  circuitOpenDurationMs: number
  halfOpenProbeLimit: number
  halfOpenSuccessQuorum: number
}

const DEFAULT_VENDOR_POLICY: VendorPolicy = {
  rpsLimit: 2,
  burstLimit: 4,
  dailyOrgCreditCeiling: 2_000,
  dailyGlobalCreditCeiling: 25_000,
  retryDelaysMs: [250, 750, 2_000],
  maxInteractiveAttempts: 3,
  maxBulkAttempts: 3,
  circuitOpenAfterConsecutiveFailures: 4,
  circuitOpenAfterRateLimitFailures: 3,
  circuitOpenDurationMs: 60_000,
  halfOpenProbeLimit: 2,
  halfOpenSuccessQuorum: 2,
}

const VENDOR_POLICY_REGISTRY: Record<DataVendorProvider, VendorPolicy> = {
  apollo: DEFAULT_VENDOR_POLICY,
  clearbit: DEFAULT_VENDOR_POLICY,
  zoominfo: DEFAULT_VENDOR_POLICY,
  lusha: DEFAULT_VENDOR_POLICY,
  enrichengine: DEFAULT_VENDOR_POLICY,
  prospeo: {
    ...DEFAULT_VENDOR_POLICY,
    rpsLimit: 3,
    burstLimit: 6,
  },
  forager: {
    ...DEFAULT_VENDOR_POLICY,
    rpsLimit: 3,
    burstLimit: 6,
  },
  leadmagic: {
    ...DEFAULT_VENDOR_POLICY,
    rpsLimit: 2,
    burstLimit: 4,
  },
  firecrawl: DEFAULT_VENDOR_POLICY,
}

interface RateLimitWindowState {
  windowStartMs: number
  requestCount: number
}

type CircuitState = 'closed' | 'open' | 'half_open'

interface CircuitBreakerState {
  state: CircuitState
  consecutiveFailureCount: number
  rateLimitFailureCount: number
  openedAtMs: number | null
  halfOpenProbeCount: number
  halfOpenSuccessCount: number
}

interface CreditWindowState {
  dayKey: string
  usedCredits: number
}

const rateLimitWindows = new Map<string, RateLimitWindowState>()
const circuitBreakers = new Map<string, CircuitBreakerState>()
const orgCreditWindows = new Map<string, CreditWindowState>()
const globalCreditWindows = new Map<string, CreditWindowState>()

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const RETRYABLE_PATTERNS = [
  /429/,
  /rate\s*limit/i,
  /timeout/i,
  /timed out/i,
  /network/i,
  /connection/i,
  /502/,
  /503/,
  /504/,
  /5\d\d/,
  /temporar/i,
]

const NON_RETRYABLE_PATTERNS = [
  /invalid api key/i,
  /authentication failed/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid linkedin url/i,
  /requires linkedin url/i,
]

export interface VendorFailureClassification {
  retryable: boolean
  rateLimited: boolean
  unavailable: boolean
  message: string
}

export class VendorComplianceError extends Error {
  readonly code: VendorComplianceCode
  readonly retryable: boolean
  readonly userMessage: string
  readonly correlationId: string
  readonly retryAfterMs: number | null

  constructor(params: {
    code: VendorComplianceCode
    retryable: boolean
    userMessage: string
    correlationId?: string
    retryAfterMs?: number | null
  }) {
    super(params.userMessage)
    this.name = 'VendorComplianceError'
    this.code = params.code
    this.retryable = params.retryable
    this.userMessage = params.userMessage
    this.correlationId = params.correlationId ?? randomUUID()
    this.retryAfterMs = params.retryAfterMs ?? null
  }
}

const getErrorMessage = (error: unknown): string => {
  if (error instanceof VendorComplianceError) return error.userMessage
  if (error instanceof Error) return error.message
  return 'Unknown vendor error'
}

const dayKeyUtc = (date = new Date()): string => date.toISOString().slice(0, 10)

const addJitter = (baseDelayMs: number): number => {
  const jitter = Math.floor(Math.random() * 200)
  return baseDelayMs + jitter
}

const getCircuitStateKey = (
  organizationId: string,
  provider: DataVendorProvider,
): string => `${organizationId}:${provider}`

const getCircuitState = (
  organizationId: string,
  provider: DataVendorProvider,
): CircuitBreakerState => {
  const key = getCircuitStateKey(organizationId, provider)
  const existing = circuitBreakers.get(key)
  if (existing) return existing

  const initial: CircuitBreakerState = {
    state: 'closed',
    consecutiveFailureCount: 0,
    rateLimitFailureCount: 0,
    openedAtMs: null,
    halfOpenProbeCount: 0,
    halfOpenSuccessCount: 0,
  }
  circuitBreakers.set(key, initial)
  return initial
}

const resetFailureCounters = (state: CircuitBreakerState) => {
  state.consecutiveFailureCount = 0
  state.rateLimitFailureCount = 0
}

const openCircuit = (
  state: CircuitBreakerState,
  organizationId: string,
  provider: DataVendorProvider,
  reason: string,
) => {
  state.state = 'open'
  state.openedAtMs = Date.now()
  state.halfOpenProbeCount = 0
  state.halfOpenSuccessCount = 0
  logger.warn(
    {
      organizationId,
      provider,
      reason,
      consecutiveFailureCount: state.consecutiveFailureCount,
      rateLimitFailureCount: state.rateLimitFailureCount,
    },
    'Opening enrichment vendor circuit',
  )
}

const assertCircuitAllowsRequest = (params: {
  organizationId: string
  provider: DataVendorProvider
  policy: VendorPolicy
}) => {
  const { organizationId, provider, policy } = params
  const state = getCircuitState(organizationId, provider)
  const now = Date.now()

  if (state.state === 'open') {
    const openedAt = state.openedAtMs ?? now
    const elapsedMs = now - openedAt

    if (elapsedMs >= policy.circuitOpenDurationMs) {
      state.state = 'half_open'
      state.halfOpenProbeCount = 0
      state.halfOpenSuccessCount = 0
      logger.info(
        { organizationId, provider },
        'Switching enrichment vendor circuit to half_open',
      )
    } else {
      throw new VendorComplianceError({
        code: 'ENRICHMENT_VENDOR_UNAVAILABLE',
        retryable: true,
        userMessage: 'Vendor temporarily unavailable. Please retry shortly.',
        retryAfterMs: policy.circuitOpenDurationMs - elapsedMs,
      })
    }
  }

  if (state.state === 'half_open') {
    if (state.halfOpenProbeCount >= policy.halfOpenProbeLimit) {
      throw new VendorComplianceError({
        code: 'ENRICHMENT_VENDOR_UNAVAILABLE',
        retryable: true,
        userMessage:
          'Vendor is recovering. Please retry after probe checks complete.',
        retryAfterMs: 1_000,
      })
    }
    state.halfOpenProbeCount += 1
  }
}

const recordCircuitSuccess = (
  organizationId: string,
  provider: DataVendorProvider,
  policy: VendorPolicy,
) => {
  const state = getCircuitState(organizationId, provider)
  if (state.state === 'half_open') {
    state.halfOpenSuccessCount += 1
    if (state.halfOpenSuccessCount >= policy.halfOpenSuccessQuorum) {
      state.state = 'closed'
      state.openedAtMs = null
      state.halfOpenProbeCount = 0
      state.halfOpenSuccessCount = 0
      resetFailureCounters(state)
      logger.info(
        { organizationId, provider },
        'Closing enrichment vendor circuit after successful probes',
      )
    }
    return
  }

  resetFailureCounters(state)
}

const recordCircuitFailure = (params: {
  organizationId: string
  provider: DataVendorProvider
  policy: VendorPolicy
  classification: VendorFailureClassification
}) => {
  const { organizationId, provider, policy, classification } = params
  const state = getCircuitState(organizationId, provider)

  state.consecutiveFailureCount += 1
  if (classification.rateLimited) {
    state.rateLimitFailureCount += 1
  }

  if (state.state === 'half_open') {
    openCircuit(state, organizationId, provider, 'half_open_probe_failed')
    return
  }

  const shouldOpenForFailures =
    state.consecutiveFailureCount >= policy.circuitOpenAfterConsecutiveFailures
  const shouldOpenForRateLimits =
    state.rateLimitFailureCount >= policy.circuitOpenAfterRateLimitFailures

  if (shouldOpenForFailures || shouldOpenForRateLimits) {
    openCircuit(
      state,
      organizationId,
      provider,
      shouldOpenForRateLimits ? 'rate_limit_threshold' : 'failure_threshold',
    )
  }
}

const assertLocalRateLimit = (params: {
  organizationId: string
  provider: DataVendorProvider
  policy: VendorPolicy
}) => {
  const { organizationId, provider, policy } = params
  const key = `${organizationId}:${provider}`
  const now = Date.now()
  const current = rateLimitWindows.get(key)

  if (!current || now - current.windowStartMs >= 1_000) {
    rateLimitWindows.set(key, {
      windowStartMs: now,
      requestCount: 1,
    })
    return
  }

  const effectiveLimit = Math.max(policy.rpsLimit, policy.burstLimit)
  if (current.requestCount >= effectiveLimit) {
    throw new VendorComplianceError({
      code: 'ENRICHMENT_VENDOR_RATE_LIMITED',
      retryable: true,
      userMessage:
        'Vendor request rate limit reached. Please retry in a few seconds.',
      retryAfterMs: Math.max(0, 1_000 - (now - current.windowStartMs)),
    })
  }

  current.requestCount += 1
}

const getCreditWindow = (
  map: Map<string, CreditWindowState>,
  key: string,
): CreditWindowState => {
  const today = dayKeyUtc()
  const existing = map.get(key)
  if (!existing || existing.dayKey !== today) {
    const fresh: CreditWindowState = { dayKey: today, usedCredits: 0 }
    map.set(key, fresh)
    return fresh
  }
  return existing
}

const assertCreditBudget = (params: {
  organizationId: string
  provider: DataVendorProvider
  policy: VendorPolicy
  estimatedCredits: number
}) => {
  const { organizationId, provider, policy, estimatedCredits } = params
  const orgKey = `${organizationId}:${provider}`
  const globalKey = provider

  if (policy.dailyOrgCreditCeiling !== null) {
    const orgWindow = getCreditWindow(orgCreditWindows, orgKey)
    if (
      orgWindow.usedCredits + estimatedCredits >
      policy.dailyOrgCreditCeiling
    ) {
      throw new VendorComplianceError({
        code: 'ENRICHMENT_VENDOR_UNAVAILABLE',
        retryable: true,
        userMessage:
          'Vendor daily credit budget reached for this organization.',
        retryAfterMs: 60_000,
      })
    }
  }

  if (policy.dailyGlobalCreditCeiling !== null) {
    const globalWindow = getCreditWindow(globalCreditWindows, globalKey)
    if (
      globalWindow.usedCredits + estimatedCredits >
      policy.dailyGlobalCreditCeiling
    ) {
      throw new VendorComplianceError({
        code: 'ENRICHMENT_VENDOR_UNAVAILABLE',
        retryable: true,
        userMessage: 'Vendor capacity is temporarily exhausted. Retry later.',
        retryAfterMs: 60_000,
      })
    }
  }
}

const recordCreditUsage = (params: {
  organizationId: string
  provider: DataVendorProvider
  creditsUsed: number
}) => {
  const { organizationId, provider, creditsUsed } = params
  if (creditsUsed <= 0) return

  const orgKey = `${organizationId}:${provider}`
  const globalKey = provider

  const orgWindow = getCreditWindow(orgCreditWindows, orgKey)
  orgWindow.usedCredits += creditsUsed

  const globalWindow = getCreditWindow(globalCreditWindows, globalKey)
  globalWindow.usedCredits += creditsUsed
}

const classifyMessage = (message: string): VendorFailureClassification => {
  const normalizedMessage = message.trim() || 'Unknown vendor failure'
  const isRateLimited = RETRYABLE_PATTERNS.slice(0, 2).some((pattern) =>
    pattern.test(normalizedMessage),
  )
  const isRetryable =
    !NON_RETRYABLE_PATTERNS.some((pattern) =>
      pattern.test(normalizedMessage),
    ) && RETRYABLE_PATTERNS.some((pattern) => pattern.test(normalizedMessage))

  return {
    retryable: isRetryable || isRateLimited,
    rateLimited: isRateLimited,
    unavailable: isRetryable && !isRateLimited,
    message: normalizedMessage,
  }
}

export const classifyVendorFailure = (error: unknown) => {
  const message = getErrorMessage(error)
  return classifyMessage(message)
}

export const classifyVendorResultByMessage = <
  TResult extends { success: boolean; errorMessage?: string | null },
>(
  result: TResult,
): VendorFailureClassification | null => {
  if (result.success) return null
  return classifyMessage(result.errorMessage ?? 'Vendor did not return data')
}

const asComplianceError = (
  classification: VendorFailureClassification,
): VendorComplianceError =>
  new VendorComplianceError({
    code: classification.rateLimited
      ? 'ENRICHMENT_VENDOR_RATE_LIMITED'
      : 'ENRICHMENT_VENDOR_UNAVAILABLE',
    retryable: classification.retryable,
    userMessage: classification.message,
  })

export const formatVendorErrorForHistory = (error: unknown): string => {
  if (error instanceof VendorComplianceError) {
    return `[${error.code}] ${error.userMessage} (correlationId: ${error.correlationId})`
  }
  return getErrorMessage(error)
}

export const executeWithVendorPolicy = async <TResult>(params: {
  organizationId: string
  provider: DataVendorProvider
  requestMode?: VendorRequestMode
  estimatedCredits?: number
  operation: () => Promise<TResult>
  classifyResult?: (result: TResult) => VendorFailureClassification | null
  extractCreditsUsed?: (result: TResult) => number
}): Promise<TResult> => {
  const {
    organizationId,
    provider,
    requestMode = 'interactive',
    estimatedCredits = 1,
    operation,
    classifyResult,
    extractCreditsUsed,
  } = params

  const policy = VENDOR_POLICY_REGISTRY[provider] ?? DEFAULT_VENDOR_POLICY
  const maxAttempts =
    requestMode === 'bulk'
      ? policy.maxBulkAttempts
      : policy.maxInteractiveAttempts

  assertCreditBudget({
    organizationId,
    provider,
    policy,
    estimatedCredits,
  })

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    assertCircuitAllowsRequest({
      organizationId,
      provider,
      policy,
    })
    assertLocalRateLimit({
      organizationId,
      provider,
      policy,
    })

    try {
      const result = await operation()
      const classification = classifyResult?.(result) ?? null

      if (!classification) {
        recordCircuitSuccess(organizationId, provider, policy)
        recordCreditUsage({
          organizationId,
          provider,
          creditsUsed: Math.max(
            0,
            extractCreditsUsed?.(result) ?? estimatedCredits,
          ),
        })
        return result
      }

      recordCircuitFailure({
        organizationId,
        provider,
        policy,
        classification,
      })

      if (!classification.retryable) {
        return result
      }

      if (attempt >= maxAttempts) {
        throw asComplianceError(classification)
      }

      await sleep(addJitter(policy.retryDelaysMs[attempt - 1] ?? 2_000))
    } catch (error) {
      if (error instanceof VendorComplianceError) {
        if (attempt >= maxAttempts) {
          throw error
        }
        await sleep(addJitter(policy.retryDelaysMs[attempt - 1] ?? 2_000))
        continue
      }

      const classification = classifyVendorFailure(error)

      recordCircuitFailure({
        organizationId,
        provider,
        policy,
        classification,
      })

      if (!classification.retryable || attempt >= maxAttempts) {
        if (classification.retryable) {
          throw asComplianceError(classification)
        }
        throw error
      }

      await sleep(addJitter(policy.retryDelaysMs[attempt - 1] ?? 2_000))
    }
  }

  throw new VendorComplianceError({
    code: 'ENRICHMENT_VENDOR_UNAVAILABLE',
    retryable: true,
    userMessage: 'Vendor retries exhausted. Please try again shortly.',
  })
}

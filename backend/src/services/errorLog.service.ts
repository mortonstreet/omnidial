import * as errorLogRepository from '@/repositories/errorLog.repository'
import logger from '@/lib/logger'
import type {
  CreateErrorLogInput,
  GetErrorLogsResponse,
  ErrorLogItem,
  ErrorLogDetail,
  GetErrorLogStatsResponse,
  UpdateErrorLogStatusResponse,
} from '@shared/types/src'

// ============================================================================
// Core logError utility - Use this throughout the codebase to log errors
// ============================================================================

export interface LogErrorParams {
  code: string
  message: string
  description?: string
  severity: 'warning' | 'error' | 'critical'
  product: string
  category: string
  organizationId?: string
  userId?: string
  callId?: string
  campaignId?: string
  leadId?: string
  twilioCallSid?: string
  metadata?: Record<string, unknown>
  source?: string
  requestId?: string
  error?: Error // For extracting stack trace
}

/**
 * Logs an error to the database for admin visibility.
 * This is a fire-and-forget utility - it catches its own errors to prevent
 * error logging from breaking the main flow.
 */
export const logError = async (params: LogErrorParams): Promise<void> => {
  try {
    const data: CreateErrorLogInput = {
      code: params.code,
      message: params.message,
      description: params.description,
      severity: params.severity,
      product: params.product,
      category: params.category,
      organizationId: params.organizationId,
      userId: params.userId,
      callId: params.callId,
      campaignId: params.campaignId,
      leadId: params.leadId,
      twilioCallSid: params.twilioCallSid,
      metadata: params.metadata,
      source: params.source,
      requestId: params.requestId,
      stackTrace: params.error?.stack,
    }

    await errorLogRepository.create(data)
  } catch (err) {
    // Log to console but don't throw - error logging should never break the main flow
    logger.error({ err, params }, 'Failed to log error to database')
  }
}

// ============================================================================
// API Service Methods
// ============================================================================

export interface GetErrorLogsParams {
  page: number
  limit: number
  severity?: string
  product?: string
  category?: string
  status?: string
  organizationId?: string
  startDate?: string
  endDate?: string
  search?: string
}

export const getErrorLogs = async (
  params: GetErrorLogsParams,
): Promise<GetErrorLogsResponse> => {
  const { items, total } = await errorLogRepository.findWithPagination(params)

  // Enrich with organization names
  const enrichedItems: ErrorLogItem[] = await Promise.all(
    items.map(async (item) => {
      let organizationName: string | null = null
      let userName: string | null = null

      if (item.organizationId) {
        organizationName = await errorLogRepository.getOrganizationName(
          item.organizationId,
        )
      }
      if (item.userId) {
        const userDetails = await errorLogRepository.getUserDetails(item.userId)
        userName = userDetails?.name ?? userDetails?.email ?? null
      }

      return {
        id: item.id,
        code: item.code,
        message: item.message,
        severity: item.severity,
        product: item.product,
        category: item.category,
        organizationId: item.organizationId,
        organizationName,
        userId: item.userId,
        userName,
        status: item.status,
        occurredAt: (item.occurredAt as Date).toISOString(),
        createdAt: (item.createdAt as Date).toISOString(),
      }
    }),
  )

  const totalPages = Math.ceil(total / params.limit)

  return {
    data: enrichedItems,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNextPage: params.page < totalPages,
      hasPrevPage: params.page > 1,
    },
  }
}

export const getErrorLogDetail = async (
  id: string,
): Promise<ErrorLogDetail | null> => {
  const errorLog = await errorLogRepository.findById(id)
  if (!errorLog) return null

  // Enrich with related entity names
  let organizationName: string | null = null
  let userName: string | null = null
  let userEmail: string | null = null
  let campaignName: string | null = null
  let leadName: string | null = null
  let resolvedByName: string | null = null

  if (errorLog.organizationId) {
    organizationName = await errorLogRepository.getOrganizationName(
      errorLog.organizationId,
    )
  }
  if (errorLog.userId) {
    const userDetails = await errorLogRepository.getUserDetails(errorLog.userId)
    userName = userDetails?.name ?? null
    userEmail = userDetails?.email ?? null
  }
  if (errorLog.campaignId) {
    campaignName = await errorLogRepository.getCampaignName(errorLog.campaignId)
  }
  if (errorLog.leadId) {
    leadName = await errorLogRepository.getLeadName(errorLog.leadId)
  }
  if (errorLog.resolvedBy) {
    const resolverDetails = await errorLogRepository.getUserDetails(
      errorLog.resolvedBy,
    )
    resolvedByName = resolverDetails?.name ?? resolverDetails?.email ?? null
  }

  // Parse metadata
  let metadata: Record<string, unknown> = {}
  if (errorLog.metadata) {
    try {
      metadata =
        typeof errorLog.metadata === 'string'
          ? JSON.parse(errorLog.metadata)
          : (errorLog.metadata as Record<string, unknown>)
    } catch {
      metadata = {}
    }
  }

  return {
    id: errorLog.id,
    code: errorLog.code,
    message: errorLog.message,
    description: errorLog.description,
    severity: errorLog.severity,
    product: errorLog.product,
    category: errorLog.category,
    organizationId: errorLog.organizationId,
    organizationName,
    userId: errorLog.userId,
    userName,
    userEmail,
    callId: errorLog.callId,
    campaignId: errorLog.campaignId,
    campaignName,
    leadId: errorLog.leadId,
    leadName,
    twilioCallSid: errorLog.twilioCallSid,
    metadata,
    source: errorLog.source,
    requestId: errorLog.requestId,
    stackTrace: errorLog.stackTrace,
    status: errorLog.status,
    resolvedAt: errorLog.resolvedAt
      ? (errorLog.resolvedAt as Date).toISOString()
      : null,
    resolvedBy: errorLog.resolvedBy,
    resolvedByName,
    resolutionNote: errorLog.resolutionNote,
    occurredAt: (errorLog.occurredAt as Date).toISOString(),
    createdAt: (errorLog.createdAt as Date).toISOString(),
  }
}

export interface GetErrorLogStatsParams {
  startDate: string
  endDate: string
  groupBy: 'hour' | 'day' | 'week'
  organizationId?: string
}

export const getErrorLogStats = async (
  params: GetErrorLogStatsParams,
): Promise<GetErrorLogStatsResponse> => {
  return errorLogRepository.getStats(params)
}

export const updateErrorLogStatus = async (
  id: string,
  status: 'acknowledged' | 'resolved',
  resolvedBy: string,
  resolutionNote?: string,
): Promise<UpdateErrorLogStatusResponse> => {
  const errorLog = await errorLogRepository.findById(id)
  if (!errorLog) {
    throw new Error('Error log not found')
  }

  const updated = await errorLogRepository.updateStatus(
    id,
    status,
    resolvedBy,
    resolutionNote,
  )

  return {
    success: true,
    errorLog: {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt
        ? (updated.resolvedAt as Date).toISOString()
        : null,
      resolvedBy: updated.resolvedBy,
      resolutionNote: updated.resolutionNote,
    },
  }
}

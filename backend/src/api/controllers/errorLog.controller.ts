import { AuthRequestHandler } from '@/types/handlers'
import * as errorLogService from '@/services/errorLog.service'
import {
  GetErrorLogsRequestSchema,
  GetErrorLogDetailRequestSchema,
  GetErrorLogStatsRequestSchema,
  UpdateErrorLogStatusRequestSchema,
  type GetErrorLogsRequest,
  type GetErrorLogsResponse,
  type GetErrorLogDetailRequest,
  type GetErrorLogDetailResponse,
  type GetErrorLogStatsRequest,
  type GetErrorLogStatsResponse,
  type UpdateErrorLogStatusRequest,
  type UpdateErrorLogStatusResponse,
} from '@shared/types/src'

export const getErrorLogs: AuthRequestHandler<GetErrorLogsRequest> = async (
  req,
  res,
) => {
  const params = GetErrorLogsRequestSchema.parse(req.query)
  const result = await errorLogService.getErrorLogs(params)
  const response: GetErrorLogsResponse = result
  res.json(response)
}

export const getErrorLogDetail: AuthRequestHandler<
  GetErrorLogDetailRequest
> = async (req, res) => {
  const { id } = GetErrorLogDetailRequestSchema.parse(req.params)
  const result = await errorLogService.getErrorLogDetail(id)

  if (!result) {
    return res.status(404).json({ error: 'Error log not found' })
  }

  const response: GetErrorLogDetailResponse = result
  res.json(response)
}

export const getErrorLogStats: AuthRequestHandler<
  GetErrorLogStatsRequest
> = async (req, res) => {
  const params = GetErrorLogStatsRequestSchema.parse(req.query)
  const result = await errorLogService.getErrorLogStats(params)
  const response: GetErrorLogStatsResponse = result
  res.json(response)
}

export const updateErrorLogStatus: AuthRequestHandler<
  UpdateErrorLogStatusRequest
> = async (req, res) => {
  const { id } = req.params
  const { status, resolutionNote } = req.validated

  const result = await errorLogService.updateErrorLogStatus(
    id,
    status,
    req.user.id,
    resolutionNote,
  )
  const response: UpdateErrorLogStatusResponse = result
  res.json(response)
}

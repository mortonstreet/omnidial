import { AuthRequestHandler } from '@/types/handlers'
import * as adminLogService from '@/services/adminLog.service'
import {
  GetAdminCallsRequestSchema,
  GetAdminCallDetailRequestSchema,
  GetAdminRecordingsRequestSchema,
  GetAdminTranscriptionsRequestSchema,
  GetAdminTranscriptionDetailRequestSchema,
  GetAdminActivityRequestSchema,
  type GetAdminCallsRequest,
  type GetAdminCallDetailRequest,
  type GetAdminRecordingsRequest,
  type GetAdminTranscriptionsRequest,
  type GetAdminTranscriptionDetailRequest,
  type GetAdminActivityRequest,
} from '@shared/types/src'

export const getAdminCalls: AuthRequestHandler<GetAdminCallsRequest> = async (
  req,
  res,
) => {
  const params = GetAdminCallsRequestSchema.parse(req.query)
  const result = await adminLogService.getAdminCalls(params)
  res.json(result)
}

export const getAdminCallDetail: AuthRequestHandler<
  GetAdminCallDetailRequest
> = async (req, res) => {
  const { id } = GetAdminCallDetailRequestSchema.parse(req.params)
  const result = await adminLogService.getAdminCallDetail(id)

  if (!result) {
    return res.status(404).json({ error: 'Call not found' })
  }

  res.json(result)
}

export const getAdminRecordings: AuthRequestHandler<
  GetAdminRecordingsRequest
> = async (req, res) => {
  const params = GetAdminRecordingsRequestSchema.parse(req.query)
  const result = await adminLogService.getAdminRecordings(params)
  res.json(result)
}

export const getAdminTranscriptions: AuthRequestHandler<
  GetAdminTranscriptionsRequest
> = async (req, res) => {
  const params = GetAdminTranscriptionsRequestSchema.parse(req.query)
  const result = await adminLogService.getAdminTranscriptions(params)
  res.json(result)
}

export const getAdminTranscriptionDetail: AuthRequestHandler<
  GetAdminTranscriptionDetailRequest
> = async (req, res) => {
  const { id } = GetAdminTranscriptionDetailRequestSchema.parse(req.params)
  const result = await adminLogService.getAdminTranscriptionDetail(id)

  if (!result) {
    return res.status(404).json({ error: 'Transcription not found' })
  }

  res.json(result)
}

export const getAdminActivity: AuthRequestHandler<
  GetAdminActivityRequest
> = async (req, res) => {
  const params = GetAdminActivityRequestSchema.parse(req.query)
  const result = await adminLogService.getAdminActivity(params)
  res.json(result)
}

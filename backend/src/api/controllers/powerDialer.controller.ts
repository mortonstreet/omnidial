import * as powerDialerService from '@/services/powerDialer.service'
import { AuthRequestHandler } from '@/types/handlers'
import {
  GetPowerDialerProgressRequest,
  UpdatePowerDialerProgressRequest,
  GetNextLeadRequest,
  SkipLeadRequest,
  StartPowerDialerRequest,
  StopPowerDialerRequest,
} from '@shared/types/src'

export const getProgress: AuthRequestHandler<
  GetPowerDialerProgressRequest
> = async (req, res) => {
  const { organizationId, campaignId, listId } = req.validated
  const userId = req.user.id

  const progress = await powerDialerService.getProgress({
    userId,
    campaignId,
    listId,
    organizationId,
  })

  res.json(progress)
}

export const updateProgress: AuthRequestHandler<
  UpdatePowerDialerProgressRequest
> = async (req, res) => {
  const { campaignId, listId, currentIndex, dialedCount, isPaused } =
    req.validated
  const userId = req.user.id

  const progress = await powerDialerService.updateProgress({
    userId,
    campaignId,
    listId,
    currentIndex,
    dialedCount,
    isPaused,
  })

  res.json(progress)
}

export const startSession: AuthRequestHandler<StartPowerDialerRequest> = async (
  req,
  res,
) => {
  const { organizationId, campaignId, listId } = req.validated
  const userId = req.user.id

  try {
    const progress = await powerDialerService.startSession({
      userId,
      campaignId,
      listId,
      organizationId,
    })
    res.json(progress)
  } catch (error) {
    console.error('Failed to start session:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to start session',
    })
  }
}

export const stopSession: AuthRequestHandler<StopPowerDialerRequest> = async (
  req,
  res,
) => {
  const { campaignId, listId } = req.validated
  const userId = req.user.id

  const result = await powerDialerService.stopSession({
    userId,
    campaignId,
    listId,
  })

  res.json(result)
}

export const getNextLead: AuthRequestHandler<GetNextLeadRequest> = async (
  req,
  res,
) => {
  const { organizationId, campaignId, listId } = req.validated
  const userId = req.user.id

  try {
    const result = await powerDialerService.getNextLead({
      userId,
      campaignId,
      listId,
      organizationId,
    })
    res.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to get next lead'
    // Only 400 for known validation errors, 500 for unexpected failures
    const status = message === 'List not found' ? 400 : 500
    if (status === 500) {
      console.error('Failed to get next lead:', error)
    }
    res.status(status).json({ error: message })
  }
}

export const skipLead: AuthRequestHandler<SkipLeadRequest> = async (
  req,
  res,
) => {
  const { campaignId, listId } = req.validated
  const userId = req.user.id

  try {
    const progress = await powerDialerService.skipLead({
      userId,
      campaignId,
      listId,
    })
    res.json(progress)
  } catch (error) {
    console.error('Failed to skip lead:', error)
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to skip lead',
    })
  }
}

export const advanceToNext: AuthRequestHandler<SkipLeadRequest> = async (
  req,
  res,
) => {
  const { campaignId, listId } = req.validated
  const userId = req.user.id

  try {
    const progress = await powerDialerService.advanceToNext({
      userId,
      campaignId,
      listId,
    })
    res.json(progress)
  } catch (error) {
    console.error('Failed to advance to next:', error)
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Failed to advance to next',
    })
  }
}

export const goToPrevious: AuthRequestHandler<SkipLeadRequest> = async (
  req,
  res,
) => {
  const { campaignId, listId } = req.validated
  const userId = req.user.id

  try {
    const progress = await powerDialerService.goToPrevious({
      userId,
      campaignId,
      listId,
    })
    res.json(progress)
  } catch (error) {
    console.error('Failed to go to previous:', error)
    res.status(500).json({
      error:
        error instanceof Error ? error.message : 'Failed to go to previous',
    })
  }
}

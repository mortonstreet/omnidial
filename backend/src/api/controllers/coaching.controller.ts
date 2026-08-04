import { Request, Response } from 'express'
import * as salesCoachService from '@/services/salesCoach.service'

// Check if a call is eligible for coaching
export const checkEligibility = async (req: Request, res: Response) => {
  const { callId } = req.params
  const organizationId = req.organizationId!

  try {
    const eligibility = await salesCoachService.checkCoachingEligibility(
      callId,
      organizationId,
    )
    return res.json({ data: eligibility })
  } catch (error) {
    console.error('Error checking coaching eligibility:', error)
    return res
      .status(500)
      .json({ error: 'Failed to check coaching eligibility' })
  }
}

// Generate coaching for a call
export const generateCoaching = async (req: Request, res: Response) => {
  const { callId } = req.params
  const organizationId = req.organizationId!
  const userId = req.userId!

  try {
    const result = await salesCoachService.generateCoaching(
      callId,
      organizationId,
      userId,
    )
    return res.json({ data: result })
  } catch (error) {
    console.error('Error generating coaching:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to generate coaching'
    return res.status(400).json({ error: message })
  }
}

// Get coaching for a specific call
export const getCallCoaching = async (req: Request, res: Response) => {
  const { callId } = req.params
  const organizationId = req.organizationId!

  try {
    const result = await salesCoachService.getCoaching(callId, organizationId)
    if (!result) {
      return res.status(404).json({ error: 'No coaching found for this call' })
    }
    return res.json({ data: result })
  } catch (error) {
    console.error('Error fetching coaching:', error)
    return res.status(500).json({ error: 'Failed to fetch coaching' })
  }
}

// Get coaching history for the current user
export const getUserCoachingHistory = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!
  const userId = req.userId!
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  try {
    const coaching = await salesCoachService.getUserCoachingHistory(
      userId,
      organizationId,
      {
        limit,
        offset,
      },
    )
    return res.json({ data: coaching })
  } catch (error) {
    console.error('Error fetching user coaching history:', error)
    return res.status(500).json({ error: 'Failed to fetch coaching history' })
  }
}

// Get recent coaching for the organization
export const getRecentCoaching = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  const minScore = req.query.minScore
    ? parseInt(req.query.minScore as string)
    : undefined
  const maxScore = req.query.maxScore
    ? parseInt(req.query.maxScore as string)
    : undefined

  try {
    const coaching = await salesCoachService.getRecentCoaching(organizationId, {
      limit,
      offset,
      minScore,
      maxScore,
    })
    return res.json({ data: coaching })
  } catch (error) {
    console.error('Error fetching recent coaching:', error)
    return res.status(500).json({ error: 'Failed to fetch recent coaching' })
  }
}

// Get coaching stats
export const getCoachingStats = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!
  const userId = req.query.userId as string | undefined

  try {
    const stats = await salesCoachService.getCoachingStats(
      organizationId,
      userId,
    )
    return res.json({ data: stats })
  } catch (error) {
    console.error('Error fetching coaching stats:', error)
    return res.status(500).json({ error: 'Failed to fetch coaching stats' })
  }
}

// Get uncoached eligible calls
export const getUncoachedCalls = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  try {
    const calls = await salesCoachService.getUncoachedCalls(organizationId, {
      limit,
      offset,
    })
    return res.json({ data: calls })
  } catch (error) {
    console.error('Error fetching uncoached calls:', error)
    return res.status(500).json({ error: 'Failed to fetch uncoached calls' })
  }
}

// Get coaching for a specific lead
export const getLeadCoaching = async (req: Request, res: Response) => {
  const { leadId } = req.params
  const organizationId = req.organizationId!
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0
  const minScore = req.query.minScore
    ? parseInt(req.query.minScore as string)
    : undefined
  const maxScore = req.query.maxScore
    ? parseInt(req.query.maxScore as string)
    : undefined

  try {
    const coaching = await salesCoachService.getCoachingByLeadId(
      leadId,
      organizationId,
      {
        limit,
        offset,
        minScore,
        maxScore,
      },
    )
    return res.json({ data: coaching })
  } catch (error) {
    console.error('Error fetching lead coaching:', error)
    return res.status(500).json({ error: 'Failed to fetch lead coaching' })
  }
}

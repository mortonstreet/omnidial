import { Request, Response } from 'express'
import * as callIntelligenceService from '@/services/callIntelligence.service'

export const checkEligibility = async (req: Request, res: Response) => {
  const { callId } = req.params
  const organizationId = req.organizationId!

  try {
    const eligibility = await callIntelligenceService.checkEligibility(
      callId,
      organizationId,
    )
    return res.json({ data: eligibility })
  } catch (error) {
    console.error('Error checking intelligence eligibility:', error)
    return res
      .status(500)
      .json({ error: 'Failed to check intelligence eligibility' })
  }
}

export const generateIntelligence = async (req: Request, res: Response) => {
  const { callId } = req.params
  const organizationId = req.organizationId!
  const userId = req.userId!

  try {
    const intelligence = await callIntelligenceService.generateIntelligence(
      callId,
      organizationId,
      userId,
    )
    return res.json({ data: { intelligence } })
  } catch (error) {
    console.error('Error generating intelligence:', error)
    const message =
      error instanceof Error ? error.message : 'Failed to generate intelligence'
    return res.status(400).json({ error: message })
  }
}

export const getCallIntelligence = async (req: Request, res: Response) => {
  const { callId } = req.params
  const organizationId = req.organizationId!

  try {
    const intelligence = await callIntelligenceService.getIntelligence(
      callId,
      organizationId,
    )
    if (!intelligence) {
      return res
        .status(404)
        .json({ error: 'No intelligence found for this call' })
    }
    return res.json({ data: { intelligence } })
  } catch (error) {
    console.error('Error fetching intelligence:', error)
    return res.status(500).json({ error: 'Failed to fetch intelligence' })
  }
}

export const getLeadIntelligence = async (req: Request, res: Response) => {
  const { leadId } = req.params
  const organizationId = req.organizationId!
  const limit = parseInt(req.query.limit as string) || 20
  const offset = parseInt(req.query.offset as string) || 0

  try {
    const intelligence = await callIntelligenceService.getLeadIntelligence(
      leadId,
      organizationId,
      { limit, offset },
    )
    return res.json({ data: intelligence })
  } catch (error) {
    console.error('Error fetching lead intelligence:', error)
    return res.status(500).json({ error: 'Failed to fetch lead intelligence' })
  }
}

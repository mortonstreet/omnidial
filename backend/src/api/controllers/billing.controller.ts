import { Request, Response } from 'express'
import * as billingService from '@/services/billing.service'

export const getUsageDashboard = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!

  try {
    const result = await billingService.getUsageDashboard(organizationId)
    return res.json({ data: result })
  } catch (error) {
    console.error('Error fetching usage dashboard:', error)
    return res.status(500).json({ error: 'Failed to fetch usage dashboard' })
  }
}

export const getUsageHistory = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!

  try {
    const result = await billingService.getUsageHistory(organizationId)
    return res.json({ data: result })
  } catch (error) {
    console.error('Error fetching usage history:', error)
    return res.status(500).json({ error: 'Failed to fetch usage history' })
  }
}

export const acknowledgeOverageCap = async (req: Request, res: Response) => {
  const organizationId = req.organizationId!
  const { additionalCapCents } = req.body

  try {
    const result = await billingService.acknowledgeOverageCap(
      organizationId,
      additionalCapCents,
    )
    return res.json({ data: result })
  } catch (error) {
    console.error('Error acknowledging overage cap:', error)
    return res.status(500).json({ error: 'Failed to acknowledge overage cap' })
  }
}

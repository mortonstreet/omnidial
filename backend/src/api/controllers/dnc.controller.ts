import { AuthRequestHandler } from '@/types/handlers'
import * as dncService from '@/services/dnc.service'
import * as campaignLeadRepository from '@/repositories/campaign-lead.repository'
import * as campaignRepository from '@/repositories/campaign.repository'
import type {
  ListDncRequest,
  MarkLeadsDncRequest,
  RemoveCampaignLeadsRequest,
  UnmarkDncRequest,
} from '@shared/types/src/requests/dnc'

export const markLeadsDnc: AuthRequestHandler<MarkLeadsDncRequest> = async (
  req,
  res,
) => {
  const { organizationId, leadIds, reason } = req.validated

  try {
    const result = await dncService.markLeadsDnc(organizationId, leadIds, {
      reason,
      userId: req.user?.id,
    })
    return res.json({ data: result })
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }
}

export const unmarkDnc: AuthRequestHandler<UnmarkDncRequest> = async (
  req,
  res,
) => {
  const { organizationId, phone } = req.validated

  try {
    const result = await dncService.unmarkDnc(organizationId, phone)
    return res.json(result)
  } catch (error) {
    return res.status(400).json({ error: (error as Error).message })
  }
}

export const listDnc: AuthRequestHandler<ListDncRequest> = async (req, res) => {
  const { organizationId } = req.validated
  const entries = await dncService.listEntries(organizationId)

  return res.json({
    data: entries.map((entry) => ({
      id: entry.id,
      normalizedPhone: entry.normalizedPhone,
      leadId: entry.leadId,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
  })
}

export const removeCampaignLeads: AuthRequestHandler<
  RemoveCampaignLeadsRequest
> = async (req, res) => {
  const { organizationId, campaignId, leadIds } = req.validated

  const campaign = await campaignRepository.findById(campaignId, organizationId)
  if (!campaign) {
    return res.status(404).json({ error: 'Campaign not found' })
  }

  const removed = await campaignLeadRepository.removeMany(campaignId, leadIds)
  // Total Leads is denormalised on the campaign, so it has to be recounted.
  await campaignRepository.updateCounts(campaignId, organizationId)

  return res.json({ data: { removed } })
}

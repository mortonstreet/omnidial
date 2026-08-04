import type { CrmAdapter } from './types'
import { HubSpotCrmAdapter } from './hubspot.adapter'
import { SalesforceCrmAdapter } from './salesforce.adapter'
import { AttioCrmAdapter } from './attio.adapter'
import { PipedriveCrmAdapter } from './pipedrive.adapter'

export function getCrmAdapter(
  provider: string,
  organizationId: string,
): CrmAdapter {
  switch (provider) {
    case 'hubspot':
      return new HubSpotCrmAdapter(organizationId)
    case 'salesforce':
      return new SalesforceCrmAdapter(organizationId)
    case 'attio':
      return new AttioCrmAdapter(organizationId)
    case 'pipedrive':
      return new PipedriveCrmAdapter(organizationId)
    default:
      throw new Error(`Unknown CRM provider: ${provider}`)
  }
}

export type { CrmAdapter, CrmContact, CrmPushResult } from './types'

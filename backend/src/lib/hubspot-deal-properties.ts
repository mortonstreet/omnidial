import type { CrmContact } from '@/clients/crm/types'

/**
 * HubSpot's built-in deal properties for close date, win/loss reason and next
 * step - no custom properties, so no extra scopes or portal setup.
 */
export const dealTrackingProperties = (
  contact: CrmContact,
): Record<string, string> => {
  const properties: Record<string, string> = {}
  if (contact.dealClosedAt) {
    properties.closedate = contact.dealClosedAt.toISOString()
  }
  const reason = [contact.dealOutcomeReason, contact.dealOutcomeNotes]
    .filter(Boolean)
    .join(' - ')
  if (reason && contact.dealOutcome === 'lost') {
    properties.closed_lost_reason = reason
  }
  if (reason && contact.dealOutcome === 'won') {
    properties.closed_won_reason = reason
  }
  if (contact.nextStep) {
    // HubSpot caps hs_next_step at 255 characters.
    properties.hs_next_step = contact.nextStep.slice(0, 255)
  }
  return properties
}

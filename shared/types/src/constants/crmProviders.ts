export interface CrmProviderMetadata {
  key: string
  name: string
  shortName: string
  description: string
  color: string
}

export const CRM_PROVIDERS: CrmProviderMetadata[] = [
  { key: 'omnidial', name: 'OmniDial', shortName: 'OD', description: 'Internal lead cache', color: '#10B981' },
  { key: 'hubspot', name: 'HubSpot', shortName: 'HS', description: 'HubSpot CRM', color: '#FF7A59' },
  { key: 'salesforce', name: 'Salesforce', shortName: 'SF', description: 'Salesforce CRM', color: '#00A1E0' },
  { key: 'attio', name: 'Attio', shortName: 'AT', description: 'Attio CRM', color: '#6C5CE7' },
]

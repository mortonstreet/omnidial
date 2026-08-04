export interface VendorMetadata {
  key: string
  name: string
  description: string
}

export const ENRICHMENT_VENDORS: VendorMetadata[] = [
  { key: 'apollo', name: 'Apollo.io', description: 'B2B contact and company data' },
  { key: 'zoominfo', name: 'ZoomInfo', description: 'Enterprise B2B intelligence' },
  { key: 'clearbit', name: 'Clearbit', description: 'Real-time enrichment API' },
  { key: 'lusha', name: 'Lusha', description: 'Direct dial and email finder' },
  { key: 'prospeo', name: 'Prospeo', description: 'Email and LinkedIn enrichment' },
]

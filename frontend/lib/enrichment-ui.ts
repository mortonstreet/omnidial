import type {
  DataVendorProvider,
  VendorConnectionResponse,
  VendorDataType,
} from '@shared/types/src'

export type ContactEnrichmentField = Extract<VendorDataType, 'phone' | 'email'>

const CONTACT_ENRICHMENT_PROVIDERS: DataVendorProvider[] = [
  'prospeo',
  'forager',
  'leadmagic',
  'apollo',
  'zoominfo',
  'clearbit',
  'lusha',
  'enrichengine',
]

const PROVIDER_LABELS: Record<DataVendorProvider, string> = {
  zoominfo: 'ZoomInfo',
  apollo: 'Apollo',
  clearbit: 'Clearbit',
  lusha: 'Lusha',
  enrichengine: 'EnrichEngine',
  prospeo: 'Prospeo',
  forager: 'Forager',
  leadmagic: 'LeadMagic',
  firecrawl: 'Firecrawl',
}

export function getEnrichmentProviderLabel(provider: DataVendorProvider) {
  return PROVIDER_LABELS[provider] ?? provider
}

export function getActiveContactEnrichmentVendors(
  vendors: VendorConnectionResponse[] | undefined,
) {
  return (vendors ?? []).filter(
    (vendor) =>
      vendor.isActive &&
      CONTACT_ENRICHMENT_PROVIDERS.includes(vendor.provider) &&
      vendor.enabledDataTypes.some(
        (type) => type === 'phone' || type === 'email',
      ),
  )
}

export function hasUsablePhone(value?: string | null) {
  if (!value) return false
  const digits = value.replace(/\D/g, '')
  return (
    digits.length === 10 || (digits.length === 11 && digits.startsWith('1'))
  )
}

export function hasUsableEmail(value?: string | null) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function getDefaultContactEnrichmentFields(options: {
  hasPhone?: boolean
  hasEmail?: boolean
}): ContactEnrichmentField[] {
  const fields: ContactEnrichmentField[] = []
  if (!options.hasPhone) fields.push('phone')
  if (!options.hasEmail) fields.push('email')
  return fields
}

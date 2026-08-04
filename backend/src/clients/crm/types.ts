export interface CrmContact {
  internalLeadId?: string
  externalId?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  company?: string
  title?: string
  linkedInUrl?: string
}

export interface CrmPushResult {
  externalId: string
  externalUrl?: string
  success: boolean
}

export interface CrmSearchResult {
  externalId: string
  email?: string
}

export interface CrmAdapter {
  readonly provider: string
  testConnection(): Promise<{ success: boolean; message: string }>
  pushContact(contact: CrmContact): Promise<CrmPushResult>
  searchContact(query: string): Promise<CrmSearchResult[]>
}

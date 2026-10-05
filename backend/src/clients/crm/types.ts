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
  dealValue?: number | string | null
  pipelineStageLabel?: string
  dealOutcome?: string | null
  dealClosedAt?: Date | null
  dealOutcomeReason?: string | null
  dealOutcomeNotes?: string | null
  /** Latest AI-extracted next step from a call / email / meeting. */
  nextStep?: string | null
  /** Extra ways to reach the contact, beyond the primary email/phone. */
  secondaryEmails?: string[]
  secondaryPhones?: string[]
}

export interface CrmPushResult {
  externalId: string
  externalUrl?: string
  success: boolean
}

export interface CrmSearchResult {
  externalId: string
  email?: string
  phone?: string
  linkedInUrl?: string
}

export interface CrmAdapter {
  readonly provider: string
  testConnection(): Promise<{ success: boolean; message: string }>
  pushContact(contact: CrmContact): Promise<CrmPushResult>
  searchContact(query: string): Promise<CrmSearchResult[]>
}

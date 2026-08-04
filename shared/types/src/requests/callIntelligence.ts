// Decision Maker Info
export interface DecisionMakerInfo {
  name: string | null
  title: string | null
  role: 'decision_maker' | 'influencer' | 'gatekeeper' | 'end_user' | 'unknown'
  notes: string | null
}

// Call Intelligence Record
export interface CallIntelligenceRecord {
  id: string
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  leadId: string | null
  decisionMaker: DecisionMakerInfo
  currentStrategies: string[]
  painPoints: string[]
  techStack: string[]
  talkingPoints: string[]
  summary: string
  modelUsed: string
  tokensUsed: number
  analysisTimeMs: number
  createdAt: string
  updatedAt: string
  // Joined lead info
  leadFirstName?: string | null
  leadLastName?: string | null
  leadCompany?: string | null
}

// Response types
export interface IntelligenceEligibilityResponse {
  data: {
    eligible: boolean
    reason?: string
    hasExisting?: boolean
  }
}

export interface GetIntelligenceResponse {
  data: {
    intelligence: CallIntelligenceRecord
  }
}

export interface GenerateIntelligenceResponse {
  data: {
    intelligence: CallIntelligenceRecord
  }
}

export interface LeadIntelligenceResponse {
  data: CallIntelligenceRecord[]
}

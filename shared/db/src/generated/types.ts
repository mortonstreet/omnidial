import type { ColumnType } from 'kysely'
export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>
export type Timestamp = ColumnType<Date, Date | string, Date | string>

export type A2pBrandRegistration = {
  id: string
  organizationId: string
  twilioBrandSid: string | null
  businessName: string
  businessType: string
  ein: string | null
  websiteUrl: string
  vertical: string
  companyAddress: unknown
  contactInfo: unknown
  status: Generated<string>
  trustScore: number | null
  submittedAt: Timestamp | null
  approvedAt: Timestamp | null
  rejectionReason: string | null
  createdAt: Generated<Timestamp>
}
export type A2pCampaign = {
  id: string
  brandRegistrationId: string
  twilioCampaignSid: string | null
  useCase: string
  useCaseDescription: string
  sampleMessages: string[]
  optInKeywords: Generated<string[]>
  optOutKeywords: Generated<string[]>
  optInMessage: string
  optOutMessage: string
  status: Generated<string>
  dailyLimit: number | null
  tps: number | null
  createdAt: Generated<Timestamp>
}
export type Account = {
  id: string
  accountId: string
  providerId: string
  userId: string
  accessToken: string | null
  refreshToken: string | null
  idToken: string | null
  accessTokenExpiresAt: Timestamp | null
  refreshTokenExpiresAt: Timestamp | null
  scope: string | null
  password: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type ActiveDialerSession = {
  id: string
  organizationId: string
  userId: string
  twilioConfigId: string
  status: Generated<string>
  currentCallId: string | null
  campaignId: string | null
  listId: string | null
  startedAt: Generated<Timestamp>
  endedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
  currentLeadId: string | null
  currentLeadName: string | null
  callsThisSession: Generated<number>
  connectedThisSession: Generated<number>
}
export type Activity = {
  id: string
  type: string
  userId: string
  organizationId: string
  description: string
  metadata: Generated<unknown>
  createdAt: Generated<Timestamp>
}
export type AdminAuditLog = {
  id: string
  adminUserId: string
  action: string
  targetType: string
  targetId: string | null
  details: unknown | null
  ipAddress: string | null
  createdAt: Generated<Timestamp>
}
export type Agent = {
  id: string
  organizationId: string
  memberId: string
  name: string
  description: string | null
  systemPrompt: string
  status: Generated<string>
  emailEnabled: Generated<boolean>
  smsEnabled: Generated<boolean>
  dailyEmailLimit: Generated<number>
  dailySmsLimit: Generated<number>
  createdById: string
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
  orchestrationEnabled: Generated<boolean>
  orchestratorDefinitionId: string | null
}
export type AgentApproval = {
  id: string
  organizationId: string
  executionId: string
  approvalType: string
  actionSummary: string
  actionDetails: unknown
  leadId: string | null
  campaignId: string | null
  status: Generated<string>
  respondedById: string | null
  response: string | null
  responseNote: string | null
  modifications: unknown | null
  slackMessageTs: string | null
  slackChannelId: string | null
  expiresAt: Timestamp | null
  createdAt: Generated<Timestamp>
  respondedAt: Timestamp | null
}
export type AgentDefinition = {
  id: string
  organizationId: string
  name: string
  type: string
  description: string | null
  systemPrompt: string
  tools: Generated<unknown>
  guardrails: Generated<unknown>
  model: Generated<string>
  maxTokens: Generated<number>
  temperature: Generated<string>
  isActive: Generated<boolean>
  isSystem: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type AgentEmailConfig = {
  id: string
  agentId: string
  provider: string
  agentmailApiKeyEncrypted: string | null
  agentmailInboxId: string | null
  accessTokenEncrypted: string | null
  refreshTokenEncrypted: string | null
  tokenExpiresAt: Timestamp | null
  fromEmail: string
  fromName: string | null
  signatureHtml: string | null
  isVerified: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type AgentExecution = {
  id: string
  organizationId: string
  agentDefinitionId: string
  triggerType: string
  triggerContext: unknown | null
  parentExecutionId: string | null
  inputPrompt: string
  inputContext: unknown | null
  outputResponse: string | null
  outputToolCalls: unknown | null
  status: Generated<string>
  error: string | null
  leadId: string | null
  campaignId: string | null
  tokensInput: number | null
  tokensOutput: number | null
  durationMs: number | null
  estimatedCost: string | null
  createdAt: Generated<Timestamp>
  completedAt: Timestamp | null
}
export type AgentInstance = {
  id: string
  organizationId: string
  agentId: string
  provider: Generated<string>
  instanceUrl: string | null
  instanceId: string | null
  status: Generated<string>
  lastHeartbeat: Timestamp | null
  memoryMb: Generated<number>
  cpuCores: Generated<number>
  totalSessions: Generated<number>
  totalToolCalls: Generated<number>
  totalTokensUsed: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
  stoppedAt: Timestamp | null
}
export type AgentMemory = {
  id: string
  sessionId: string | null
  organizationId: string
  agentId: string
  memoryType: string
  key: string
  content: string
  embedding: unknown | null
  importance: Generated<number>
  accessCount: Generated<number>
  lastAccessedAt: Timestamp | null
  expiresAt: Timestamp | null
  sourceType: string | null
  sourceId: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type AgentMessage = {
  id: string
  agentId: string
  workflowId: string | null
  leadId: string
  campaignId: string | null
  messageType: Generated<string>
  status: Generated<string>
  emailSubject: string | null
  emailBodyHtml: string | null
  toEmail: string | null
  smsBody: string | null
  toPhone: string | null
  twilioMessageSid: string | null
  direction: Generated<string>
  fromPhone: string | null
  replyToMessageId: string | null
  deliveredAt: Timestamp | null
  openedAt: Timestamp | null
  clickedAt: Timestamp | null
  failureReason: string | null
  createdAt: Generated<Timestamp>
}
export type AgentSession = {
  id: string
  instanceId: string
  organizationId: string
  leadId: string | null
  campaignId: string | null
  clientId: string | null
  status: Generated<string>
  contextSummary: string | null
  messageCount: Generated<number>
  toolCallCount: Generated<number>
  tokensUsed: Generated<number>
  startedAt: Generated<Timestamp>
  lastActivityAt: Generated<Timestamp>
  completedAt: Timestamp | null
}
export type AgentSmsConfig = {
  id: string
  agentId: string
  twilioSubaccountSid: string | null
  twilioAuthTokenEncrypted: string | null
  twilioPhoneNumber: string | null
  twilioPhoneNumberSid: string | null
  twilioMessagingServiceSid: string | null
  a2pBrandSid: string | null
  a2pCampaignSid: string | null
  a2pStatus: string | null
  aiModel: Generated<string>
  aiSystemPrompt: string | null
  aiMaxTokens: Generated<number>
  aiTemperature: Generated<number>
  autonomousEnabled: Generated<boolean>
  maxRepliesPerLead: Generated<number>
  isActive: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type AgentTool = {
  id: string
  organizationId: string | null
  name: string
  description: string
  category: string
  parameters: unknown
  handler: string
  requiresApproval: Generated<boolean>
  isSystem: Generated<boolean>
  isActive: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type AgentToolCall = {
  id: string
  sessionId: string
  organizationId: string
  toolName: string
  toolInput: unknown
  toolOutput: unknown | null
  status: Generated<string>
  errorMessage: string | null
  durationMs: number | null
  requiresApproval: Generated<boolean>
  approvalStatus: string | null
  approvedById: string | null
  approvedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  completedAt: Timestamp | null
}
export type AgentToolExecution = {
  id: string
  executionId: string
  toolId: string
  input: unknown
  output: unknown | null
  error: string | null
  status: Generated<string>
  durationMs: number | null
  createdAt: Generated<Timestamp>
  completedAt: Timestamp | null
}
export type AgentUsage = {
  id: string
  organizationId: string
  agentDefinitionId: string
  date: Timestamp
  executionCount: Generated<number>
  tokenCount: Generated<number>
  approvalCount: Generated<number>
  errorCount: Generated<number>
  emailsSent: Generated<number>
  smsSent: Generated<number>
  estimatedCost: Generated<string>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type AgentWorkflow = {
  id: string
  agentId: string
  name: string
  triggerType: string
  triggerConfig: unknown
  actionType: string
  actionConfig: unknown
  targetType: string
  targetId: string | null
  targetFilters: Generated<unknown>
  isActive: Generated<boolean>
  executionCount: Generated<number>
  lastExecutedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type ApiKey = {
  id: string
  organizationId: string
  name: string
  keyHash: string
  keyPrefix: string
  scopes: string[]
  expiresAt: Timestamp | null
  lastUsedAt: Timestamp | null
  createdById: string
  createdAt: Generated<Timestamp>
  revokedAt: Timestamp | null
}
export type ApiKeyUsage = {
  id: string
  apiKeyId: string
  endpoint: string
  method: string
  statusCode: number
  createdAt: Generated<Timestamp>
}
export type BillingEvent = {
  id: string
  organizationId: string
  eventType: string
  metadata: Generated<unknown>
  createdAt: Generated<Timestamp>
}
export type BlitzParticipant = {
  id: string
  blitzId: string
  userId: string
  callCount: Generated<number>
  connectCount: Generated<number>
  meetingCount: Generated<number>
  rank: number | null
  joinedAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type Call = {
  id: string
  twilioConfigId: string
  userId: string
  leadId: string | null
  campaignId: string | null
  twilioCallSid: string | null
  dialCallSid: string | null
  conferenceSid: string | null
  fromNumber: string
  toNumber: string
  direction: Generated<string>
  status: Generated<string>
  dispositionId: string | null
  duration: Generated<number>
  recordingUrl: string | null
  recordingSid: string | null
  voicemailDropped: Generated<boolean>
  voicemailLeft: Generated<boolean>
  voicemailReadAt: Timestamp | null
  startedAt: Generated<Timestamp>
  answeredAt: Timestamp | null
  endedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
  parallelSessionId: string | null
  wasParallelAbandoned: Generated<boolean>
  predictiveScore: string | null
  poolNumberId: string | null
}
export type CallAnswerPattern = {
  id: string
  organizationId: string
  dayOfWeek: number
  hourOfDay: number
  attempts: Generated<number>
  answers: Generated<number>
  answerRate: string
  updatedAt: Generated<Timestamp>
}
export type CallbackRoute = {
  id: string
  organizationId: string
  poolNumberId: string
  leadPhone: string
  repUserId: string
  lastCallAt: Generated<Timestamp>
  expiresAt: Timestamp
  createdAt: Generated<Timestamp>
}
export type CallBlitz = {
  id: string
  organizationId: string
  name: string
  description: string | null
  status: Generated<string>
  startAt: Timestamp
  endAt: Timestamp
  goalType: Generated<string>
  goalTarget: number | null
  prizeDescription: string | null
  createdById: string
  startedAt: Timestamp | null
  endedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CallCoaching = {
  id: string
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  overallScore: Generated<number>
  unhingedQuote: string | null
  strengths: Generated<string[]>
  improvements: Generated<string[]>
  feedback: Generated<unknown>
  modelUsed: Generated<string>
  tokensUsed: Generated<number>
  analysisTimeMs: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CallIntelligence = {
  id: string
  callId: string
  transcriptId: string
  organizationId: string
  userId: string
  leadId: string | null
  decisionMaker: Generated<unknown>
  currentStrategies: Generated<unknown>
  painPoints: Generated<unknown>
  techStack: Generated<unknown>
  talkingPoints: Generated<unknown>
  summary: Generated<string>
  modelUsed: Generated<string>
  tokensUsed: Generated<number>
  analysisTimeMs: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CallTranscript = {
  id: string
  callId: string
  organizationId: string
  transcriptText: string
  transcriptSource: Generated<string>
  speakerLabels: Generated<unknown>
  durationSeconds: Generated<number>
  language: Generated<string>
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type Campaign = {
  id: string
  organizationId: string
  createdById: string
  clientId: string | null
  name: string
  leadCount: Generated<number>
  dialedCount: Generated<number>
  connectedCount: Generated<number>
  lastCalledAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CampaignLead = {
  id: string
  campaignId: string
  leadId: string
  assignedUserId: string | null
  status: Generated<string>
  dialOrder: Generated<number>
  createdAt: Generated<Timestamp>
  predictiveScore: string | null
  scoreDialOrder: number | null
}
export type CampaignList = {
  id: string
  campaignId: string
  listId: string
  addedAt: Generated<Timestamp>
}
export type CampaignUser = {
  campaignId: string
  userId: string
}
export type ClawdBodyInstance = {
  id: string
  organizationId: string
  vmId: string
  vmName: string
  vmUrl: string
  vmRegion: Generated<string>
  vmSize: Generated<string>
  memoryGb: Generated<number>
  cpuCores: Generated<number>
  storageGb: Generated<number>
  status: Generated<string>
  healthStatus: Generated<string>
  lastHealthCheck: Timestamp | null
  activeAgents: Generated<number>
  totalSessions: Generated<number>
  uptimeSeconds: Generated<number>
  hourlyRate: Generated<number>
  totalCost: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
  terminatedAt: Timestamp | null
}
export type Client = {
  id: string
  organizationId: string
  name: string
  color: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type ClientPhoneNumber = {
  id: string
  organizationId: string
  clientId: string
  phoneNumber: string
  friendlyName: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type ClientUserAssignment = {
  id: string
  organizationId: string
  clientId: string
  userId: string
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CoachCard = {
  id: string
  organizationId: string
  title: string
  category: Generated<string>
  triggerPhrases: Generated<string[]>
  content: string
  tips: Generated<string[]>
  isActive: Generated<boolean>
  sortOrder: Generated<number>
  createdById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CoachCardTrigger = {
  id: string
  coachCardId: string
  callId: string
  userId: string
  triggerPhrase: string
  confidence: string | null
  wasHelpful: boolean | null
  triggeredAt: Generated<Timestamp>
}
export type CreditTransaction = {
  id: string
  organizationId: string
  paymentInvoiceId: string
  amount: number
  type: string
  metadata: unknown
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type CrmSyncRecord = {
  id: string
  organizationId: string
  leadId: string
  provider: string
  externalId: string
  externalUrl: string | null
  syncDirection: string
  syncStatus: string
  lastSyncedAt: Timestamp
  errorMessage: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type CustomFieldSchema = {
  id: string
  organizationId: string
  name: string
  label: string
  fieldType: Generated<string>
  description: string | null
  isRequired: Generated<boolean>
  defaultValue: string | null
  validationRule: string | null
  sortOrder: Generated<number>
  isActive: Generated<boolean>
  createdById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type DataVendorConnection = {
  id: string
  organizationId: string
  provider: string
  apiKeyEncrypted: string
  isActive: Generated<boolean>
  priority: Generated<number>
  enabledDataTypes: Generated<string[]>
  creditsUsed: Generated<number>
  creditsLimit: number | null
  lastSyncAt: Timestamp | null
  connectedById: string
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type Disposition = {
  id: string
  twilioConfigId: string
  label: string
  color: Generated<string>
  sortOrder: Generated<number>
  isDefault: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type EnrichEngineConnection = {
  id: string
  organizationId: string
  apiKeyEncrypted: string
  isActive: Generated<boolean>
  lastSyncAt: Timestamp | null
  createdById: string
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type EnrichmentCache = {
  id: string
  lookupKey: string
  lookupType: string
  provider: string
  rawResponse: unknown
  normalizedData: unknown
  expiresAt: Timestamp
  hitCount: Generated<number>
  lastHitAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type EnrichmentHistory = {
  id: string
  organizationId: string
  leadId: string
  vendorConnectionId: string | null
  provider: string
  requestType: string
  fieldsRequested: Generated<string[]>
  fieldsEnriched: Generated<string[]>
  creditsCost: Generated<number>
  success: Generated<boolean>
  errorMessage: string | null
  responseTimeMs: number | null
  createdAt: Generated<Timestamp>
}
export type ErrorLog = {
  id: string
  code: string
  message: string
  description: string | null
  severity: string
  product: string
  category: string
  organizationId: string | null
  userId: string | null
  callId: string | null
  campaignId: string | null
  leadId: string | null
  twilioCallSid: string | null
  metadata: Generated<unknown>
  source: string | null
  requestId: string | null
  stackTrace: string | null
  status: Generated<string>
  resolvedAt: Timestamp | null
  resolvedBy: string | null
  resolutionNote: string | null
  occurredAt: Generated<Timestamp>
  createdAt: Generated<Timestamp>
}
export type Example = {
  id: string
  name: string
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type Integration = {
  id: string
  organizationId: string
  provider: string
  accessToken: string | null
  refreshToken: string | null
  tokenExpiresAt: Timestamp | null
  connectedById: string
  config: unknown | null
  autoSyncToCrm: Generated<boolean>
  lastSyncAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type Invitation = {
  id: string
  clerkInvitationId: string | null
  organizationId: string
  email: string
  role: string | null
  status: string
  expiresAt: Timestamp
  createdAt: Timestamp
  inviterId: string
}
export type Lead = {
  id: string
  organizationId: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string | null
  normalizedPhone: string | null
  company: string | null
  title: string | null
  linkedInUrl: string | null
  website: string | null
  customFields: Generated<unknown>
  pipelineStageId: string | null
  dealValue: string | null
  aiCompanySummary: string | null
  aiCompanyOverview: string | null
  aiSalesTalkingPoints: unknown | null
  aiBusinessContext: unknown | null
  aiSummaryGeneratedAt: Timestamp | null
  aiSummaryProvider: string | null
  createdById: string | null
  lastModifiedById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
  deletedAt: Timestamp | null
  phoneType: string | null
  totalCallAttempts: Generated<number>
  totalAnswers: Generated<number>
  lastCallAt: Timestamp | null
  enrichmentStatus: string | null
  enrichmentSources: Generated<string[]>
  timezone: string | null
  timezoneResolvedAt: Timestamp | null
  hasPersonalVoicemail: boolean | null
  clientId: string | null
}
export type LeadContactInfo = {
  id: string
  leadId: string
  type: string
  value: string
  isPrimary: Generated<boolean>
  isVerified: Generated<boolean>
  source: string | null
  confidence: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type LeadList = {
  id: string
  organizationId: string
  folderId: string | null
  name: string
  description: string | null
  leadCount: Generated<number>
  importStatus: Generated<string>
  importError: string | null
  createdById: string
  lastModifiedById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type LeadListEntry = {
  id: string
  listId: string
  leadId: string
  sortOrder: Generated<number>
  createdAt: Generated<Timestamp>
  removedAt: Timestamp | null
}
export type LeadListFolder = {
  id: string
  organizationId: string
  parentId: string | null
  name: string
  color: Generated<string>
  sortOrder: Generated<number>
  createdById: string | null
  lastModifiedById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type LeadPredictiveScore = {
  id: string
  organizationId: string
  leadId: string
  score: string
  phoneType: string | null
  bestDayOfWeek: number | null
  bestHourOfDay: number | null
  totalAttempts: Generated<number>
  totalAnswers: Generated<number>
  lastAttemptAt: Timestamp | null
  lastAnswerAt: Timestamp | null
  hasPersonalVoicemail: boolean | null
  calculatedAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type LeadQualification = {
  id: string
  organizationId: string
  leadId: string
  agentId: string | null
  category: string
  score: number
  reasoning: string
  companyResearch: unknown | null
  linkedInData: unknown | null
  intentSignals: unknown | null
  generatedEmail: unknown | null
  generatedSms: string | null
  reviewStatus: Generated<string>
  reviewedById: string | null
  reviewedAt: Timestamp | null
  reviewNotes: string | null
  emailSentAt: Timestamp | null
  smsSentAt: Timestamp | null
  slackMessageTs: string | null
  slackChannelId: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type ListFavorite = {
  id: string
  userId: string
  listId: string | null
  folderId: string | null
  createdAt: Generated<Timestamp>
}
export type ListOpen = {
  id: string
  userId: string
  listId: string | null
  folderId: string | null
  openedAt: Generated<Timestamp>
}
export type LiveTranscriptSegment = {
  id: string
  callId: string
  organizationId: string
  speaker: Generated<string>
  text: string
  confidence: string | null
  startMs: number
  endMs: number
  isFinal: Generated<boolean>
  createdAt: Generated<Timestamp>
}
export type ManagerListenSession = {
  id: string
  organizationId: string
  managerId: string
  repId: string
  callId: string
  conferenceSid: string | null
  mode: Generated<string>
  startedAt: Generated<Timestamp>
  endedAt: Timestamp | null
  createdAt: Generated<Timestamp>
}
export type Member = {
  id: string
  clerkMembershipId: string | null
  organizationId: string
  userId: string
  role: string
  createdAt: Timestamp
}
export type Note = {
  id: string
  organizationId: string
  userId: string
  leadId: string
  content: string
  createdAt: Generated<Timestamp>
}
export type Notification = {
  id: string
  userId: string
  title: string
  message: string
  link: string | null
  readAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type OrchestrationJob = {
  id: string
  organizationId: string
  name: string
  description: string | null
  jobType: string
  targetType: string
  targetId: string | null
  targetFilters: Generated<unknown>
  targetCount: Generated<number>
  maxParallel: Generated<number>
  batchSize: Generated<number>
  status: Generated<string>
  progress: Generated<number>
  processedCount: Generated<number>
  successCount: Generated<number>
  failureCount: Generated<number>
  scheduledAt: Timestamp | null
  startedAt: Timestamp | null
  completedAt: Timestamp | null
  estimatedEndAt: Timestamp | null
  config: Generated<unknown>
  retryPolicy: Generated<unknown>
  createdById: string
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type OrchestrationStep = {
  id: string
  jobId: string
  stepNumber: number
  stepType: string
  targetId: string | null
  targetData: unknown | null
  agentId: string | null
  sessionId: string | null
  status: Generated<string>
  input: unknown | null
  output: unknown | null
  errorMessage: string | null
  startedAt: Timestamp | null
  completedAt: Timestamp | null
  durationMs: number | null
  attemptCount: Generated<number>
  maxAttempts: Generated<number>
  nextRetryAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type Organization = {
  id: string
  clerkOrganizationId: string | null
  name: string
  slug: string
  logo: string | null
  createdAt: Timestamp
  metadata: string | null
  managedBySuperadmin: Generated<boolean>
}
export type ParallelDialAttempt = {
  id: string
  sessionId: string
  leadId: string
  callSid: string | null
  status: Generated<string>
  wasConnected: Generated<boolean>
  wasAbandoned: Generated<boolean>
  abandonedAfterMs: number | null
  startedAt: Generated<Timestamp>
  answeredAt: Timestamp | null
  endedAt: Timestamp | null
}
export type ParallelDialSession = {
  id: string
  organizationId: string
  userId: string
  campaignId: string | null
  listId: string | null
  lineCount: Generated<number>
  status: Generated<string>
  conferenceId: string | null
  totalAttempts: Generated<number>
  totalConnects: Generated<number>
  totalAbandoned: Generated<number>
  startedAt: Generated<Timestamp>
  endedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type PhoneNumberPool = {
  id: string
  organizationId: string
  phoneNumber: string
  friendlyName: string | null
  areaCode: string
  region: string | null
  country: Generated<string>
  twilioSid: string | null
  capabilities: Generated<string[]>
  cnamStatus: string | null
  cnamName: string | null
  isActive: Generated<boolean>
  lastUsedAt: Timestamp | null
  callsToday: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type PhoneProvisioning = {
  id: string
  organizationId: string
  twilioSubaccountSid: string | null
  twilioAuthTokenEncrypted: string | null
  apiKeySid: string | null
  apiKeySecretEncrypted: string | null
  twimlAppSid: string | null
  phoneNumber: string | null
  phoneNumberSid: string | null
  numberType: Generated<string>
  provisioningStatus: Generated<string>
  usesMainAccount: Generated<boolean>
  callerIdVerified: Generated<boolean>
  provisionedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type PipelineStage = {
  id: string
  organizationId: string
  label: string
  color: Generated<string>
  sortOrder: Generated<number>
  isDefault: Generated<boolean>
  createdAt: Generated<Timestamp>
}
export type PowerDialerProgress = {
  id: string
  userId: string
  campaignId: string
  listId: string
  currentIndex: Generated<number>
  totalLeads: Generated<number>
  dialedCount: Generated<number>
  isPaused: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type ResearchApproval = {
  id: string
  researchTaskId: string
  leadId: string
  fieldSchemaId: string | null
  fieldName: string
  fieldType: Generated<string>
  currentValue: string | null
  proposedValue: string
  source: string | null
  confidence: string | null
  status: Generated<string>
  reviewedById: string | null
  reviewedAt: Timestamp | null
  modifiedValue: string | null
  rejectionReason: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type ResearchHistory = {
  id: string
  organizationId: string
  leadId: string | null
  taskId: string | null
  action: string
  details: Generated<unknown>
  performedById: string | null
  createdAt: Generated<Timestamp>
}
export type ResearchTask = {
  id: string
  organizationId: string
  leadId: string
  templateId: string | null
  customPrompt: string | null
  targetUrls: Generated<string[]>
  status: Generated<string>
  priority: Generated<number>
  startedAt: Timestamp | null
  completedAt: Timestamp | null
  errorMessage: string | null
  retryCount: Generated<number>
  maxRetries: Generated<number>
  rawResults: unknown | null
  extractedData: unknown | null
  creditsUsed: Generated<number>
  crawlCount: Generated<number>
  createdById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type ResearchTemplate = {
  id: string
  organizationId: string | null
  name: string
  description: string | null
  prompt: string
  targetUrls: Generated<string[]>
  extractionSchema: Generated<unknown>
  fieldMappings: Generated<unknown>
  isSystemTemplate: Generated<boolean>
  isActive: Generated<boolean>
  createdById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type ScheduleEvent = {
  id: string
  type: string
  title: string
  leadId: string | null
  userId: string
  organizationId: string
  startTime: Timestamp
  endTime: Timestamp | null
  notes: string | null
  createdAt: Generated<Timestamp>
}
export type Script = {
  id: string
  organizationId: string
  campaignId: string | null
  name: string
  content: string
  isDefault: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type Session = {
  id: string
  expiresAt: Timestamp
  token: string
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
  ipAddress: string | null
  userAgent: string | null
  userId: string
  activeOrganizationId: string | null
  impersonatedBy: string | null
}
export type SlackLinkToken = {
  id: string
  workspaceId: string
  token: string
  slackUserId: string
  expiresAt: Timestamp
  usedAt: Timestamp | null
  createdAt: Generated<Timestamp>
}
export type SlackMessageLog = {
  id: string
  workspaceId: string
  channelId: string
  messageTs: string | null
  eventType: string | null
  payload: unknown | null
  success: Generated<boolean>
  errorMessage: string | null
  createdAt: Generated<Timestamp>
}
export type SlackNotificationRule = {
  id: string
  workspaceId: string
  channelId: string
  channelName: string | null
  eventType: string
  enabled: Generated<boolean>
  config: Generated<unknown>
  createdById: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type SlackUserLink = {
  id: string
  workspaceId: string
  userId: string
  slackUserId: string
  slackEmail: string | null
  slackDisplayName: string | null
  slackRealName: string | null
  slackTimezone: string | null
  notificationsEnabled: Generated<boolean>
  dmChannelId: string | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type SlackWorkspace = {
  id: string
  organizationId: string | null
  teamId: string
  teamName: string
  teamDomain: string | null
  botToken: string
  botUserId: string
  appId: string
  enterpriseId: string | null
  enterpriseName: string | null
  installedById: string | null
  installedBySlackId: string | null
  defaultChannelId: string | null
  reviewChannelId: string | null
  settings: Generated<unknown>
  isActive: Generated<boolean>
  isPending: Generated<boolean>
  lastActivityAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type SmsCampaign = {
  id: string
  organizationId: string
  name: string
  description: string | null
  status: Generated<string>
  sendWindowStart: Generated<string>
  sendWindowEnd: Generated<string>
  sendDays: Generated<number[]>
  defaultTimezone: Generated<string>
  aiEnabled: Generated<boolean>
  aiModel: string | null
  aiSystemPrompt: string | null
  valueProposition: string | null
  dailySendLimit: Generated<number>
  totalEnrolled: Generated<number>
  totalSent: Generated<number>
  totalDelivered: Generated<number>
  totalReplied: Generated<number>
  totalUnsubscribed: Generated<number>
  createdById: string
  activatedAt: Timestamp | null
  completedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type SmsCampaignEnrollment = {
  id: string
  campaignId: string
  leadId: string
  status: Generated<string>
  currentStep: Generated<number>
  nextSendAt: Timestamp | null
  timezone: string | null
  researchData: unknown | null
  lastSentAt: Timestamp | null
  repliedAt: Timestamp | null
  unsubscribedAt: Timestamp | null
  enrolledAt: Generated<Timestamp>
  completedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type SmsCampaignList = {
  id: string
  campaignId: string
  listId: string
  addedAt: Generated<Timestamp>
}
export type SmsCampaignMessage = {
  id: string
  campaignId: string
  enrollmentId: string
  stepId: string
  leadId: string
  toPhone: string
  messageBody: string
  originalTemplate: string
  aiPersonalized: Generated<boolean>
  twilioMessageSid: string | null
  status: Generated<string>
  failureReason: string | null
  scheduledAt: Timestamp | null
  sentAt: Timestamp | null
  deliveredAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type SmsCampaignStep = {
  id: string
  campaignId: string
  stepNumber: number
  dayOffset: number
  messageTemplate: string
  aiEnabled: boolean | null
  aiPromptOverride: string | null
  skipIfReplied: Generated<boolean>
  totalSent: Generated<number>
  totalDelivered: Generated<number>
  totalFailed: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type Subscription = {
  id: string
  plan: string
  referenceId: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  status: Generated<string | null>
  periodStart: Timestamp | null
  periodEnd: Timestamp | null
  trialStart: Timestamp | null
  trialEnd: Timestamp | null
  cancelAtPeriodEnd: Generated<boolean | null>
  seats: number | null
  accountStatus: Generated<string>
  trustTier: Generated<string>
  overageCapCents: Generated<number>
  overageCapHit: Generated<boolean>
}
export type Task = {
  id: string
  organizationId: string
  userId: string
  leadId: string
  title: string
  dueAt: Timestamp | null
  completedAt: Timestamp | null
  createdAt: Generated<Timestamp>
}
export type TwilioConfig = {
  id: string
  organizationId: string
  accountSid: string
  authTokenEncrypted: string
  phoneNumbers: Generated<string[]>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type TwilioIsvConfig = {
  id: string
  accountSid: string
  authTokenEncrypted: string
  apiKeySid: string
  apiKeySecretEncrypted: string
  isActive: Generated<boolean>
  createdAt: Generated<Timestamp>
}
export type TwoFactor = {
  id: string
  secret: string
  backupCodes: string
  userId: string
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type UsageCycle = {
  id: string
  organizationId: string
  subscriptionId: string
  periodStart: Timestamp
  periodEnd: Timestamp
  includedMinutes: number
  usedMinutes: Generated<number>
  overageMinutes: Generated<number>
  overageAmountCents: Generated<number>
  overageRateCents: number
  overageReportedToStripe: Generated<number>
  lastStripeReportAt: Timestamp | null
  isCurrent: Generated<boolean>
  finalized: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type User = {
  id: string
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
  email: string
  emailVerified: Generated<boolean>
  clerkUserId: string | null
  name: string | null
  image: string | null
  stripeCustomerId: string | null
  lastActiveOrganizationId: string | null
  role: string | null
  banned: Generated<boolean | null>
  banReason: string | null
  banExpires: Timestamp | null
  mustResetPassword: Generated<boolean>
  passwordResetAt: Timestamp | null
  passwordResetByUserId: string | null
  onboardingRole: string | null
  onboardingIndustry: string | null
  onboardingComplete: Generated<boolean>
}
export type Verification = {
  id: string
  identifier: string
  value: string
  expiresAt: Timestamp
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type VoicemailDrop = {
  id: string
  twilioConfigId: string
  userId: string
  name: string
  recordingUrl: string
  duration: Generated<number>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type VoicemailGreeting = {
  id: string
  twilioConfigId: string
  name: string
  recordingUrl: string
  recordingSid: string | null
  duration: Generated<number>
  isActive: Generated<boolean>
  createdAt: Generated<Timestamp>
  updatedAt: Timestamp
}
export type WebhookEventReceipt = {
  id: string
  provider: string
  eventId: string
  eventType: string | null
  status: string
  hash: string | null
  processedAt: Timestamp | null
  createdAt: Generated<Timestamp>
  updatedAt: Generated<Timestamp>
}
export type DB = {
  a2p_brand_registration: A2pBrandRegistration
  a2p_campaign: A2pCampaign
  account: Account
  active_dialer_session: ActiveDialerSession
  activity: Activity
  admin_audit_log: AdminAuditLog
  agent: Agent
  agent_approval: AgentApproval
  agent_definition: AgentDefinition
  agent_email_config: AgentEmailConfig
  agent_execution: AgentExecution
  agent_instance: AgentInstance
  agent_memory: AgentMemory
  agent_message: AgentMessage
  agent_session: AgentSession
  agent_sms_config: AgentSmsConfig
  agent_tool: AgentTool
  agent_tool_call: AgentToolCall
  agent_tool_execution: AgentToolExecution
  agent_usage: AgentUsage
  agent_workflow: AgentWorkflow
  api_key: ApiKey
  api_key_usage: ApiKeyUsage
  billing_event: BillingEvent
  blitz_participant: BlitzParticipant
  call: Call
  call_answer_pattern: CallAnswerPattern
  call_blitz: CallBlitz
  call_coaching: CallCoaching
  call_intelligence: CallIntelligence
  call_transcript: CallTranscript
  callback_route: CallbackRoute
  campaign: Campaign
  campaign_lead: CampaignLead
  campaign_list: CampaignList
  campaign_user: CampaignUser
  clawdbody_instance: ClawdBodyInstance
  client: Client
  client_phone_number: ClientPhoneNumber
  client_user_assignment: ClientUserAssignment
  coach_card: CoachCard
  coach_card_trigger: CoachCardTrigger
  credit_transaction: CreditTransaction
  crm_sync_record: CrmSyncRecord
  custom_field_schema: CustomFieldSchema
  data_vendor_connection: DataVendorConnection
  disposition: Disposition
  enrichengine_connection: EnrichEngineConnection
  enrichment_cache: EnrichmentCache
  enrichment_history: EnrichmentHistory
  error_log: ErrorLog
  example: Example
  integration: Integration
  invitation: Invitation
  lead: Lead
  lead_contact_info: LeadContactInfo
  lead_list: LeadList
  lead_list_entry: LeadListEntry
  lead_list_folder: LeadListFolder
  lead_predictive_score: LeadPredictiveScore
  lead_qualification: LeadQualification
  list_favorite: ListFavorite
  list_open: ListOpen
  live_transcript_segment: LiveTranscriptSegment
  manager_listen_session: ManagerListenSession
  member: Member
  note: Note
  notification: Notification
  orchestration_job: OrchestrationJob
  orchestration_step: OrchestrationStep
  organization: Organization
  parallel_dial_attempt: ParallelDialAttempt
  parallel_dial_session: ParallelDialSession
  phone_number_pool: PhoneNumberPool
  phone_provisioning: PhoneProvisioning
  pipeline_stage: PipelineStage
  power_dialer_progress: PowerDialerProgress
  research_approval: ResearchApproval
  research_history: ResearchHistory
  research_task: ResearchTask
  research_template: ResearchTemplate
  schedule_event: ScheduleEvent
  script: Script
  session: Session
  slack_link_token: SlackLinkToken
  slack_message_log: SlackMessageLog
  slack_notification_rule: SlackNotificationRule
  slack_user_link: SlackUserLink
  slack_workspace: SlackWorkspace
  sms_campaign: SmsCampaign
  sms_campaign_enrollment: SmsCampaignEnrollment
  sms_campaign_list: SmsCampaignList
  sms_campaign_message: SmsCampaignMessage
  sms_campaign_step: SmsCampaignStep
  subscription: Subscription
  task: Task
  twilio_config: TwilioConfig
  twilio_isv_config: TwilioIsvConfig
  twoFactor: TwoFactor
  usage_cycle: UsageCycle
  user: User
  verification: Verification
  voicemail_drop: VoicemailDrop
  voicemail_greeting: VoicemailGreeting
  webhook_event_receipt: WebhookEventReceipt
}

import { z } from 'zod'

// ============================================
// Agent CRUD
// ============================================

export const CreateAgentRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().min(1).max(10000),
  emailEnabled: z.boolean().default(false),
  smsEnabled: z.boolean().default(false),
  dailyEmailLimit: z.number().int().min(1).max(1000).default(100),
  dailySmsLimit: z.number().int().min(1).max(500).default(50),
})
export type CreateAgentRequest = z.infer<typeof CreateAgentRequestSchema>

export const UpdateAgentRequestSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  systemPrompt: z.string().min(1).max(10000).optional(),
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  dailyEmailLimit: z.number().int().min(1).max(1000).optional(),
  dailySmsLimit: z.number().int().min(1).max(500).optional(),
})
export type UpdateAgentRequest = z.infer<typeof UpdateAgentRequestSchema>

export interface AgentResponse {
  id: string
  organizationId: string
  memberId: string
  name: string
  description: string | null
  status: string
  emailEnabled: boolean
  smsEnabled: boolean
  dailyEmailLimit: number
  dailySmsLimit: number
  createdById: string
  createdAt: string
  updatedAt: string
  emailConfig?: AgentEmailConfigResponse | null
  smsConfig?: AgentSmsConfigResponse | null
}

export interface AgentListResponse {
  agents: AgentResponse[]
  total: number
}

// ============================================
// Agent Email Configuration
// ============================================

export const AgentMailConfigSchema = z.object({
  provider: z.literal('agentmail'),
  apiKey: z.string().min(1),
  inboxId: z.string().min(1).optional(),
  fromEmail: z.string().email(),
  fromName: z.string().max(100).optional(),
  signatureHtml: z.string().max(5000).optional(),
})

export const GmailConfigSchema = z.object({
  provider: z.literal('gmail'),
  authCode: z.string().min(1),
  fromName: z.string().max(100).optional(),
  signatureHtml: z.string().max(5000).optional(),
})

export const OutlookConfigSchema = z.object({
  provider: z.literal('outlook'),
  authCode: z.string().min(1),
  fromName: z.string().max(100).optional(),
  signatureHtml: z.string().max(5000).optional(),
})

export const ConfigureAgentEmailRequestSchema = z.discriminatedUnion(
  'provider',
  [AgentMailConfigSchema, GmailConfigSchema, OutlookConfigSchema],
)
export type ConfigureAgentEmailRequest = z.infer<
  typeof ConfigureAgentEmailRequestSchema
>

export interface AgentEmailConfigResponse {
  id: string
  agentId: string
  provider: string
  fromEmail: string
  fromName: string | null
  isVerified: boolean
  createdAt: string
  updatedAt: string
}

// ============================================
// Agent SMS Configuration
// ============================================

export const ProvisionAgentSmsRequestSchema = z.object({
  areaCode: z.string().length(3).optional(),
  country: z.string().length(2).default('US'),
})
export type ProvisionAgentSmsRequest = z.infer<
  typeof ProvisionAgentSmsRequestSchema
>

export const ConfigureAgentSmsAiRequestSchema = z.object({
  aiModel: z.string().default('claude-3-5-sonnet'),
  aiSystemPrompt: z.string().max(5000).optional(),
  aiMaxTokens: z.number().int().min(50).max(500).default(160),
  aiTemperature: z.number().min(0).max(2).default(0.7),
})
export type ConfigureAgentSmsAiRequest = z.infer<
  typeof ConfigureAgentSmsAiRequestSchema
>

export interface AgentSmsConfigResponse {
  id: string
  agentId: string
  twilioPhoneNumber: string | null
  a2pStatus: string | null
  aiModel: string
  aiMaxTokens: number
  aiTemperature: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

// ============================================
// A2P Brand Registration
// ============================================

export const SubmitA2pBrandRequestSchema = z.object({
  businessName: z.string().min(1).max(200),
  businessType: z.enum([
    'sole_proprietor',
    'partnership',
    'corporation',
    'llc',
    'nonprofit',
    'government',
  ]),
  ein: z.string().length(9).optional(),
  websiteUrl: z.string().url(),
  vertical: z.enum([
    'technology',
    'healthcare',
    'finance',
    'retail',
    'education',
    'real_estate',
    'professional_services',
    'other',
  ]),
  companyAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().length(2),
    postalCode: z.string().min(5),
    country: z.string().length(2).default('US'),
  }),
  contactInfo: z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().min(10),
    title: z.string().optional(),
  }),
})
export type SubmitA2pBrandRequest = z.infer<typeof SubmitA2pBrandRequestSchema>

export interface A2pBrandResponse {
  id: string
  twilioBrandSid: string | null
  businessName: string
  status: string
  trustScore: number | null
  submittedAt: string | null
  approvedAt: string | null
  rejectionReason: string | null
}

// ============================================
// A2P Campaign
// ============================================

export const SubmitA2pCampaignRequestSchema = z.object({
  brandRegistrationId: z.string().min(1),
  useCase: z.enum([
    'marketing',
    'notifications',
    'account_notifications',
    'customer_care',
    'delivery_notifications',
    'fraud_alerts',
    'higher_education',
    'low_volume',
    'mixed',
    'polling_voting',
    'public_service',
    'security_alerts',
  ]),
  useCaseDescription: z.string().min(40).max(4096),
  sampleMessages: z.array(z.string().min(20).max(1024)).min(2).max(5),
  optInMessage: z.string().min(20).max(320),
  optOutMessage: z.string().min(20).max(320),
})
export type SubmitA2pCampaignRequest = z.infer<
  typeof SubmitA2pCampaignRequestSchema
>

export interface A2pCampaignResponse {
  id: string
  twilioCampaignSid: string | null
  useCase: string
  status: string
  dailyLimit: number | null
  tps: number | null
  createdAt: string
}

// ============================================
// Agent Workflows
// ============================================

export const TriggerConfigSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('schedule'),
    cron: z.string().min(1),
    timezone: z.string().default('America/New_York'),
  }),
  z.object({
    type: z.literal('event'),
    eventType: z.enum([
      'lead_created',
      'lead_qualified',
      'qualification_approved',
    ]),
  }),
  z.object({
    type: z.literal('manual'),
  }),
])

export const ActionConfigSchema = z.object({
  emailTemplate: z.string().optional(),
  smsTemplate: z.string().optional(),
  delayMinutes: z.number().int().min(0).max(10080).default(0), // Max 1 week
})

export const CreateAgentWorkflowRequestSchema = z.object({
  name: z.string().min(1).max(100),
  triggerType: z.enum(['schedule', 'event', 'manual']),
  triggerConfig: TriggerConfigSchema,
  actionType: z.enum(['send_email', 'send_sms', 'send_both']),
  actionConfig: ActionConfigSchema,
  targetType: z.enum(['campaign', 'list', 'lead']),
  targetId: z.string().optional(),
  targetFilters: z.record(z.string(), z.unknown()).default({}),
  isActive: z.boolean().default(false),
})
export type CreateAgentWorkflowRequest = z.infer<
  typeof CreateAgentWorkflowRequestSchema
>

export const UpdateAgentWorkflowRequestSchema =
  CreateAgentWorkflowRequestSchema.partial()
export type UpdateAgentWorkflowRequest = z.infer<
  typeof UpdateAgentWorkflowRequestSchema
>

export interface AgentWorkflowResponse {
  id: string
  agentId: string
  name: string
  triggerType: string
  triggerConfig: Record<string, unknown>
  actionType: string
  actionConfig: Record<string, unknown>
  targetType: string
  targetId: string | null
  targetFilters: Record<string, unknown>
  isActive: boolean
  executionCount: number
  lastExecutedAt: string | null
  createdAt: string
  updatedAt: string
}

// ============================================
// Lead Qualification
// ============================================

export const QualifyLeadRequestSchema = z.object({
  leadId: z.string().min(1),
  agentId: z.string().optional(),
  icpCriteria: z.string().min(1).max(5000),
  generateOutreach: z.boolean().default(true),
})
export type QualifyLeadRequest = z.infer<typeof QualifyLeadRequestSchema>

export const ReviewQualificationRequestSchema = z.object({
  action: z.enum(['approve', 'reject', 'edit']),
  reviewNotes: z.string().max(1000).optional(),
  editedEmail: z
    .object({
      subject: z.string().max(200),
      body: z.string().max(10000),
    })
    .optional(),
  editedSms: z.string().max(320).optional(),
})
export type ReviewQualificationRequest = z.infer<
  typeof ReviewQualificationRequestSchema
>

export interface LeadQualificationResponse {
  id: string
  organizationId: string
  leadId: string
  agentId: string | null
  category: 'high_intent' | 'medium' | 'low_intent' | 'disqualified'
  score: number
  reasoning: string
  companyResearch: Record<string, unknown> | null
  linkedInData: Record<string, unknown> | null
  intentSignals: Record<string, unknown> | null
  generatedEmail: {
    subject: string
    body: string
    approved?: boolean
  } | null
  generatedSms: string | null
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'edited'
  reviewedById: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  emailSentAt: string | null
  smsSentAt: string | null
  createdAt: string
  updatedAt: string
  lead?: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string | null
    company: string | null
  }
}

export interface QualificationStatsResponse {
  total: number
  highIntent: number
  medium: number
  lowIntent: number
  disqualified: number
  pendingReview: number
}

// ============================================
// Agent Messages
// ============================================

export const SendAgentMessageRequestSchema = z.object({
  leadId: z.string().min(1),
  messageType: z.enum(['email', 'sms']),
  emailSubject: z.string().max(200).optional(),
  emailBodyHtml: z.string().max(50000).optional(),
  smsBody: z.string().max(320).optional(),
  workflowId: z.string().optional(),
})
export type SendAgentMessageRequest = z.infer<
  typeof SendAgentMessageRequestSchema
>

export interface AgentMessageResponse {
  id: string
  agentId: string
  workflowId: string | null
  leadId: string
  campaignId: string | null
  messageType: string
  status: string
  emailSubject: string | null
  toEmail: string | null
  smsBody: string | null
  toPhone: string | null
  deliveredAt: string | null
  openedAt: string | null
  clickedAt: string | null
  failureReason: string | null
  createdAt: string
}

export interface AgentMessageListResponse {
  messages: AgentMessageResponse[]
  total: number
  hasMore: boolean
}

// ============================================
// ID Params
// ============================================

export const AgentIdParamSchema = z.object({
  agentId: z.string().min(1),
})
export type AgentIdParam = z.infer<typeof AgentIdParamSchema>

export const WorkflowIdParamSchema = z.object({
  agentId: z.string().min(1),
  workflowId: z.string().min(1),
})
export type WorkflowIdParam = z.infer<typeof WorkflowIdParamSchema>

export const QualificationIdParamSchema = z.object({
  qualificationId: z.string().min(1),
})
export type QualificationIdParam = z.infer<typeof QualificationIdParamSchema>

export const JobIdParamSchema = z.object({
  agentId: z.string().min(1),
  jobId: z.string().min(1),
})
export type JobIdParam = z.infer<typeof JobIdParamSchema>

// ============================================
// Orchestration Jobs
// ============================================

export const CreateOrchestrationJobRequestSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  jobType: z.enum(['qualification', 'outreach', 'research', 'followup']),
  targetType: z.enum(['leads', 'campaign', 'list']),
  targetId: z.string().optional(),
  targetFilters: z.record(z.string(), z.unknown()).optional(),
  maxParallel: z.number().int().min(1).max(100).default(5),
  batchSize: z.number().int().min(1).max(100).default(10),
  scheduledAt: z.string().datetime().optional(),
})
export type CreateOrchestrationJobRequest = z.infer<
  typeof CreateOrchestrationJobRequestSchema
>

export interface OrchestrationJobResponse {
  id: string
  organizationId: string
  agentId: string
  name: string
  jobType: string
  targetType: string
  targetId: string | null
  targetQuery: Record<string, unknown> | null
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  maxParallel: number
  retryAttempts: number
  retryDelayMs: number
  timeoutMs: number
  scheduledFor: string | null
  startedAt: string | null
  completedAt: string | null
  totalSteps: number
  completedSteps: number
  failedSteps: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface OrchestrationJobProgress {
  jobId: string
  status: string
  totalSteps: number
  completedSteps: number
  failedSteps: number
  percentComplete: number
  estimatedTimeRemaining: number | null
  currentlyProcessing: string[]
}

export interface OrchestrationStepResponse {
  id: string
  jobId: string
  leadId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  result: Record<string, unknown> | null
  errorMessage: string | null
  retryCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface OrchestrationJobListResponse {
  jobs: OrchestrationJobResponse[]
  total: number
}

export interface OrchestrationStepListResponse {
  steps: OrchestrationStepResponse[]
  total: number
  hasMore: boolean
}

// ============================================
// Agent Definitions (Orchestration Framework)
// ============================================

export const AgentDefinitionTypeSchema = z.enum([
  'orchestrator',
  'email',
  'sms',
  'research',
  'qualify',
  'analytics',
  'campaign',
])
export type AgentDefinitionType = z.infer<typeof AgentDefinitionTypeSchema>

export const CreateAgentDefinitionRequestSchema = z.object({
  name: z.string().min(1).max(100),
  type: AgentDefinitionTypeSchema,
  description: z.string().max(1000).nullable().optional(),
  systemPrompt: z.string().min(1).max(50000),
  tools: z.array(z.string()).default([]),
  guardrails: z.record(z.string(), z.unknown()).default({}),
  model: z.enum(['claude-haiku', 'claude-sonnet', 'claude-opus']).default('claude-sonnet'),
  maxTokens: z.number().int().min(256).max(8192).default(2048),
  temperature: z.number().min(0).max(2).default(0.5),
})
export type CreateAgentDefinitionRequest = z.infer<typeof CreateAgentDefinitionRequestSchema>

export const UpdateAgentDefinitionRequestSchema = CreateAgentDefinitionRequestSchema.partial().extend({
  isActive: z.boolean().optional(),
})
export type UpdateAgentDefinitionRequest = z.infer<typeof UpdateAgentDefinitionRequestSchema>

export interface AgentDefinitionResponse {
  id: string
  organizationId: string
  name: string
  type: AgentDefinitionType
  description: string | null
  systemPrompt: string
  tools: string[]
  guardrails: Record<string, unknown>
  model: string
  maxTokens: number
  temperature: number
  isActive: boolean
  isSystem: boolean
  createdAt: string
  updatedAt: string
}

export interface AgentDefinitionListResponse {
  definitions: AgentDefinitionResponse[]
  total: number
}

// ============================================
// Agent Invocation
// ============================================

export const InvokeAgentRequestSchema = z.object({
  prompt: z.string().min(1).max(50000),
  context: z.record(z.string(), z.unknown()).optional(),
  leadId: z.string().optional(),
  campaignId: z.string().optional(),
})
export type InvokeAgentRequest = z.infer<typeof InvokeAgentRequestSchema>

export const InvokeOrchestratorRequestSchema = InvokeAgentRequestSchema
export type InvokeOrchestratorRequest = z.infer<typeof InvokeOrchestratorRequestSchema>

export interface AgentExecutionMetrics {
  tokensInput: number
  tokensOutput: number
  durationMs: number
  estimatedCost: number
}

export interface ToolCallResult {
  toolName: string
  input: unknown
  output: unknown
  requiresApproval: boolean
  approvalId?: string
}

export interface PendingApproval {
  id: string
  type: string
  summary: string
  details: unknown
}

export interface InvokeAgentResponse {
  executionId: string
  status: 'completed' | 'awaiting_approval' | 'failed'
  response?: string
  toolCalls?: ToolCallResult[]
  pendingApprovals?: PendingApproval[]
  error?: string
  metrics: AgentExecutionMetrics
}

// ============================================
// Agent Executions
// ============================================

export interface AgentExecutionResponse {
  id: string
  organizationId: string
  agentDefinitionId: string
  agentName: string
  agentType: string
  triggerType: string
  triggerContext: unknown
  parentExecutionId: string | null
  inputPrompt: string
  inputContext: unknown
  outputResponse: string | null
  outputToolCalls: unknown
  status: 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'cancelled'
  error: string | null
  leadId: string | null
  campaignId: string | null
  tokensInput: number | null
  tokensOutput: number | null
  durationMs: number | null
  estimatedCost: string | null
  createdAt: string
  completedAt: string | null
}

export interface AgentExecutionListResponse {
  executions: AgentExecutionResponse[]
  total: number
  hasMore: boolean
}

// ============================================
// Agent Approvals
// ============================================

export interface AgentApprovalResponse {
  id: string
  organizationId: string
  executionId: string
  approvalType: string
  actionSummary: string
  actionDetails: unknown
  leadId: string | null
  campaignId: string | null
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'expired'
  respondedById: string | null
  response: string | null
  responseNote: string | null
  modifications: unknown
  expiresAt: string | null
  createdAt: string
  respondedAt: string | null
  // Joined fields
  leadFirstName?: string | null
  leadLastName?: string | null
  leadCompany?: string | null
  campaignName?: string | null
  agentName?: string | null
  agentType?: string | null
}

export interface AgentApprovalListResponse {
  approvals: AgentApprovalResponse[]
  total: number
  hasMore: boolean
}

export const RespondToApprovalRequestSchema = z.object({
  response: z.enum(['approved', 'rejected', 'modified']),
  note: z.string().max(1000).optional(),
  modifications: z.record(z.string(), z.unknown()).optional(),
})
export type RespondToApprovalRequest = z.infer<typeof RespondToApprovalRequestSchema>

export const BatchRespondToApprovalsRequestSchema = z.object({
  approvalIds: z.array(z.string()).min(1).max(100),
  response: z.enum(['approved', 'rejected']),
  note: z.string().max(1000).optional(),
})
export type BatchRespondToApprovalsRequest = z.infer<typeof BatchRespondToApprovalsRequestSchema>

// ============================================
// ID Params for Orchestration
// ============================================

export const DefinitionIdParamSchema = z.object({
  definitionId: z.string().min(1),
})
export type DefinitionIdParam = z.infer<typeof DefinitionIdParamSchema>

export const ExecutionIdParamSchema = z.object({
  executionId: z.string().min(1),
})
export type ExecutionIdParam = z.infer<typeof ExecutionIdParamSchema>

export const ApprovalIdParamSchema = z.object({
  approvalId: z.string().min(1),
})
export type ApprovalIdParam = z.infer<typeof ApprovalIdParamSchema>

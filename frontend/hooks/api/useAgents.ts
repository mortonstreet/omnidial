import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useActiveOrganization } from '@/lib/auth-client';
import { ENDPOINTS, QUERY_KEYS } from '@/lib/config';
import { get, post, patch, del } from '@/lib/api';

// Types

export interface Agent {
  id: string;
  organizationId: string;
  memberId: string;
  name: string;
  description: string | null;
  status: 'inactive' | 'active' | 'paused';
  emailEnabled: boolean;
  smsEnabled: boolean;
  dailyEmailLimit: number;
  dailySmsLimit: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  emailConfig?: AgentEmailConfig | null;
  smsConfig?: AgentSmsConfig | null;
}

export interface AgentEmailConfig {
  id: string;
  agentId: string;
  provider: string;
  fromEmail: string;
  fromName: string | null;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSmsConfig {
  id: string;
  agentId: string;
  twilioPhoneNumber: string | null;
  a2pStatus: string | null;
  aiModel: string;
  aiMaxTokens: number;
  aiTemperature: number;
  isActive: boolean;
  autonomousEnabled?: boolean;
  maxRepliesPerLead?: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentMessage {
  id: string;
  agentId: string;
  workflowId: string | null;
  leadId: string;
  campaignId: string | null;
  messageType: 'email' | 'sms';
  status: string;
  emailSubject: string | null;
  emailBodyHtml: string | null;
  toEmail: string | null;
  smsBody: string | null;
  toPhone: string | null;
  direction: 'inbound' | 'outbound';
  fromPhone: string | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  failureReason: string | null;
  createdAt: string;
}

export interface GmailStatus {
  connected: boolean;
  email?: string;
  verified?: boolean;
}

export interface AgentWorkflow {
  id: string;
  agentId: string;
  name: string;
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  actionType: string;
  actionConfig: Record<string, unknown>;
  targetType: string;
  targetId: string | null;
  targetFilters: Record<string, unknown>;
  isActive: boolean;
  executionCount: number;
  lastExecutedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadQualification {
  id: string;
  organizationId: string;
  leadId: string;
  agentId: string | null;
  category: 'high_intent' | 'medium' | 'low_intent' | 'disqualified';
  score: number;
  reasoning: string;
  companyResearch: Record<string, unknown> | null;
  linkedInData: Record<string, unknown> | null;
  intentSignals: Record<string, unknown> | null;
  generatedEmail: {
    subject: string;
    body: string;
    approved?: boolean;
  } | null;
  generatedSms: string | null;
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'edited';
  reviewedById: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  emailSentAt: string | null;
  smsSentAt: string | null;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    company: string | null;
  };
}

export interface OrchestrationJob {
  id: string;
  organizationId: string;
  name: string;
  jobType: string;
  targetType: string;
  targetId: string | null;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobProgress {
  jobId: string;
  status: string;
  totalSteps: number;
  completedSteps: number;
  failedSteps: number;
  progressPercent: number;
  estimatedTimeRemaining?: number;
}

export interface QualificationStats {
  total: number;
  highIntent: number;
  medium: number;
  lowIntent: number;
  disqualified: number;
  pendingReview: number;
}


// ============================================
// Agent Hooks
// ============================================

interface ListAgentsParams {
  status?: string;
}

export function useAgents(params: ListAgentsParams = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.agents(orgId), params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);
      if (params.status) searchParams.set('status', params.status);

      return get<Agent[]>(`${ENDPOINTS.AGENTS.LIST}?${searchParams.toString()}`);
    },
    enabled: !!orgId,
  });
}

export function useAgent(agentId: string | undefined) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agent(agentId),
    queryFn: async () => get<Agent>(ENDPOINTS.AGENTS.GET(agentId!)),
    enabled: !!orgId && !!agentId,
  });
}

export function useAgentStats(agentId: string | undefined) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentStats(agentId),
    queryFn: async () => get<Record<string, unknown>>(ENDPOINTS.AGENTS.STATS(agentId!)),
    enabled: !!orgId && !!agentId,
  });
}

interface CreateAgentParams {
  name: string;
  description?: string;
  systemPrompt: string;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  dailyEmailLimit?: number;
  dailySmsLimit?: number;
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: CreateAgentParams) => {
      return post<Agent>(ENDPOINTS.AGENTS.CREATE, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents(orgId) });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async ({ id, ...params }: { id: string } & Partial<CreateAgentParams>) => {
      return patch<Agent>(ENDPOINTS.AGENTS.UPDATE(id), params);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agent(variables.id) });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return del(ENDPOINTS.AGENTS.DELETE(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents(orgId) });
    },
  });
}

export function useActivateAgent() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return post<Agent>(ENDPOINTS.AGENTS.ACTIVATE(id), {});
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agent(id) });
    },
  });
}

export function useDeactivateAgent() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      return post<Agent>(ENDPOINTS.AGENTS.DEACTIVATE(id), {});
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agents(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agent(id) });
    },
  });
}

// ============================================
// Qualification Hooks
// ============================================

export function useQualificationsPending(params: { page?: number; limit?: number } = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: [...QUERY_KEYS.qualificationsPending(orgId), params],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      searchParams.set('organizationId', orgId!);
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.limit) searchParams.set('limit', params.limit.toString());

      return get<{ qualifications: LeadQualification[]; total: number; hasMore: boolean }>(
        `${ENDPOINTS.AGENTS.QUALIFICATIONS_PENDING}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId,
  });
}

export function useQualificationsStats() {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.qualificationsStats(orgId),
    queryFn: async () => get<QualificationStats>(ENDPOINTS.AGENTS.QUALIFICATIONS_STATS),
    enabled: !!orgId,
  });
}

export function useQualification(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.qualification(id),
    queryFn: async () => get<LeadQualification>(ENDPOINTS.AGENTS.QUALIFICATION(id!)),
    enabled: !!id,
  });
}

interface ReviewQualificationParams {
  id: string;
  action: 'approve' | 'reject' | 'edit';
  reviewNotes?: string;
  editedEmail?: { subject: string; body: string };
  editedSms?: string;
}

export function useReviewQualification() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async ({ id, ...params }: ReviewQualificationParams) => {
      return post<LeadQualification>(ENDPOINTS.AGENTS.QUALIFICATION_REVIEW(id), params);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualificationsPending(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualificationsStats(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualification(variables.id) });
    },
  });
}

export function useQualifyLead() {
  const queryClient = useQueryClient();
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useMutation({
    mutationFn: async (params: { leadId: string; agentId?: string; icpCriteria: string; generateOutreach?: boolean }) => {
      return post<LeadQualification>(ENDPOINTS.AGENTS.QUALIFICATIONS, {
        ...params,
        organizationId: orgId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualificationsPending(orgId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.qualificationsStats(orgId) });
    },
  });
}

// ============================================
// Orchestration Job Hooks
// ============================================

interface ListJobsParams {
  status?: string;
  limit?: number;
  offset?: number;
}

export function useAgentJobs(agentId: string | undefined, params: ListJobsParams = {}) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentJobs(agentId, params as Record<string, unknown>),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.limit) searchParams.set('limit', params.limit.toString());
      if (params.offset) searchParams.set('offset', params.offset.toString());

      return get<{ jobs: OrchestrationJob[]; total: number }>(
        `${ENDPOINTS.AGENTS.JOBS(agentId!)}?${searchParams.toString()}`
      );
    },
    enabled: !!orgId && !!agentId,
  });
}

export function useAgentJob(agentId: string | undefined, jobId: string | undefined) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentJob(agentId, jobId),
    queryFn: async () => get<OrchestrationJob>(ENDPOINTS.AGENTS.JOB(agentId!, jobId!)),
    enabled: !!orgId && !!agentId && !!jobId,
  });
}

export function useAgentJobProgress(agentId: string | undefined, jobId: string | undefined) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentJobProgress(agentId, jobId),
    queryFn: async () => get<JobProgress>(ENDPOINTS.AGENTS.JOB_PROGRESS(agentId!, jobId!)),
    enabled: !!orgId && !!agentId && !!jobId,
    refetchInterval: 5000, // Refresh every 5 seconds while viewing
  });
}

interface CreateJobParams {
  name: string;
  description?: string;
  jobType: 'qualification' | 'outreach' | 'research' | 'followup';
  targetType: 'leads' | 'campaign' | 'list';
  targetId?: string;
  targetFilters?: Record<string, unknown>;
  maxParallel?: number;
  batchSize?: number;
  scheduledAt?: string;
}

export function useCreateJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, ...params }: { agentId: string } & CreateJobParams) => {
      return post<OrchestrationJob>(ENDPOINTS.AGENTS.JOBS(agentId), params);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJobs(variables.agentId, {}) });
    },
  });
}

export function useStartJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, jobId }: { agentId: string; jobId: string }) => {
      return post<OrchestrationJob>(ENDPOINTS.AGENTS.JOB_START(agentId, jobId), {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJobs(variables.agentId, {}) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJob(variables.agentId, variables.jobId) });
    },
  });
}

export function usePauseJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, jobId }: { agentId: string; jobId: string }) => {
      return post<OrchestrationJob>(ENDPOINTS.AGENTS.JOB_PAUSE(agentId, jobId), {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJobs(variables.agentId, {}) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJob(variables.agentId, variables.jobId) });
    },
  });
}

export function useResumeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, jobId }: { agentId: string; jobId: string }) => {
      return post<OrchestrationJob>(ENDPOINTS.AGENTS.JOB_RESUME(agentId, jobId), {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJobs(variables.agentId, {}) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJob(variables.agentId, variables.jobId) });
    },
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, jobId }: { agentId: string; jobId: string }) => {
      return post<OrchestrationJob>(ENDPOINTS.AGENTS.JOB_CANCEL(agentId, jobId), {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJobs(variables.agentId, {}) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentJob(variables.agentId, variables.jobId) });
    },
  });
}

// ============================================
// Workflow Hooks
// ============================================

export function useAgentWorkflows(agentId: string | undefined) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentWorkflows(agentId),
    queryFn: async () => get<{ workflows: AgentWorkflow[] }>(ENDPOINTS.AGENTS.WORKFLOWS(agentId!)),
    enabled: !!orgId && !!agentId,
  });
}

interface CreateWorkflowParams {
  name: string;
  triggerType: 'schedule' | 'event' | 'manual';
  triggerConfig: Record<string, unknown>;
  actionType: 'send_email' | 'send_sms' | 'send_both';
  actionConfig: Record<string, unknown>;
  targetType: 'campaign' | 'list' | 'lead';
  targetId?: string;
  targetFilters?: Record<string, unknown>;
  isActive?: boolean;
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, ...params }: { agentId: string } & CreateWorkflowParams) => {
      return post<AgentWorkflow>(ENDPOINTS.AGENTS.WORKFLOWS(agentId), params);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentWorkflows(variables.agentId) });
    },
  });
}

export function useActivateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, workflowId }: { agentId: string; workflowId: string }) => {
      return post<AgentWorkflow>(ENDPOINTS.AGENTS.WORKFLOW_ACTIVATE(agentId, workflowId), {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentWorkflows(variables.agentId) });
    },
  });
}

export function useDeactivateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ agentId, workflowId }: { agentId: string; workflowId: string }) => {
      return post<AgentWorkflow>(ENDPOINTS.AGENTS.WORKFLOW_DEACTIVATE(agentId, workflowId), {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentWorkflows(variables.agentId) });
    },
  });
}

// ============================================
// Conversation Hooks
// ============================================

export interface ConversationMessage extends AgentMessage {
  lead?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    phone: string | null;
  };
}

export function useAgentConversations(agentId: string | undefined, leadId?: string) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentConversations(agentId, leadId),
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (leadId) searchParams.set('leadId', leadId);

      const url = searchParams.toString()
        ? `${ENDPOINTS.AGENTS.CONVERSATIONS(agentId!)}?${searchParams.toString()}`
        : ENDPOINTS.AGENTS.CONVERSATIONS(agentId!);

      return get<{ messages: ConversationMessage[]; total: number }>(url);
    },
    enabled: !!orgId && !!agentId,
  });
}

// ============================================
// Gmail OAuth Hooks
// ============================================

export function useGmailStatus(agentId: string | undefined) {
  const activeOrganization = useActiveOrganization();
  const orgId = activeOrganization?.data?.id;

  return useQuery({
    queryKey: QUERY_KEYS.agentGmailStatus(agentId),
    queryFn: async () => get<GmailStatus>(ENDPOINTS.AGENTS.GMAIL_STATUS(agentId!)),
    enabled: !!orgId && !!agentId,
  });
}

export function useConnectGmail() {
  return useMutation({
    mutationFn: async (agentId: string) => {
      const { url } = await get<{ url: string }>(ENDPOINTS.AGENTS.GMAIL_AUTH_URL(agentId));
      return url;
    },
    onSuccess: (url) => {
      // Redirect to Gmail OAuth
      window.location.href = url;
    },
  });
}

export function useDisconnectGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (agentId: string) => {
      return del(ENDPOINTS.AGENTS.GMAIL_DISCONNECT(agentId));
    },
    onSuccess: (_, agentId) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agentGmailStatus(agentId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agent(agentId) });
    },
  });
}

export function useTestGmailConnection() {
  return useMutation({
    mutationFn: async (agentId: string) => {
      return post<{ success: boolean; message: string; email?: string }>(
        ENDPOINTS.AGENTS.GMAIL_TEST(agentId),
        {}
      );
    },
  });
}

// ============================================
// Autonomous SMS Hooks
// ============================================

export function useToggleAutonomousSms() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      agentId,
      enabled,
      maxRepliesPerLead,
    }: {
      agentId: string;
      enabled: boolean;
      maxRepliesPerLead?: number;
    }) => {
      return patch<AgentSmsConfig>(ENDPOINTS.AGENTS.SMS_AUTONOMOUS(agentId), {
        autonomousEnabled: enabled,
        maxRepliesPerLead,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.agent(variables.agentId) });
    },
  });
}

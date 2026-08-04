import { AuthRequest } from '@/types/handlers'
import { Response, Request } from 'express'
import * as agentService from '@/services/agent.service'
import * as agentEmailService from '@/services/agentEmail.service'
import * as agentSmsService from '@/services/agentSms.service'
import * as agentWorkflowService from '@/services/agentWorkflow.service'
import * as leadQualificationService from '@/services/leadQualification.service'
import * as agentOrchestrator from '@/services/agentOrchestrator.service'
import * as gmailAgentService from '@/services/gmailAgent.service'
import { config } from '@/config'
import type {
  CreateAgentRequest,
  UpdateAgentRequest,
  ConfigureAgentEmailRequest,
  ProvisionAgentSmsRequest,
  ConfigureAgentSmsAiRequest,
  CreateAgentWorkflowRequest,
  UpdateAgentWorkflowRequest,
  QualifyLeadRequest,
  ReviewQualificationRequest,
  AgentIdParam,
  WorkflowIdParam,
  QualificationIdParam,
  CreateOrchestrationJobRequest,
  JobIdParam,
} from '@shared/types/src/requests/leadAgent'

// ============================================
// Agent CRUD
// ============================================

export const createAgent = async (
  req: AuthRequest<CreateAgentRequest>,
  res: Response,
) => {
  const agent = await agentService.createAgent(
    req.organizationId!,
    req.user.id,
    req.validated,
  )
  return res.status(201).json(agent)
}

export const listAgents = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const status = req.query.status as string | undefined
  const agents = await agentService.listAgents(req.organizationId!, { status })
  return res.json(agents)
}

export const getAgent = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const agent = await agentService.getAgentById(
    req.params.agentId,
    req.organizationId!,
  )
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' })
  }
  return res.json(agent)
}

export const updateAgent = async (
  req: AuthRequest<UpdateAgentRequest & AgentIdParam>,
  res: Response,
) => {
  const agent = await agentService.updateAgent(
    req.params.agentId,
    req.organizationId!,
    req.validated,
  )
  return res.json(agent)
}

export const deleteAgent = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  await agentService.deleteAgent(req.params.agentId, req.organizationId!)
  return res.status(204).send()
}

export const activateAgent = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const agent = await agentService.activateAgent(
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(agent)
}

export const deactivateAgent = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const agent = await agentService.deactivateAgent(
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(agent)
}

export const getAgentStats = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const stats = await agentService.getAgentStats(
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(stats)
}

export const getAgentConversations = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const leadId = req.query.leadId as string | undefined
  const limit = parseInt(req.query.limit as string, 10) || 100

  const conversations = await agentService.getAgentConversations(
    req.params.agentId,
    req.organizationId!,
    { leadId, limit },
  )
  return res.json(conversations)
}

// ============================================
// Agent Email Configuration
// ============================================

export const configureEmail = async (
  req: AuthRequest<ConfigureAgentEmailRequest & AgentIdParam>,
  res: Response,
) => {
  const config = await agentEmailService.configureEmail(
    req.params.agentId,
    req.organizationId!,
    req.validated,
  )
  return res.json(config)
}

export const getEmailConfig = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const config = await agentEmailService.getEmailConfig(
    req.params.agentId,
    req.organizationId!,
  )
  if (!config) {
    return res.status(404).json({ error: 'Email not configured' })
  }
  return res.json(config)
}

export const testEmailConnection = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const result = await agentEmailService.testEmailConnection(
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(result)
}

export const verifyEmailConfig = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const config = await agentEmailService.verifyEmailConfig(
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(config)
}

export const deleteEmailConfig = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  await agentEmailService.deleteEmailConfig(
    req.params.agentId,
    req.organizationId!,
  )
  return res.status(204).send()
}

// ============================================
// Agent SMS Configuration
// ============================================

export const provisionSms = async (
  req: AuthRequest<ProvisionAgentSmsRequest & AgentIdParam>,
  res: Response,
) => {
  const config = await agentSmsService.provisionSms(
    req.params.agentId,
    req.organizationId!,
    req.validated,
  )
  return res.json(config)
}

export const getSmsConfig = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const config = await agentSmsService.getSmsConfig(
    req.params.agentId,
    req.organizationId!,
  )
  if (!config) {
    return res.status(404).json({ error: 'SMS not configured' })
  }
  return res.json(config)
}

export const configureAiSettings = async (
  req: AuthRequest<ConfigureAgentSmsAiRequest & AgentIdParam>,
  res: Response,
) => {
  const config = await agentSmsService.configureAiSettings(
    req.params.agentId,
    req.organizationId!,
    req.validated,
  )
  return res.json(config)
}

export const activateSms = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const smsConfig = await agentSmsService.activateSms(
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(smsConfig)
}

export const updateAutonomousSms = async (
  req: AuthRequest<
    AgentIdParam & { autonomousEnabled?: boolean; maxRepliesPerLead?: number }
  >,
  res: Response,
) => {
  const smsConfig = await agentSmsService.updateAutonomousSettings(
    req.params.agentId,
    req.organizationId!,
    {
      autonomousEnabled: req.body.autonomousEnabled,
      maxRepliesPerLead: req.body.maxRepliesPerLead,
    },
  )
  return res.json(smsConfig)
}

// ============================================
// Gmail OAuth for Agents
// ============================================

export const getGmailAuthUrl = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const redirectUri = `${config.backendUrl}/api/agents/email/gmail/callback`
  const url = gmailAgentService.getOAuthUrl(req.params.agentId, redirectUri)
  return res.json({ url })
}

export const handleGmailCallback = async (req: Request, res: Response) => {
  const { code, state, error } = req.query

  if (error) {
    return res.redirect(`${config.frontendUrl}/dashboard/agents?gmail=denied`)
  }

  if (!code || typeof code !== 'string') {
    return res.redirect(
      `${config.frontendUrl}/dashboard/agents?gmail=error&reason=missing_code`,
    )
  }

  if (!state || typeof state !== 'string') {
    return res.redirect(
      `${config.frontendUrl}/dashboard/agents?gmail=error&reason=missing_state`,
    )
  }

  const parsedState = gmailAgentService.parseState(state)
  if (!parsedState) {
    return res.redirect(
      `${config.frontendUrl}/dashboard/agents?gmail=error&reason=invalid_state`,
    )
  }

  try {
    const redirectUri = `${config.backendUrl}/api/agents/email/gmail/callback`
    const tokens = await gmailAgentService.exchangeCodeForTokens(
      code,
      redirectUri,
    )

    // Get agent to find organization
    const agent = await agentService.getAgentById(parsedState.agentId, '')
    if (!agent) {
      return res.redirect(
        `${config.frontendUrl}/dashboard/agents?gmail=error&reason=agent_not_found`,
      )
    }

    await gmailAgentService.saveCredentials(
      parsedState.agentId,
      agent.organizationId,
      tokens,
    )

    return res.redirect(
      `${config.frontendUrl}/dashboard/agents?gmail=connected&agentId=${parsedState.agentId}`,
    )
  } catch (err) {
    console.error('Gmail OAuth callback failed:', err)
    return res.redirect(
      `${config.frontendUrl}/dashboard/agents?gmail=error&reason=oauth_failed`,
    )
  }
}

export const getGmailStatus = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const status = await gmailAgentService.getStatus(req.params.agentId)
  return res.json(status)
}

export const disconnectGmail = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  await gmailAgentService.disconnect(req.params.agentId, req.organizationId!)
  return res.status(204).send()
}

export const testGmailConnection = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const result = await gmailAgentService.testConnection(req.params.agentId)
  return res.json(result)
}

// ============================================
// Agent Workflows
// ============================================

export const createWorkflow = async (
  req: AuthRequest<CreateAgentWorkflowRequest & AgentIdParam>,
  res: Response,
) => {
  const workflow = await agentWorkflowService.createWorkflow(
    req.params.agentId,
    req.organizationId!,
    req.validated,
  )
  return res.status(201).json(workflow)
}

export const listWorkflows = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const isActive =
    req.query.isActive === 'true'
      ? true
      : req.query.isActive === 'false'
        ? false
        : undefined
  const workflows = await agentWorkflowService.listWorkflows(
    req.params.agentId,
    req.organizationId!,
    { isActive },
  )
  return res.json({ workflows })
}

export const getWorkflow = async (
  req: AuthRequest<WorkflowIdParam>,
  res: Response,
) => {
  const workflow = await agentWorkflowService.getWorkflowById(
    req.params.workflowId,
    req.params.agentId,
    req.organizationId!,
  )
  if (!workflow) {
    return res.status(404).json({ error: 'Workflow not found' })
  }
  return res.json(workflow)
}

export const updateWorkflow = async (
  req: AuthRequest<UpdateAgentWorkflowRequest & WorkflowIdParam>,
  res: Response,
) => {
  const workflow = await agentWorkflowService.updateWorkflow(
    req.params.workflowId,
    req.params.agentId,
    req.organizationId!,
    req.validated,
  )
  return res.json(workflow)
}

export const deleteWorkflow = async (
  req: AuthRequest<WorkflowIdParam>,
  res: Response,
) => {
  await agentWorkflowService.deleteWorkflow(
    req.params.workflowId,
    req.params.agentId,
    req.organizationId!,
  )
  return res.status(204).send()
}

export const activateWorkflow = async (
  req: AuthRequest<WorkflowIdParam>,
  res: Response,
) => {
  const workflow = await agentWorkflowService.activateWorkflow(
    req.params.workflowId,
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(workflow)
}

export const deactivateWorkflow = async (
  req: AuthRequest<WorkflowIdParam>,
  res: Response,
) => {
  const workflow = await agentWorkflowService.deactivateWorkflow(
    req.params.workflowId,
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(workflow)
}

export const executeWorkflow = async (
  req: AuthRequest<WorkflowIdParam>,
  res: Response,
) => {
  const result = await agentWorkflowService.executeWorkflow(
    req.params.workflowId,
    req.params.agentId,
    req.organizationId!,
  )
  return res.json(result)
}

// ============================================
// Lead Qualification
// ============================================

export const qualifyLead = async (
  req: AuthRequest<QualifyLeadRequest>,
  res: Response,
) => {
  const qualification = await leadQualificationService.runQualificationWorkflow(
    req.organizationId!,
    req.validated.leadId,
    {
      agentId: req.validated.agentId,
      icpCriteria: req.validated.icpCriteria,
      generateOutreach: req.validated.generateOutreach,
    },
  )
  return res.status(201).json(qualification)
}

export const getQualification = async (
  req: AuthRequest<QualificationIdParam>,
  res: Response,
) => {
  const qualification = await leadQualificationService.getQualificationById(
    req.params.qualificationId,
  )
  if (!qualification) {
    return res.status(404).json({ error: 'Qualification not found' })
  }
  return res.json(qualification)
}

export const getPendingReviews = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 20
  const result = await leadQualificationService.getPendingReviews(
    req.organizationId!,
    { page, limit },
  )
  return res.json(result)
}

export const reviewQualification = async (
  req: AuthRequest<ReviewQualificationRequest & QualificationIdParam>,
  res: Response,
) => {
  const qualification = await leadQualificationService.reviewQualification(
    req.params.qualificationId,
    req.user.id,
    req.validated.action,
    {
      reviewNotes: req.validated.reviewNotes,
      editedEmail: req.validated.editedEmail,
      editedSms: req.validated.editedSms,
    },
  )
  return res.json(qualification)
}

export const getQualificationStats = async (
  req: AuthRequest<Record<string, never>>,
  res: Response,
) => {
  const stats = await leadQualificationService.getQualificationStats(
    req.organizationId!,
  )
  return res.json(stats)
}

// ============================================
// Orchestration Jobs
// ============================================

export const createOrchestrationJob = async (
  req: AuthRequest<CreateOrchestrationJobRequest & AgentIdParam>,
  res: Response,
) => {
  const { scheduledAt, ...rest } = req.validated
  const job = await agentOrchestrator.createJob(
    req.organizationId!,
    req.user.id,
    {
      ...rest,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    },
  )
  return res.status(201).json(job)
}

export const listOrchestrationJobs = async (
  req: AuthRequest<AgentIdParam>,
  res: Response,
) => {
  const status = req.query.status as string | undefined
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0
  const result = await agentOrchestrator.listJobs(req.organizationId!, {
    status,
    limit,
    offset,
  })
  return res.json(result)
}

export const getOrchestrationJob = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const job = await agentOrchestrator.getJob(req.params.jobId)
  if (!job) {
    return res.status(404).json({ error: 'Job not found' })
  }
  return res.json(job)
}

export const startOrchestrationJob = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const job = await agentOrchestrator.startJob(req.params.jobId)
  return res.json(job)
}

export const pauseOrchestrationJob = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const job = await agentOrchestrator.pauseJob(req.params.jobId)
  return res.json(job)
}

export const resumeOrchestrationJob = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const job = await agentOrchestrator.resumeJob(req.params.jobId)
  return res.json(job)
}

export const cancelOrchestrationJob = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const job = await agentOrchestrator.cancelJob(req.params.jobId)
  return res.json(job)
}

export const getOrchestrationJobProgress = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const progress = await agentOrchestrator.getJobProgress(req.params.jobId)
  return res.json(progress)
}

export const getOrchestrationJobSteps = async (
  req: AuthRequest<JobIdParam>,
  res: Response,
) => {
  const limit = parseInt(req.query.limit as string) || 50
  const offset = parseInt(req.query.offset as string) || 0
  const status = req.query.status as string | undefined
  const steps = await agentOrchestrator.getJobSteps(req.params.jobId, {
    limit,
    offset,
    status,
  })
  return res.json({ steps })
}

import { Router } from 'express'
import { z } from 'zod'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
  requireSuperAdmin,
} from '../middlewares/auth'
import {
  CreateAgentRequestSchema,
  UpdateAgentRequestSchema,
  ConfigureAgentEmailRequestSchema,
  ProvisionAgentSmsRequestSchema,
  ConfigureAgentSmsAiRequestSchema,
  CreateAgentWorkflowRequestSchema,
  UpdateAgentWorkflowRequestSchema,
  QualifyLeadRequestSchema,
  ReviewQualificationRequestSchema,
  AgentIdParamSchema,
  WorkflowIdParamSchema,
  QualificationIdParamSchema,
  JobIdParamSchema,
  CreateOrchestrationJobRequestSchema,
} from '@shared/types/src/requests/leadAgent'
import * as agentController from '@/api/controllers/agent.controller'

const router = Router()

// Gmail OAuth callback - no auth required (state contains agentId)
router.get('/email/gmail/callback', agentController.handleGmailCallback)

// All other agent routes require authentication, superadmin role (experimental feature), and organization membership
router.use(withBetterAuth, requireSuperAdmin, validateMemberOfOrganization)

// ============================================
// Agent CRUD
// ============================================

// POST /agents - Create agent
router.post(
  '/',
  validateAndMerge(CreateAgentRequestSchema),
  authenticatedRoute(agentController.createAgent),
)

// GET /agents - List agents
router.get('/', authenticatedRoute(agentController.listAgents))

// GET /agents/:agentId - Get agent
router.get(
  '/:agentId',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getAgent),
)

// PATCH /agents/:agentId - Update agent
router.patch(
  '/:agentId',
  validateAndMerge(AgentIdParamSchema.merge(UpdateAgentRequestSchema)),
  authenticatedRoute(agentController.updateAgent),
)

// DELETE /agents/:agentId - Delete agent
router.delete(
  '/:agentId',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.deleteAgent),
)

// POST /agents/:agentId/activate - Activate agent
router.post(
  '/:agentId/activate',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.activateAgent),
)

// POST /agents/:agentId/deactivate - Deactivate agent
router.post(
  '/:agentId/deactivate',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.deactivateAgent),
)

// GET /agents/:agentId/stats - Get agent statistics
router.get(
  '/:agentId/stats',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getAgentStats),
)

// GET /agents/:agentId/conversations - Get agent conversations
router.get(
  '/:agentId/conversations',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getAgentConversations),
)

// ============================================
// Agent Email Configuration
// ============================================

// POST /agents/:agentId/email - Configure email
// Note: ConfigureAgentEmailRequestSchema is a discriminated union, so params are validated separately
router.post(
  '/:agentId/email',
  validateAndMerge(ConfigureAgentEmailRequestSchema),
  authenticatedRoute(agentController.configureEmail),
)

// GET /agents/:agentId/email - Get email config
router.get(
  '/:agentId/email',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getEmailConfig),
)

// POST /agents/:agentId/email/test - Test email connection
router.post(
  '/:agentId/email/test',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.testEmailConnection),
)

// POST /agents/:agentId/email/verify - Verify email config
router.post(
  '/:agentId/email/verify',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.verifyEmailConfig),
)

// DELETE /agents/:agentId/email - Delete email config
router.delete(
  '/:agentId/email',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.deleteEmailConfig),
)

// ============================================
// Agent SMS Configuration
// ============================================

// POST /agents/:agentId/sms/provision - Provision Twilio subaccount and phone
router.post(
  '/:agentId/sms/provision',
  validateAndMerge(AgentIdParamSchema.merge(ProvisionAgentSmsRequestSchema)),
  authenticatedRoute(agentController.provisionSms),
)

// GET /agents/:agentId/sms - Get SMS config
router.get(
  '/:agentId/sms',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getSmsConfig),
)

// PATCH /agents/:agentId/sms/ai-config - Configure AI settings
router.patch(
  '/:agentId/sms/ai-config',
  validateAndMerge(AgentIdParamSchema.merge(ConfigureAgentSmsAiRequestSchema)),
  authenticatedRoute(agentController.configureAiSettings),
)

// POST /agents/:agentId/sms/activate - Activate SMS
router.post(
  '/:agentId/sms/activate',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.activateSms),
)

// PATCH /agents/:agentId/sms/autonomous - Update autonomous SMS settings
router.patch(
  '/:agentId/sms/autonomous',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.updateAutonomousSms),
)

// ============================================
// Gmail OAuth for Agents
// ============================================

// GET /agents/:agentId/email/gmail/auth-url - Get Gmail OAuth URL
router.get(
  '/:agentId/email/gmail/auth-url',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getGmailAuthUrl),
)

// GET /agents/:agentId/email/gmail/status - Get Gmail connection status
router.get(
  '/:agentId/email/gmail/status',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.getGmailStatus),
)

// DELETE /agents/:agentId/email/gmail - Disconnect Gmail
router.delete(
  '/:agentId/email/gmail',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.disconnectGmail),
)

// POST /agents/:agentId/email/gmail/test - Test Gmail connection
router.post(
  '/:agentId/email/gmail/test',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.testGmailConnection),
)

// ============================================
// Agent Workflows
// ============================================

// POST /agents/:agentId/workflows - Create workflow
router.post(
  '/:agentId/workflows',
  validateAndMerge(AgentIdParamSchema.merge(CreateAgentWorkflowRequestSchema)),
  authenticatedRoute(agentController.createWorkflow),
)

// GET /agents/:agentId/workflows - List workflows
router.get(
  '/:agentId/workflows',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.listWorkflows),
)

// GET /agents/:agentId/workflows/:workflowId - Get workflow
router.get(
  '/:agentId/workflows/:workflowId',
  validateAndMerge(WorkflowIdParamSchema),
  authenticatedRoute(agentController.getWorkflow),
)

// PATCH /agents/:agentId/workflows/:workflowId - Update workflow
router.patch(
  '/:agentId/workflows/:workflowId',
  validateAndMerge(
    WorkflowIdParamSchema.merge(UpdateAgentWorkflowRequestSchema),
  ),
  authenticatedRoute(agentController.updateWorkflow),
)

// DELETE /agents/:agentId/workflows/:workflowId - Delete workflow
router.delete(
  '/:agentId/workflows/:workflowId',
  validateAndMerge(WorkflowIdParamSchema),
  authenticatedRoute(agentController.deleteWorkflow),
)

// POST /agents/:agentId/workflows/:workflowId/activate - Activate workflow
router.post(
  '/:agentId/workflows/:workflowId/activate',
  validateAndMerge(WorkflowIdParamSchema),
  authenticatedRoute(agentController.activateWorkflow),
)

// POST /agents/:agentId/workflows/:workflowId/deactivate - Deactivate workflow
router.post(
  '/:agentId/workflows/:workflowId/deactivate',
  validateAndMerge(WorkflowIdParamSchema),
  authenticatedRoute(agentController.deactivateWorkflow),
)

// POST /agents/:agentId/workflows/:workflowId/execute - Execute workflow manually
router.post(
  '/:agentId/workflows/:workflowId/execute',
  validateAndMerge(WorkflowIdParamSchema),
  authenticatedRoute(agentController.executeWorkflow),
)

// ============================================
// Lead Qualification
// ============================================

// POST /qualifications - Qualify a lead
router.post(
  '/qualifications',
  validateAndMerge(QualifyLeadRequestSchema),
  authenticatedRoute(agentController.qualifyLead),
)

// GET /qualifications/pending - Get pending reviews
router.get(
  '/qualifications/pending',
  authenticatedRoute(agentController.getPendingReviews),
)

// GET /qualifications/stats - Get qualification stats
router.get(
  '/qualifications/stats',
  authenticatedRoute(agentController.getQualificationStats),
)

// GET /qualifications/:qualificationId - Get qualification
router.get(
  '/qualifications/:qualificationId',
  validateAndMerge(QualificationIdParamSchema),
  authenticatedRoute(agentController.getQualification),
)

// POST /qualifications/:qualificationId/review - Review qualification
router.post(
  '/qualifications/:qualificationId/review',
  validateAndMerge(
    QualificationIdParamSchema.merge(ReviewQualificationRequestSchema),
  ),
  authenticatedRoute(agentController.reviewQualification),
)

// ============================================
// Orchestration Jobs
// ============================================

// POST /agents/:agentId/jobs - Create orchestration job
router.post(
  '/:agentId/jobs',
  validateAndMerge(
    AgentIdParamSchema.merge(CreateOrchestrationJobRequestSchema),
  ),
  authenticatedRoute(agentController.createOrchestrationJob),
)

// GET /agents/:agentId/jobs - List orchestration jobs
router.get(
  '/:agentId/jobs',
  validateAndMerge(AgentIdParamSchema),
  authenticatedRoute(agentController.listOrchestrationJobs),
)

// GET /agents/:agentId/jobs/:jobId - Get orchestration job
router.get(
  '/:agentId/jobs/:jobId',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.getOrchestrationJob),
)

// POST /agents/:agentId/jobs/:jobId/start - Start job
router.post(
  '/:agentId/jobs/:jobId/start',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.startOrchestrationJob),
)

// POST /agents/:agentId/jobs/:jobId/pause - Pause job
router.post(
  '/:agentId/jobs/:jobId/pause',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.pauseOrchestrationJob),
)

// POST /agents/:agentId/jobs/:jobId/resume - Resume job
router.post(
  '/:agentId/jobs/:jobId/resume',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.resumeOrchestrationJob),
)

// POST /agents/:agentId/jobs/:jobId/cancel - Cancel job
router.post(
  '/:agentId/jobs/:jobId/cancel',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.cancelOrchestrationJob),
)

// GET /agents/:agentId/jobs/:jobId/progress - Get job progress
router.get(
  '/:agentId/jobs/:jobId/progress',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.getOrchestrationJobProgress),
)

// GET /agents/:agentId/jobs/:jobId/steps - Get job steps
router.get(
  '/:agentId/jobs/:jobId/steps',
  validateAndMerge(JobIdParamSchema),
  authenticatedRoute(agentController.getOrchestrationJobSteps),
)

export default router

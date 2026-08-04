import { Router } from 'express'
import { validateAndMerge } from '../middlewares/validationMiddleware'
import { authenticatedRoute } from './utils'
import {
  withBetterAuth,
  validateMemberOfOrganization,
} from '../middlewares/auth'
import {
  CreateAgentDefinitionRequestSchema,
  UpdateAgentDefinitionRequestSchema,
  InvokeOrchestratorRequestSchema,
  InvokeAgentRequestSchema,
  RespondToApprovalRequestSchema,
  BatchRespondToApprovalsRequestSchema,
  DefinitionIdParamSchema,
  ExecutionIdParamSchema,
  ApprovalIdParamSchema,
  AgentDefinitionTypeSchema,
} from '@shared/types/src/requests/leadAgent'
import * as orchestrationController from '@/api/controllers/orchestration.controller'
import { z } from 'zod'

const router = Router()

// All routes require authentication and organization membership
router.use(withBetterAuth, validateMemberOfOrganization)

// ============================================
// Agent Definitions
// ============================================

// POST /orchestration/definitions - Create agent definition
router.post(
  '/definitions',
  validateAndMerge(CreateAgentDefinitionRequestSchema),
  authenticatedRoute(orchestrationController.createDefinition),
)

// GET /orchestration/definitions - List agent definitions
router.get(
  '/definitions',
  authenticatedRoute(orchestrationController.listDefinitions),
)

// GET /orchestration/definitions/:definitionId - Get agent definition
router.get(
  '/definitions/:definitionId',
  validateAndMerge(DefinitionIdParamSchema),
  authenticatedRoute(orchestrationController.getDefinition),
)

// PATCH /orchestration/definitions/:definitionId - Update agent definition
router.patch(
  '/definitions/:definitionId',
  validateAndMerge(
    DefinitionIdParamSchema.merge(UpdateAgentDefinitionRequestSchema),
  ),
  authenticatedRoute(orchestrationController.updateDefinition),
)

// DELETE /orchestration/definitions/:definitionId - Delete agent definition
router.delete(
  '/definitions/:definitionId',
  validateAndMerge(DefinitionIdParamSchema),
  authenticatedRoute(orchestrationController.deleteDefinition),
)

// ============================================
// Agent Invocation
// ============================================

// POST /orchestration/invoke - Invoke the orchestrator agent
router.post(
  '/invoke',
  validateAndMerge(InvokeOrchestratorRequestSchema),
  authenticatedRoute(orchestrationController.invokeOrchestrator),
)

// POST /orchestration/invoke/:definitionId - Invoke a specific agent
router.post(
  '/invoke/:definitionId',
  validateAndMerge(DefinitionIdParamSchema.merge(InvokeAgentRequestSchema)),
  authenticatedRoute(orchestrationController.invokeAgent),
)

// POST /orchestration/invoke/type/:agentType - Invoke a specialized agent by type
router.post(
  '/invoke/type/:agentType',
  validateAndMerge(
    z
      .object({ agentType: AgentDefinitionTypeSchema })
      .merge(InvokeAgentRequestSchema),
  ),
  authenticatedRoute(orchestrationController.invokeByType),
)

// ============================================
// Executions
// ============================================

// GET /orchestration/executions - List executions
router.get(
  '/executions',
  authenticatedRoute(orchestrationController.listExecutions),
)

// GET /orchestration/executions/:executionId - Get execution details
router.get(
  '/executions/:executionId',
  validateAndMerge(ExecutionIdParamSchema),
  authenticatedRoute(orchestrationController.getExecution),
)

// GET /orchestration/executions/:executionId/children - Get child executions
router.get(
  '/executions/:executionId/children',
  validateAndMerge(ExecutionIdParamSchema),
  authenticatedRoute(orchestrationController.getChildExecutions),
)

// ============================================
// Approvals
// ============================================

// GET /orchestration/approvals - List pending approvals
router.get(
  '/approvals',
  authenticatedRoute(orchestrationController.listPendingApprovals),
)

// GET /orchestration/approvals/:approvalId - Get approval details
router.get(
  '/approvals/:approvalId',
  validateAndMerge(ApprovalIdParamSchema),
  authenticatedRoute(orchestrationController.getApproval),
)

// POST /orchestration/approvals/:approvalId/respond - Respond to approval
router.post(
  '/approvals/:approvalId/respond',
  validateAndMerge(ApprovalIdParamSchema.merge(RespondToApprovalRequestSchema)),
  authenticatedRoute(orchestrationController.respondToApproval),
)

// POST /orchestration/approvals/batch - Batch respond to approvals
router.post(
  '/approvals/batch',
  validateAndMerge(BatchRespondToApprovalsRequestSchema),
  authenticatedRoute(orchestrationController.batchRespondToApprovals),
)

// ============================================
// Tools
// ============================================

// GET /orchestration/tools - List available tools
router.get('/tools', authenticatedRoute(orchestrationController.listTools))

// GET /orchestration/tools/:category - List tools by category
router.get(
  '/tools/:category',
  authenticatedRoute(orchestrationController.listToolsByCategory),
)

export default router

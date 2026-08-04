import { Router, Response, NextFunction } from 'express'
import { withBetterAuth } from '../middlewares/auth'
import {
  expensiveOperationRateLimit,
  generalApiRateLimit,
} from '../middlewares/rateLimiterMiddleware'
import { AuthRequest } from '@/types/handlers'
import * as webResearchService from '@/services/webResearch.service'
import * as researchApprovalService from '@/services/researchApproval.service'
import * as researchTemplateService from '@/services/researchTemplate.service'
import * as customFieldSchemaService from '@/services/customFieldSchema.service'
import * as firecrawlClient from '@/clients/firecrawl.client'
import { db } from '@/lib/db'
import { addResearchTaskJob } from '@/queues/research-task.queue'
import { ResearchTaskEventType } from '@/types/queues'
import {
  CreateResearchTaskRequestSchema,
  BulkCreateResearchTasksRequestSchema,
  ListResearchTasksRequestSchema,
  CancelResearchTaskRequestSchema,
  RetryResearchTaskRequestSchema,
  ListResearchApprovalsRequestSchema,
  ApproveResearchApprovalRequestSchema,
  RejectResearchApprovalRequestSchema,
  ModifyResearchApprovalRequestSchema,
  BulkApproveResearchApprovalsRequestSchema,
  BulkRejectResearchApprovalsRequestSchema,
  CreateResearchTemplateRequestSchema,
  UpdateResearchTemplateRequestSchema,
  ListResearchTemplatesRequestSchema,
  CreateCustomFieldSchemaRequestSchema,
  UpdateCustomFieldSchemaRequestSchema,
  ListCustomFieldSchemasRequestSchema,
  TestFirecrawlConnectionRequestSchema,
} from '@shared/types/src'

const router = Router()

// Read endpoints use general rate limit; expensive task creation gets its own below
router.use(generalApiRateLimit)

// Helper to get organizationId from session
const getOrgId = (authReq: AuthRequest<unknown>): string | null =>
  (authReq.session as any)?.session?.activeOrganizationId ?? null

// === Research Tasks ===

// Create a research task
router.post(
  '/tasks',
  expensiveOperationRateLimit,
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = CreateResearchTaskRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const task = await webResearchService.createTask(
        data.organizationId,
        authReq.user.id,
        {
          leadId: data.leadId,
          templateId: data.templateId,
          customPrompt: data.customPrompt,
          targetUrls: data.targetUrls,
          priority: data.priority,
        },
      )

      // Queue the task for execution
      await addResearchTaskJob({
        type: ResearchTaskEventType.EXECUTE_TASK,
        taskId: task.id,
        organizationId: data.organizationId,
      })

      // Update task status to queued
      await db
        .updateTable('research_task')
        .set({ status: 'queued', updatedAt: new Date() })
        .where('id', '=', task.id)
        .execute()

      res.status(201).json({ ...task, status: 'queued' })
    } catch (error) {
      next(error)
    }
  },
)

// Bulk create research tasks
router.post(
  '/tasks/bulk',
  expensiveOperationRateLimit,
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = BulkCreateResearchTasksRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const result = await webResearchService.createBulkTasks(
        data.organizationId,
        authReq.user.id,
        {
          leadIds: data.leadIds,
          templateId: data.templateId,
          customPrompt: data.customPrompt,
          targetUrls: data.targetUrls,
          priority: data.priority,
        },
      )

      // Queue all created tasks
      for (const taskId of result.taskIds) {
        await addResearchTaskJob({
          type: ResearchTaskEventType.EXECUTE_TASK,
          taskId,
          organizationId: data.organizationId,
        })

        await db
          .updateTable('research_task')
          .set({ status: 'queued', updatedAt: new Date() })
          .where('id', '=', taskId)
          .execute()
      }

      res.status(201).json(result)
    } catch (error) {
      next(error)
    }
  },
)

// List research tasks
router.get(
  '/tasks',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, leadId, status, page, limit } =
        ListResearchTasksRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await webResearchService.listTasks(
        organizationId,
        { leadId, status },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// Get research task details
router.get(
  '/tasks/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const task = await webResearchService.getTask(
        req.params.id,
        organizationId,
      )
      res.json(task)
    } catch (error) {
      next(error)
    }
  },
)

// Cancel a research task
router.post(
  '/tasks/:id/cancel',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      CancelResearchTaskRequestSchema.parse({ id: req.params.id })

      await webResearchService.cancelTask(
        req.params.id,
        organizationId,
        authReq.user.id,
      )

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

// Retry a failed research task
router.post(
  '/tasks/:id/retry',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      RetryResearchTaskRequestSchema.parse({ id: req.params.id })

      await webResearchService.retryTask(
        req.params.id,
        organizationId,
        authReq.user.id,
      )

      // Re-queue the task
      await addResearchTaskJob({
        type: ResearchTaskEventType.EXECUTE_TASK,
        taskId: req.params.id,
        organizationId,
      })

      await db
        .updateTable('research_task')
        .set({ status: 'queued', updatedAt: new Date() })
        .where('id', '=', req.params.id)
        .execute()

      res.json({ success: true })
    } catch (error) {
      next(error)
    }
  },
)

// === Research Approvals ===

// List pending approvals
router.get(
  '/approvals',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, leadId, taskId, status, page, limit } =
        ListResearchApprovalsRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const result = await researchApprovalService.listApprovals(
        organizationId,
        { leadId, taskId, status },
        { page, limit },
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// Approve single approval
router.post(
  '/approvals/:id/approve',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      ApproveResearchApprovalRequestSchema.parse({ id: req.params.id })

      const approval = await researchApprovalService.approveApproval(
        req.params.id,
        organizationId,
        authReq.user.id,
      )

      res.json(approval)
    } catch (error) {
      next(error)
    }
  },
)

// Reject single approval
router.post(
  '/approvals/:id/reject',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const { reason } = RejectResearchApprovalRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const approval = await researchApprovalService.rejectApproval(
        req.params.id,
        organizationId,
        authReq.user.id,
        reason,
      )

      res.json(approval)
    } catch (error) {
      next(error)
    }
  },
)

// Modify and approve
router.post(
  '/approvals/:id/modify',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const { modifiedValue } = ModifyResearchApprovalRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const approval = await researchApprovalService.modifyApproval(
        req.params.id,
        organizationId,
        authReq.user.id,
        modifiedValue,
      )

      res.json(approval)
    } catch (error) {
      next(error)
    }
  },
)

// Bulk approve
router.post(
  '/approvals/bulk/approve',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const { ids } = BulkApproveResearchApprovalsRequestSchema.parse(req.body)

      const result = await researchApprovalService.bulkApprove(
        ids,
        organizationId,
        authReq.user.id,
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// Bulk reject
router.post(
  '/approvals/bulk/reject',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const { ids, reason } = BulkRejectResearchApprovalsRequestSchema.parse(
        req.body,
      )

      const result = await researchApprovalService.bulkReject(
        ids,
        organizationId,
        authReq.user.id,
        reason,
      )

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

// === Research Templates ===

// List templates
router.get(
  '/templates',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, isActive, includeSystem } =
        ListResearchTemplatesRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const templates = await researchTemplateService.listTemplates(
        organizationId,
        { isActive, includeSystem },
      )

      res.json({ data: templates })
    } catch (error) {
      next(error)
    }
  },
)

// Get single template
router.get(
  '/templates/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const template = await researchTemplateService.getTemplate(
        req.params.id,
        organizationId,
      )

      res.json(template)
    } catch (error) {
      next(error)
    }
  },
)

// Create template
router.post(
  '/templates',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = CreateResearchTemplateRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const template = await researchTemplateService.createTemplate(
        data.organizationId ?? null,
        authReq.user.id,
        {
          name: data.name,
          description: data.description,
          prompt: data.prompt,
          targetUrls: data.targetUrls,
          extractionSchema: data.extractionSchema as Record<string, unknown>,
          fieldMappings: data.fieldMappings as Record<string, string>,
          isSystemTemplate: data.isSystemTemplate,
        },
      )

      res.status(201).json(template)
    } catch (error) {
      next(error)
    }
  },
)

// Update template
router.patch(
  '/templates/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const data = UpdateResearchTemplateRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const template = await researchTemplateService.updateTemplate(
        data.id,
        organizationId,
        {
          name: data.name,
          description: data.description,
          prompt: data.prompt,
          targetUrls: data.targetUrls,
          extractionSchema: data.extractionSchema as
            | Record<string, unknown>
            | undefined,
          fieldMappings: data.fieldMappings as
            | Record<string, string>
            | undefined,
          isActive: data.isActive,
        },
      )

      res.json(template)
    } catch (error) {
      next(error)
    }
  },
)

// Delete template
router.delete(
  '/templates/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      await researchTemplateService.deleteTemplate(
        req.params.id,
        organizationId,
      )
      res.status(204).send()
    } catch (error) {
      next(error)
    }
  },
)

// === Custom Field Schemas ===

// List field schemas
router.get(
  '/fields',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const { organizationId, isActive } =
        ListCustomFieldSchemasRequestSchema.parse({
          organizationId: getOrgId(authReq),
          ...req.query,
        })

      const schemas = await customFieldSchemaService.listSchemas(
        organizationId,
        {
          isActive,
        },
      )

      res.json({ data: schemas })
    } catch (error) {
      next(error)
    }
  },
)

// Create field schema
router.post(
  '/fields',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const data = CreateCustomFieldSchemaRequestSchema.parse({
        organizationId: getOrgId(authReq),
        ...req.body,
      })

      const schema = await customFieldSchemaService.createSchema(
        data.organizationId,
        authReq.user.id,
        {
          name: data.name,
          label: data.label,
          fieldType: data.fieldType,
          description: data.description,
          isRequired: data.isRequired,
          defaultValue: data.defaultValue,
          validationRule: data.validationRule,
          sortOrder: data.sortOrder,
        },
      )

      res.status(201).json(schema)
    } catch (error) {
      next(error)
    }
  },
)

// Update field schema
router.patch(
  '/fields/:id',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const authReq = req as AuthRequest<unknown>
      const organizationId = getOrgId(authReq)
      if (!organizationId) {
        return res.status(400).json({ error: 'Organization not found' })
      }

      const data = UpdateCustomFieldSchemaRequestSchema.parse({
        id: req.params.id,
        ...req.body,
      })

      const schema = await customFieldSchemaService.updateSchema(
        data.id,
        organizationId,
        {
          label: data.label,
          description: data.description,
          isRequired: data.isRequired,
          defaultValue: data.defaultValue,
          validationRule: data.validationRule,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
        },
      )

      res.json(schema)
    } catch (error) {
      next(error)
    }
  },
)

// === Firecrawl Connection ===

// Test Firecrawl connection (before saving)
router.post(
  '/connection/test',
  withBetterAuth,
  async (req, res: Response, next: NextFunction) => {
    try {
      const { apiKey } = TestFirecrawlConnectionRequestSchema.parse(req.body)
      const result = await firecrawlClient.testConnection(apiKey)
      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

export default router
